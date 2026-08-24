#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = 3;
const HASH_ALGORITHM = "sha256";
const USER_APPROVAL_MARKER = "explicit-user-approval";
const SUPPORTED_PROVENANCE_KINDS = ["manifest-candidate", "skills-lock", "manifest-explicit-baseline"];
const AUDIT_RECORD_FIELDS = [
  "recordId",
  "candidateSourcePath",
  "sourceTreeHash",
  "manifestSha256",
  "category",
];
const AUDIT_CATEGORIES = [
  "RECOMMENDED",
  "RECOMMENDED_WITH_NOTES",
  "REDUNDANT",
  "CONFLICTING",
  "NOT_RELEVANT",
  "UNSAFE",
  "NEEDS_REVIEW",
];
const AUDIT_COPY_CATEGORIES = ["RECOMMENDED", "RECOMMENDED_WITH_NOTES"];
const DIRECT_CHILD_PATH_SHAPE = "direct-child";
const TREE_HASH_SCOPE = "root directory mode + deterministic descendant tree: sorted directories, every file path, mode, size, and content digest";
const DECISION_STATES = ["EXCLUDED", "PROTECTED"];
const DECISION_FIELDS = [
  "id",
  "root",
  "sourcePath",
  "state",
  "sourceTreeHash",
  "reason",
  "auditVerdict",
  "evidenceRef",
  "approvalDecisionId",
  "userApprovalMarker",
];
const TOMBSTONE_FIELDS = [
  "id",
  "sourceRoot",
  "sourcePath",
  "targetRoot",
  "targetPath",
  "status",
  "deleteAuthorized",
];
const MANIFEST_UPDATE_FIELDS = [
  "operationId",
  "action",
  "expectedSourceTreeHash",
  "expectedTargetTreeHash",
  "tombstoneId",
  "tombstoneRecord",
  "removeCandidate",
  "replaceDecision",
  "candidateRecord",
  "auditRecord",
  "importRecord",
  "decisionRecord",
  "approval",
];
const USAGE = `Usage:
  node skills-curator/scripts/skill-tree-sync.mjs --manifest skills-sources.json --dry-run
  node skills-curator/scripts/skill-tree-sync.mjs --manifest skills-sources.json --discover-pending
  node skills-curator/scripts/skill-tree-sync.mjs --manifest skills-sources.json --apply-plan <plan.json|->

Modes:
  --dry-run       Read declared roots and emit a deterministic JSON observation.
  --discover-pending
                  Inventory valid direct upstream skills and emit deterministic pending/decision states.
  --apply-plan    Apply only an approved JSON plan; use - to read the plan from stdin.

Options:
  --manifest PATH  Required manifest. Roots and authority come only from this file.
  --help, -h       Show this help.

The upstream root is never written. Discovery is read-only and reports only valid
direct skill directories plus rejected paths. Apply plans must carry the manifest
digest, explicit paths, expected full-tree hashes, approval markers, audit receipts,
and one exact manifest update per operation. Unknown flags, unsafe paths, forbidden
symlinks, malformed metadata, or unauthorized operations fail with a nonzero exit status.`;

class SyncError extends Error {
  constructor(message) {
    super(message);
    this.name = "SyncError";
  }
}

function fail(message) {
  throw new SyncError(message);
}

const USEFUL_NATIVE_ERROR_CODES = new Set([
  "ENOENT",
  "EACCES",
  "EPERM",
  "EXDEV",
  "ENOTEMPTY",
  "EEXIST",
]);

function safeNativeErrorCode(error) {
  const code = typeof error?.code === "string" ? error.code : null;
  if (code && USEFUL_NATIVE_ERROR_CODES.has(code)) return code;
  if (code && /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(code)) return code;
  const name = typeof error?.name === "string" ? error.name : null;
  if (name && /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name)) return name;
  return "Error";
}

function safeContextToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value) ? value : null;
}

function safeContextPhase(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9 _:-]*$/.test(value) ? value : null;
}

function portableRootPath(root, relative) {
  if (!(["agents-skills", "canonical"].includes(root) && typeof relative === "string")) return null;
  if (
    relative.length === 0
    || relative.includes("\\")
    || relative.includes("\0")
    || path.posix.isAbsolute(relative)
    || relative.endsWith("/")
    || relative.split("/").includes("..")
  ) {
    return null;
  }
  return `${root}:${relative}`;
}

function sanitizeNativeError(error, context = {}) {
  const details = [];
  const operationId = safeContextToken(context.operationId);
  const phase = safeContextPhase(context.phase);
  if (operationId) details.push(`operation ${operationId}`);
  if (phase) details.push(`phase ${phase}`);
  for (const entry of [
    portableRootPath(context.sourceRoot, context.sourcePath),
    portableRootPath(context.targetRoot, context.targetPath),
  ]) {
    if (entry && !details.includes(entry)) details.push(entry);
  }
  const code = safeNativeErrorCode(error);
  return details.length > 0 ? `${details.join("; ")}; ${code}` : code;
}

function errorDetail(error, context = {}) {
  return error instanceof SyncError ? error.message : sanitizeNativeError(error, context);
}

function nativeFs(operation, context = {}) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof SyncError) throw error;
    fail(sanitizeNativeError(error, context));
  }
}

function failurePhaseLabel(phase) {
  return safeContextPhase(phase) ?? "operation";
}

function markRollbackFailure(error, phase, rollbackError, context = {}) {
  const wrapped = error instanceof SyncError ? error : new SyncError(errorDetail(error, context));
  wrapped.rollbackFailure = `${failurePhaseLabel(phase)} rollback failed: ${errorDetail(rollbackError, { ...context, phase: "rollback" })}`;
  return wrapped;
}

function markCleanupFailure(error, phase, cleanupError, context = {}) {
  const wrapped = error instanceof SyncError ? error : new SyncError(errorDetail(error, context));
  wrapped.cleanupFailure = `${failurePhaseLabel(phase)} cleanup failed: ${errorDetail(cleanupError, { ...context, phase: "cleanup" })}`;
  return wrapped;
}

function formatFailureEntry(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry.text === "string") return entry.text;
  const label = safeContextPhase(entry?.label) ?? "failure";
  return `${label}: ${errorDetail(entry?.error, entry?.context)}`;
}

function formatTransactionFailure(error, { rollbackErrors = [], cleanupErrors = [], context = {} } = {}) {
  const message = errorDetail(error, context);
  if (rollbackErrors.length > 0) {
    const cleanupMessage = cleanupErrors.length > 0
      ? `; cleanup failed: ${cleanupErrors.map(formatFailureEntry).join("; ")}`
      : "";
    return `${message}; transaction rollback failed and state may be partial: ${rollbackErrors.map(formatFailureEntry).join("; ")}${cleanupMessage}`;
  }
  if (cleanupErrors.length > 0) {
    return `${message}; transaction rolled back; cleanup failed: ${cleanupErrors.map(formatFailureEntry).join("; ")}`;
  }
  return `${message}; transaction rolled back`;
}

function formatCliError(error) {
  if (error instanceof SyncError) return `skill-tree-sync: ${error.message}`;
  return `skill-tree-sync: unexpected failure: ${sanitizeNativeError(error, { phase: "global" })}`;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function safeRelative(value, label) {
  requiredString(value, label);
  if (value === "." || value.includes("\\") || path.posix.isAbsolute(value)) {
    fail(`${label} must be a normalized relative POSIX path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || value.endsWith("/") || value.split("/").includes("..")) {
    fail(`${label} escapes or is not normalized: ${value}`);
  }
  return value;
}

function directChild(value, label) {
  const relative = safeRelative(value, label);
  if (relative.includes("/")) {
    fail(`${label} must be a ${DIRECT_CHILD_PATH_SHAPE} skill directory`);
  }
  return relative;
}

function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function digestBytes(bytes) {
  return crypto.createHash(HASH_ALGORITHM).update(bytes).digest("hex");
}

function canonicalizeJson(value) {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) fail("approval payload contains a non-JSON value");
    return encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeJson(entry)).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort(compareStrings)
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`)
    .join(",")}}`;
}

function approvalPayloadSha256(plan) {
  const payload = { ...plan };
  delete payload.approvalPayloadSha256;
  return digestBytes(Buffer.from(canonicalizeJson(payload), "utf8"));
}

function digestFile(filePath, context = {}) {
  return nativeFs(() => digestBytes(fs.readFileSync(filePath)), context);
}

function readJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`cannot read ${label}: ${sanitizeNativeError(error)}`);
  }
  try {
    return { raw, value: JSON.parse(raw) };
  } catch (error) {
    fail(`malformed JSON in ${label}: ${error.message}`);
  }
}

function lstatOrMissing(filePath, displayPath = "<internal path>") {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    fail(`cannot lstat ${displayPath}: ${sanitizeNativeError(error)}`);
  }
}

function rootEntry(root, relative, label) {
  const absolute = path.resolve(root.absolute, relative);
  if (!contained(root.absolute, absolute)) {
    fail(`${label} escapes declared root: ${relative}`);
  }
  return absolute;
}

function normalizedRootPath(value, label) {
  requiredString(value, label);
  if (value.includes("\\")) {
    fail(`${label} must use normalized POSIX separators`);
  }
  if (value.includes("$")) {
    fail(`${label} must not use shell or environment expansion`);
  }
  if (/^[A-Za-z]:/.test(value)) {
    fail(`${label} must not use a Windows drive path`);
  }
  if (value.startsWith("~") && value !== "~" && !value.startsWith("~/")) {
    fail(`${label} must use ~ for the current user`);
  }
  if (value.startsWith("//") || path.posix.isAbsolute(value)) {
    fail(`${label} must be portable and relative to its declared base`);
  }
  if (value === "~") return value;

  const normalized = path.posix.normalize(value);
  if (
    normalized !== value
    || value.endsWith("/")
    || value.split("/").includes("..")
  ) {
    fail(`${label} escapes or is not normalized: ${value}`);
  }
  return value;
}

function resolveDeclaredRootPath(declaredPath, manifestDirectory) {
  if (declaredPath === "~") return path.resolve(os.homedir());
  if (declaredPath.startsWith("~/")) {
    return path.resolve(os.homedir(), ...declaredPath.slice(2).split("/"));
  }
  return path.resolve(manifestDirectory, declaredPath);
}

function validateRootPath(root, manifestDirectory) {
  const declaredPath = normalizedRootPath(root.path, `root ${root.id}.path`);
  const absolute = resolveDeclaredRootPath(declaredPath, manifestDirectory);
  const parsed = path.parse(absolute);
  let component = parsed.root;
  for (const part of path.relative(parsed.root, absolute).split(path.sep).filter(Boolean)) {
    component = path.join(component, part);
    const componentStat = lstatOrMissing(component, `declared root ${root.id}`);
    if (!componentStat) break;
    if (componentStat.isSymbolicLink()) fail(`declared root contains a symlink component: ${root.id}`);
    if (!componentStat.isDirectory() && component !== absolute) fail(`declared root has a non-directory component: ${root.id}`);
  }
  const stat = lstatOrMissing(absolute, `declared root ${root.id}`);
  if (!stat) fail(`declared root does not exist: ${root.id} (${declaredPath})`);
  if (stat.isSymbolicLink()) fail(`declared root is a symlink: ${root.id} (${declaredPath})`);
  if (!stat.isDirectory()) fail(`declared root is not a directory: ${root.id} (${declaredPath})`);
  return { ...root, path: declaredPath, absolute };
}

function validateContainedFile(root, filePath, label) {
  const absolute = path.resolve(filePath);
  if (!contained(root.absolute, absolute)) fail(`${label} must be inside the canonical root`);
  const relative = path.relative(root.absolute, absolute);
  if (!relative || path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    fail(`${label} must be inside the canonical root`);
  }
  let current = root.absolute;
  const parts = relative.split(path.sep).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const relativeComponent = parts.slice(0, index + 1).join("/");
    const stat = lstatOrMissing(current, `${label}:${relativeComponent}`);
    if (!stat) fail(`${label} does not exist`);
    if (stat.isSymbolicLink()) fail(`${label} contains a symlink component: ${relativeComponent}`);
    if (index < parts.length - 1 && !stat.isDirectory()) fail(`${label} has a non-directory component: ${relativeComponent}`);
    if (index === parts.length - 1 && !stat.isFile()) fail(`${label} must be a regular file`);
  }
  return absolute;
}

function recordKey(rootId, relative) {
  return `${rootId}:${relative}`;
}

function isUnder(relative, prefix) {
  return relative === prefix || relative.startsWith(`${prefix}/`);
}

function pathsOverlap(left, right) {
  return left === right || isUnder(left, right) || isUnder(right, left);
}

function assertExactKeys(value, keys, label) {
  const expected = new Set(keys);
  const actual = Object.keys(value);
  if (actual.some((key) => !expected.has(key)) || keys.some((key) => !actual.includes(key))) {
    fail(`${label} has unknown or missing fields`);
  }
}

function assertKnownKeys(value, keys, label) {
  const expected = new Set(keys);
  if (Object.keys(value).some((key) => !expected.has(key))) {
    fail(`${label} has unknown fields`);
  }
}

function checkPathRecord(record, label, roots) {
  if (!isObject(record)) fail(`${label} must be an object`);
  const rootId = requiredString(record.root, `${label}.root`);
  if (!roots.has(rootId)) fail(`${label}.root is unknown: ${rootId}`);
  const relative = safeRelative(record.path, `${label}.path`);
  requiredString(record.reason, `${label}.reason`);
  return { ...record, root: rootId, path: relative };
}

function checkNoOverlaps(records, label) {
  const sorted = [...records].sort((a, b) => compareStrings(recordKey(a.root, a.path), recordKey(b.root, b.path)));
  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const left = sorted[leftIndex];
      const right = sorted[rightIndex];
      if (left.root === right.root && pathsOverlap(left.path, right.path)) {
        fail(`${label} contains overlapping paths: ${left.root}:${left.path} and ${right.path}`);
      }
    }
  }
}

function validateAuditRecordShape(record, label, allowedCategories = AUDIT_CATEGORIES) {
  if (!isObject(record)) fail(`${label} must be an object`);
  assertExactKeys(record, AUDIT_RECORD_FIELDS, label);
  requiredString(record.recordId, `${label}.recordId`);
  directChild(record.candidateSourcePath, `${label}.candidateSourcePath`);
  if (!/^[0-9a-f]{64}$/.test(record.sourceTreeHash)) fail(`${label}.sourceTreeHash must be a lowercase SHA-256 hash`);
  if (!/^[0-9a-f]{64}$/.test(record.manifestSha256)) fail(`${label}.manifestSha256 must be a lowercase SHA-256 hash`);
  if (!allowedCategories.includes(record.category)) fail(`${label}.category is not an allowed audit category`);
  return record;
}

function requireStoredAuditRecord(context, record, label) {
  const stored = context.auditRecords.find((candidate) => candidate.recordId === record.recordId);
  if (!stored) fail(`${label}.recordId is not present in the current manifest auditRecords`);
  for (const field of AUDIT_RECORD_FIELDS) {
    if (stored[field] !== record[field]) {
      fail(`${label}.${field} does not match the current manifest audit record`);
    }
  }
  return stored;
}

function validateDecisionRecord(record, label) {
  if (!isObject(record)) fail(`${label} must be an object`);
  assertExactKeys(record, DECISION_FIELDS, label);
  requiredString(record.id, `${label}.id`);
  if (record.root !== "agents-skills") fail(`${label}.root must be agents-skills`);
  directChild(record.sourcePath, `${label}.sourcePath`);
  if (!DECISION_STATES.includes(record.state)) fail(`${label}.state is unsupported`);
  if (!/^[0-9a-f]{64}$/.test(record.sourceTreeHash)) {
    fail(`${label}.sourceTreeHash must be a lowercase SHA-256 hash`);
  }
  requiredString(record.reason, `${label}.reason`);
  if (record.auditVerdict !== null && !AUDIT_CATEGORIES.includes(record.auditVerdict)) {
    fail(`${label}.auditVerdict is unsupported`);
  }
  if (record.evidenceRef !== null) requiredString(record.evidenceRef, `${label}.evidenceRef`);
  if (record.auditVerdict !== null && record.evidenceRef === null) {
    fail(`${label}.evidenceRef is required when auditVerdict is present`);
  }
  requiredString(record.approvalDecisionId, `${label}.approvalDecisionId`);
  if (record.userApprovalMarker !== USER_APPROVAL_MARKER) {
    fail(`${label}.userApprovalMarker must be ${USER_APPROVAL_MARKER}`);
  }
  return record;
}

function validateTombstoneRecord(record, label, protectedPaths = [], excludedPaths = []) {
  if (!isObject(record)) fail(`${label} must be an object`);
  assertExactKeys(record, TOMBSTONE_FIELDS, label);
  requiredString(record.id, `${label}.id`);
  if (record.sourceRoot !== "agents-skills" || record.targetRoot !== "canonical") {
    fail(`${label} must map agents-skills to canonical`);
  }
  const sourcePath = directChild(record.sourcePath, `${label}.sourcePath`);
  const targetPath = directChild(record.targetPath, `${label}.targetPath`);
  if (record.status !== "approved" || record.deleteAuthorized !== true) {
    fail(`${label} must be explicitly approved for deletion`);
  }
  if (protectedPaths.some((entry) => entry.root === "canonical" && pathsOverlap(targetPath, entry.path))) {
    fail(`${label} target is protected: ${targetPath}`);
  }
  if (excludedPaths.some((entry) => entry.root === "canonical" && pathsOverlap(targetPath, entry.path))) {
    fail(`${label} target is excluded: ${targetPath}`);
  }
  return { ...record, id: record.id, sourceRoot: "agents-skills", sourcePath, targetRoot: "canonical", targetPath };
}

function tombstoneRecordEqual(left, right) {
  return TOMBSTONE_FIELDS.every((field) => left?.[field] === right?.[field]);
}

function validateCandidateRecord(record, label, skillsLockData, skillsLockMetadataPath) {
  if (!isObject(record)) fail(`${label} must be an object`);
  assertExactKeys(record, ["sourceRoot", "sourcePath", "targetRoot", "targetPath", "provenance"], label);
  if (record.sourceRoot !== "agents-skills" || record.targetRoot !== "canonical") {
    fail(`${label} must map agents-skills to canonical`);
  }
  const sourcePath = directChild(record.sourcePath, `${label}.sourcePath`);
  const targetPath = directChild(record.targetPath, `${label}.targetPath`);
  validateCandidateProvenance(record, label, skillsLockData, skillsLockMetadataPath);
  return { ...record, sourceRoot: "agents-skills", sourcePath, targetRoot: "canonical", targetPath };
}

function candidateMappingEqual(left, right) {
  return left
    && right
    && left.sourceRoot === right.sourceRoot
    && left.sourcePath === right.sourcePath
    && left.targetRoot === right.targetRoot
    && left.targetPath === right.targetPath
    && JSON.stringify(left.provenance) === JSON.stringify(right.provenance);
}

function decisionRecordEqual(left, right) {
  return DECISION_FIELDS.every((field) => left?.[field] === right?.[field]);
}

function decisionReplacementDiffers(current, next) {
  return ["sourceTreeHash", "reason", "state", "approvalDecisionId", "userApprovalMarker"]
    .some((field) => current?.[field] !== next?.[field]);
}

function auditRecordRecordEqual(left, right) {
  return AUDIT_RECORD_FIELDS.every((field) => left?.[field] === right?.[field]);
}

function findReusableAuditRecord(context, sourcePath, sourceTreeHash, label) {
  const currentHashRecords = context.auditRecords.filter(
    (record) => record.candidateSourcePath === sourcePath && record.sourceTreeHash === sourceTreeHash,
  );
  const contradictory = currentHashRecords.filter((record) => !AUDIT_COPY_CATEGORIES.includes(record.category));
  if (contradictory.length > 0) {
    fail(`${label} has contradictory non-copy-eligible audit receipts for the current source tree hash: ${sourcePath}`);
  }
  const reusable = currentHashRecords.filter((record) => AUDIT_COPY_CATEGORIES.includes(record.category));
  if (reusable.length > 1) {
    fail(`${label} has conflicting audit receipts for the current source tree hash: ${sourcePath}`);
  }
  return reusable[0] ?? null;
}

function validateCandidateProvenance(candidate, label, skillsLockData, skillsLockMetadataPath) {
  const provenance = candidate.provenance;
  if (!isObject(provenance) || !SUPPORTED_PROVENANCE_KINDS.includes(provenance.kind)) {
    fail(`${label}.provenance.kind is unsupported`);
  }
  if (provenance.kind === "manifest-candidate") {
    assertExactKeys(provenance, ["kind", "requiresAudit"], `${label}.provenance`);
    if (provenance.requiresAudit !== true) fail(`${label}.provenance.requiresAudit must be true`);
    return;
  }
  if (provenance.kind === "skills-lock") {
    assertExactKeys(provenance, ["kind", "metadataPath", "record"], `${label}.provenance`);
    if (provenance.metadataPath !== skillsLockMetadataPath) {
      fail(`${label}.provenance.metadataPath does not match the manifest lock metadata`);
    }
    requiredString(provenance.record, `${label}.provenance.record`);
    const locked = skillsLockData.skills[provenance.record];
    if (!isObject(locked)) fail(`${label}.provenance.record is not present in skills-lock.json`);
    const expectedSkillPath = `skills/${candidate.sourcePath}/SKILL.md`;
    const lockSourcePath = typeof locked.skillPath === "string" && locked.skillPath.startsWith("skills/") && locked.skillPath.endsWith("/SKILL.md")
      ? locked.skillPath.slice("skills/".length, -"/SKILL.md".length)
      : null;
    if (lockSourcePath !== candidate.sourcePath) {
      fail(`${label}.provenance source path does not match the candidate source path`);
    }
    if (locked.skillPath !== expectedSkillPath) {
      fail(`${label}.provenance.skillPath does not match ${expectedSkillPath}`);
    }
    return;
  }
  fail(`${label}.provenance.kind is not valid for a candidate`);
}

function validateImportAuthority(record, label) {
  if (!isObject(record.authority)) fail(`${label}.authority must be an object`);
  assertExactKeys(record.authority, ["kind", "basis"], `${label}.authority`);
  if (record.authority.kind !== "manifest-explicit-baseline") {
    fail(`${label}.authority.kind is unsupported`);
  }
  requiredString(record.authority.basis, `${label}.authority.basis`);
}

function validateManifest(manifest, manifestFile, raw) {
  if (!isObject(manifest) || manifest.schemaVersion !== SCHEMA_VERSION) {
    fail(`manifest must use schemaVersion ${SCHEMA_VERSION}`);
  }
  if (!isObject(manifest.authority)) fail("manifest.authority is required");
  assertExactKeys(
    manifest.authority,
    ["direction", "reverseSync", "unknownPathPolicy", "ownership", "supportedProvenanceKinds", "auditPolicy", "decisionPolicy"],
    "manifest.authority",
  );
  if (manifest.authority.direction !== "source-to-canonical-only") {
    fail("manifest.authority.direction must be source-to-canonical-only");
  }
  if (manifest.authority.reverseSync !== "forbidden") fail("manifest.authority.reverseSync must be forbidden");
  if (manifest.authority.unknownPathPolicy !== "stop-or-exclude") {
    fail("manifest.authority.unknownPathPolicy must be stop-or-exclude");
  }
  if (manifest.authority.ownership !== "manifest-only") fail("manifest.authority.ownership must be manifest-only");
  if (!Array.isArray(manifest.authority.supportedProvenanceKinds)) {
    fail("manifest.authority.supportedProvenanceKinds must be an array");
  }
  const declaredProvenanceKinds = [...manifest.authority.supportedProvenanceKinds].sort(compareStrings);
  if (JSON.stringify(declaredProvenanceKinds) !== JSON.stringify([...SUPPORTED_PROVENANCE_KINDS].sort(compareStrings))) {
    fail("manifest.authority.supportedProvenanceKinds does not match the supported provenance kinds");
  }
  if (!isObject(manifest.authority.auditPolicy)) fail("manifest.authority.auditPolicy is required");
  const auditPolicy = manifest.authority.auditPolicy;
  assertExactKeys(auditPolicy, ["recordFields", "categories", "copyAllowedCategories", "userApprovalMarker"], "manifest.authority.auditPolicy");
  if (JSON.stringify(auditPolicy.recordFields) !== JSON.stringify(AUDIT_RECORD_FIELDS)) {
    fail("manifest.authority.auditPolicy.recordFields must match the audit-record shape");
  }
  if (auditPolicy.userApprovalMarker !== USER_APPROVAL_MARKER) {
    fail(`manifest.authority.auditPolicy.userApprovalMarker must be ${USER_APPROVAL_MARKER}`);
  }
  if (!Array.isArray(auditPolicy.categories) || JSON.stringify([...auditPolicy.categories].sort(compareStrings)) !== JSON.stringify([...AUDIT_CATEGORIES].sort(compareStrings))) {
    fail("manifest.authority.auditPolicy.categories must enumerate the exact audit categories");
  }
  if (!Array.isArray(auditPolicy.copyAllowedCategories) || JSON.stringify([...auditPolicy.copyAllowedCategories].sort(compareStrings)) !== JSON.stringify([...AUDIT_COPY_CATEGORIES].sort(compareStrings))) {
    fail("manifest.authority.auditPolicy.copyAllowedCategories must enumerate the exact copy categories");
  }
  if (!isObject(manifest.authority.decisionPolicy)) fail("manifest.authority.decisionPolicy is required");
  const decisionPolicy = manifest.authority.decisionPolicy;
  assertExactKeys(decisionPolicy, ["recordFields", "states", "userApprovalMarker"], "manifest.authority.decisionPolicy");
  if (JSON.stringify(decisionPolicy.recordFields) !== JSON.stringify(DECISION_FIELDS)) {
    fail("manifest.authority.decisionPolicy.recordFields must match the decision-record shape");
  }
  if (!Array.isArray(decisionPolicy.states) || JSON.stringify([...decisionPolicy.states].sort(compareStrings)) !== JSON.stringify([...DECISION_STATES].sort(compareStrings))) {
    fail("manifest.authority.decisionPolicy.states must enumerate the exact decision states");
  }
  if (decisionPolicy.userApprovalMarker !== USER_APPROVAL_MARKER) {
    fail(`manifest.authority.decisionPolicy.userApprovalMarker must be ${USER_APPROVAL_MARKER}`);
  }
  if (!Array.isArray(manifest.roots) || manifest.roots.length < 2) fail("manifest.roots must declare canonical and upstream roots");

  const manifestDirectory = path.dirname(manifestFile);
  const roots = new Map();
  for (const root of manifest.roots) {
    if (!isObject(root)) fail("every manifest root must be an object");
    const id = requiredString(root.id, "root.id");
    if (roots.has(id)) fail(`duplicate root id: ${id}`);
    requiredString(root.path, `root ${id}.path`);
    requiredString(root.role, `root ${id}.role`);
    if (root.followSymlinks !== false) fail(`root ${id} must set followSymlinks to false`);
    roots.set(id, validateRootPath(root, manifestDirectory));
  }
  const canonical = roots.get("canonical");
  const upstream = roots.get("agents-skills");
  if (!canonical || canonical.role !== "canonical-git-repository") {
    fail("root canonical must have role canonical-git-repository");
  }
  if (!upstream || upstream.role !== "upstream-read-only" || upstream.readOnly !== true) {
    fail("root agents-skills must be an upstream-read-only root");
  }
  if (canonical.absolute === upstream.absolute || contained(canonical.absolute, upstream.absolute) || contained(upstream.absolute, canonical.absolute)) {
    fail("canonical and agents-skills roots must be disjoint; equal or nested roots are forbidden");
  }
  const manifestAbsolute = validateContainedFile(canonical, manifestFile, "manifest");

  if (!isObject(manifest.metadata)) fail("manifest.metadata is required");
  let skillsLockData;
  for (const [key, expectedRoot] of [["gitTrackedState", "canonical"], ["gitignore", "canonical"], ["skillsLock", "agents-skills"]]) {
    const metadata = manifest.metadata[key];
    if (!isObject(metadata)) fail(`manifest.metadata.${key} is required`);
    if (metadata.root !== expectedRoot) fail(`manifest.metadata.${key}.root must be ${expectedRoot}`);
    safeRelative(metadata.path, `manifest.metadata.${key}.path`);
    const metadataRoot = roots.get(expectedRoot);
    const metadataAbsolute = rootEntry(metadataRoot, metadata.path, `manifest.metadata.${key}.path`);
    const metadataDisplayPath = `${expectedRoot}:${metadata.path}`;
    const stat = lstatOrMissing(metadataAbsolute, metadataDisplayPath);
    if (!stat || stat.isSymbolicLink() || !stat.isFile()) {
      fail(`manifest.metadata.${key}.path must be a non-symlink file: ${metadataDisplayPath}`);
    }
    if (key === "skillsLock") {
      skillsLockData = readJson(metadataAbsolute, "manifest-declared skills-lock.json").value;
      if (!isObject(skillsLockData) || skillsLockData.version !== 1 || !isObject(skillsLockData.skills)) {
        fail("manifest-declared skills-lock.json must use version 1 and contain a skills object");
      }
      if (!Array.isArray(metadata.records)) fail("manifest.metadata.skillsLock.records must be an array");
      const declaredRecords = new Set();
      for (const record of metadata.records) {
        requiredString(record, "manifest.metadata.skillsLock.records entry");
        if (declaredRecords.has(record) || !isObject(skillsLockData.skills[record])) {
          fail(`manifest.metadata.skillsLock.records contains an unknown or duplicate record: ${record}`);
        }
        declaredRecords.add(record);
      }
      const actualRecords = Object.keys(skillsLockData.skills).sort(compareStrings);
      if (JSON.stringify([...declaredRecords].sort(compareStrings)) !== JSON.stringify(actualRecords)) {
        fail("manifest.metadata.skillsLock.records must enumerate every lock record exactly");
      }
    }
  }

  if (!Array.isArray(manifest.protectedPaths)) fail("manifest.protectedPaths must be an array");
  if (!Array.isArray(manifest.excludedPaths)) fail("manifest.excludedPaths must be an array");
  const protectedPaths = manifest.protectedPaths.map((entry, index) => checkPathRecord(entry, `protectedPaths[${index}]`, roots));
  const excludedPaths = manifest.excludedPaths.map((entry, index) => checkPathRecord(entry, `excludedPaths[${index}]`, roots));
  checkNoOverlaps(protectedPaths, "protectedPaths");
  checkNoOverlaps(excludedPaths, "excludedPaths");
  for (const protectedPath of protectedPaths) {
    if (excludedPaths.some((excluded) => excluded.root === protectedPath.root && pathsOverlap(protectedPath.path, excluded.path))) {
      fail(`protected and excluded paths overlap: ${protectedPath.root}:${protectedPath.path}`);
    }
  }

  if (!Array.isArray(manifest.candidatePaths)) fail("manifest.candidatePaths must be an array");
  const candidates = [];
  const candidateKeys = new Set();
  const candidateSources = new Set();
  const candidateTargets = new Set();
  for (const [index, candidate] of manifest.candidatePaths.entries()) {
    const validatedCandidate = validateCandidateRecord(
      candidate,
      `candidatePaths[${index}]`,
      skillsLockData,
      manifest.metadata.skillsLock.path,
    );
    const sourcePath = validatedCandidate.sourcePath;
    const targetPath = validatedCandidate.targetPath;
    const key = `${sourcePath}->${targetPath}`;
    if (candidateKeys.has(key)) fail(`duplicate candidate mapping: ${key}`);
    if ([...candidateSources].some((existing) => pathsOverlap(existing, sourcePath))) {
      fail(`candidate source paths overlap: ${sourcePath}`);
    }
    if ([...candidateTargets].some((existing) => pathsOverlap(existing, targetPath))) {
      fail(`candidate target paths overlap: ${targetPath}`);
    }
    candidateKeys.add(key);
    candidateSources.add(sourcePath);
    candidateTargets.add(targetPath);
    if (protectedPaths.some((entry) => entry.root === "agents-skills" && pathsOverlap(sourcePath, entry.path))) {
      fail(`candidate source is protected: ${sourcePath}`);
    }
    if (excludedPaths.some((entry) => entry.root === "agents-skills" && pathsOverlap(sourcePath, entry.path))) {
      fail(`candidate source is excluded: ${sourcePath}`);
    }
    candidates.push(validatedCandidate);
  }

  if (!Array.isArray(manifest.auditRecords)) fail("manifest.auditRecords must be an array");
  const auditRecords = [];
  const auditRecordIds = new Set();
  for (const [index, record] of manifest.auditRecords.entries()) {
    const validated = validateAuditRecordShape(
      record,
      `auditRecords[${index}]`,
      auditPolicy.categories,
    );
    if (auditRecords.some((existing) => auditRecordRecordEqual(existing, validated))) {
      fail(`duplicate audit record: ${validated.recordId}`);
    }
    if (auditRecordIds.has(validated.recordId)) {
      fail(`audit record id is reused for a different record: ${validated.recordId}`);
    }
    if (!candidates.some((candidate) => candidate.sourcePath === validated.candidateSourcePath)) {
      fail(`audit record references an unlisted candidate: ${validated.candidateSourcePath}`);
    }
    auditRecordIds.add(validated.recordId);
    auditRecords.push(validated);
  }

  if (!Array.isArray(manifest.imports)) fail("manifest.imports must be an array");
  const imports = [];
  const importKeys = new Set();
  const importIds = new Set();
  for (const [index, record] of manifest.imports.entries()) {
    if (!isObject(record)) fail(`imports[${index}] must be an object`);
    const id = requiredString(record.id, `imports[${index}].id`);
    if (importIds.has(id)) fail(`duplicate import id: ${id}`);
    if (record.status !== "managed") fail(`imports[${index}].status must be managed`);
    if (record.sourceRoot !== "agents-skills" || record.targetRoot !== "canonical") {
      fail(`imports[${index}] must map agents-skills to canonical`);
    }
    const sourcePath = directChild(record.sourcePath, `imports[${index}].sourcePath`);
    const targetPath = directChild(record.targetPath, `imports[${index}].targetPath`);
    if (!/^[0-9a-f]{64}$/.test(record.lastImportedTreeHash)) {
      fail(`imports[${index}].lastImportedTreeHash must be a lowercase SHA-256 hash`);
    }
    validateImportAuthority(record, `imports[${index}]`);
    const key = `${sourcePath}->${targetPath}`;
    if (importKeys.has(key)) fail(`duplicate import record: ${key}`);
    if (!candidates.some((candidate) => candidate.sourcePath === sourcePath && candidate.targetPath === targetPath)) {
      fail(`import has no matching candidate mapping: ${key}`);
    }
    if (protectedPaths.some((entry) => entry.root === "canonical" && pathsOverlap(targetPath, entry.path))) {
      fail(`managed import target is protected: ${targetPath}`);
    }
    if (excludedPaths.some((entry) => entry.root === "canonical" && pathsOverlap(targetPath, entry.path))) {
      fail(`managed import target is excluded: ${targetPath}`);
    }
    importKeys.add(key);
    importIds.add(id);
    imports.push({ ...record, id, sourceRoot: "agents-skills", sourcePath, targetRoot: "canonical", targetPath });
  }

  if (!Array.isArray(manifest.tombstones)) fail("manifest.tombstones must be an array");
  const tombstones = [];
  const tombstoneIds = new Set();
  for (const [index, tombstone] of manifest.tombstones.entries()) {
    const validated = validateTombstoneRecord(tombstone, `tombstones[${index}]`, protectedPaths, excludedPaths);
    const id = validated.id;
    if (tombstoneIds.has(id)) fail(`duplicate tombstone id: ${id}`);
    tombstoneIds.add(id);
    tombstones.push(validated);
  }

  if (!Array.isArray(manifest.decisions)) fail("manifest.decisions must be an array");
  const decisions = [];
  const decisionIds = new Set();
  const decisionPaths = new Set();
  for (const [index, record] of manifest.decisions.entries()) {
    const decision = validateDecisionRecord(record, `decisions[${index}]`);
    if (decisionIds.has(decision.id)) fail(`duplicate decision id: ${decision.id}`);
    if (decisionPaths.has(decision.sourcePath)) fail(`duplicate decision source path: ${decision.sourcePath}`);
    if (candidates.some((candidate) => candidate.sourcePath === decision.sourcePath)) {
      fail(`decision cannot coexist with a candidate mapping: ${decision.sourcePath}`);
    }
    if (decision.state === "EXCLUDED" && protectedPaths.some((entry) => entry.root === "agents-skills" && pathsOverlap(decision.sourcePath, entry.path))) {
      fail(`excluded decision conflicts with a protected source path: ${decision.sourcePath}`);
    }
    if (decision.state === "PROTECTED" && excludedPaths.some((entry) => entry.root === "agents-skills" && pathsOverlap(decision.sourcePath, entry.path))) {
      fail(`protected decision conflicts with an excluded source path: ${decision.sourcePath}`);
    }
    if ([...importKeys].some((key) => key.startsWith(`${decision.sourcePath}->`) || key.endsWith(`->${decision.sourcePath}`))) {
      fail(`decision cannot coexist with a managed import: ${decision.sourcePath}`);
    }
    decisionIds.add(decision.id);
    decisionPaths.add(decision.sourcePath);
    decisions.push(decision);
  }

  const protectedSet = protectedPaths;
  const excludedSet = excludedPaths;
  const importByKey = new Map(imports.map((record) => [recordKey(record.sourceRoot, record.sourcePath), record]));
  const decisionByPath = new Map(decisions.map((record) => [record.sourcePath, record]));
  const manifestSha256 = digestBytes(Buffer.from(raw, "utf8"));

  return {
    manifest,
    manifestFile: manifestAbsolute,
    manifestRaw: raw,
    manifestSha256,
    roots,
    protectedPaths: protectedSet,
    excludedPaths: excludedSet,
    candidates,
    imports,
    tombstones,
    decisions,
    decisionByPath,
    auditRecords,
    auditPolicy,
    skillsLockData,
    skillsLockMetadataPath: manifest.metadata.skillsLock.path,
    importByKey,
  };
}

function matchingPath(records, rootId, relative) {
  return records
    .filter((record) => record.root === rootId && pathsOverlap(relative, record.path))
    .sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}

function pathAuthority(context, rootId, relative) {
  return {
    protected: matchingPath(context.protectedPaths, rootId, relative),
    excluded: matchingPath(context.excludedPaths, rootId, relative),
  };
}

function validatePlanCandidate(context, record, label) {
  const candidate = validateCandidateRecord(record, label, context.skillsLockData, context.skillsLockMetadataPath);
  const sourceOverlap = context.candidates.find((existing) => pathsOverlap(existing.sourcePath, candidate.sourcePath));
  if (sourceOverlap) fail(`${label}.sourcePath overlaps an existing candidate: ${sourceOverlap.sourcePath}`);
  const targetOverlap = context.candidates.find((existing) => pathsOverlap(existing.targetPath, candidate.targetPath));
  if (targetOverlap) fail(`${label}.targetPath overlaps an existing candidate: ${targetOverlap.targetPath}`);
  if (context.protectedPaths.some((entry) => entry.root === "agents-skills" && pathsOverlap(candidate.sourcePath, entry.path))) {
    fail(`${label}.sourcePath is protected: ${candidate.sourcePath}`);
  }
  if (context.excludedPaths.some((entry) => entry.root === "agents-skills" && pathsOverlap(candidate.sourcePath, entry.path))) {
    fail(`${label}.sourcePath is excluded: ${candidate.sourcePath}`);
  }
  if (context.protectedPaths.some((entry) => entry.root === "canonical" && pathsOverlap(candidate.targetPath, entry.path))) {
    fail(`${label}.targetPath is protected: ${candidate.targetPath}`);
  }
  if (context.excludedPaths.some((entry) => entry.root === "canonical" && pathsOverlap(candidate.targetPath, entry.path))) {
    fail(`${label}.targetPath is excluded: ${candidate.targetPath}`);
  }
  if (context.decisionByPath.has(candidate.sourcePath)) {
    fail(`${label}.sourcePath has a persisted EXCLUDED or PROTECTED decision: ${candidate.sourcePath}`);
  }
  return candidate;
}

function appendContextPath(base, relative) {
  if (typeof base !== "string" || relative.length === 0) return base;
  return base === "." ? relative : `${base}/${relative}`;
}

function hashDirectory(directory, context = {}, relative = "") {
  const rootContext = {
    ...context,
    sourcePath: appendContextPath(context.sourcePath, relative),
    targetPath: appendContextPath(context.targetPath, relative),
    phase: context.phase ?? "hashing",
  };
  const rootStat = nativeFs(() => fs.lstatSync(directory), rootContext);
  if (rootStat.isSymbolicLink()) fail(`forbidden symlink encountered while hashing: ${relative || "."}`);
  if (!rootStat.isDirectory()) fail(`unsupported filesystem entry while hashing: ${relative || "."}`);
  const rootMode = rootStat.mode & 0o7777;
  const entries = [];

  function visit(current, relative) {
    const currentContext = {
      ...context,
      sourcePath: appendContextPath(context.sourcePath, relative),
      targetPath: appendContextPath(context.targetPath, relative),
    };
    const children = nativeFs(
      () => fs.readdirSync(current, { withFileTypes: true }),
      { ...currentContext, phase: context.phase ?? "hashing" },
    ).sort((a, b) => compareStrings(a.name, b.name));
    for (const child of children) {
      const childPath = path.join(current, child.name);
      const childRelative = relative ? `${relative}/${child.name}` : child.name;
      const childContext = {
        ...context,
        sourcePath: appendContextPath(context.sourcePath, childRelative),
        targetPath: appendContextPath(context.targetPath, childRelative),
        phase: context.phase ?? "hashing",
      };
      const stat = nativeFs(() => fs.lstatSync(childPath), childContext);
      if (stat.isSymbolicLink()) fail(`forbidden symlink encountered while hashing: ${childRelative}`);
      if (stat.isDirectory()) {
        entries.push({ type: "directory", path: childRelative, mode: stat.mode & 0o7777 });
        visit(childPath, childRelative);
      } else if (stat.isFile()) {
        entries.push({
          type: "file",
          path: childRelative,
          mode: stat.mode & 0o7777,
          size: stat.size,
          sha256: digestFile(childPath, childContext),
        });
      } else {
        fail(`unsupported filesystem entry while hashing: ${childRelative}`);
      }
    }
  }

  visit(directory, relative);
  const hasher = crypto.createHash(HASH_ALGORITHM);
  hasher.update("skills-tree-v1\n");
  // The tree hash is relevant root metadata plus the deterministic descendant tree.
  hasher.update(`root-mode:${rootMode}\n`);
  for (const entry of entries) hasher.update(`${JSON.stringify(entry)}\n`);
  return {
    treeHash: hasher.digest("hex"),
    fileCount: entries.filter((entry) => entry.type === "file").length,
    entryCount: entries.length,
  };
}

function inspectPath(context, rootId, relative, options = {}) {
  const root = context.roots.get(rootId);
  if (!root) fail(`unknown root: ${rootId}`);
  safeRelative(relative, `${rootId} path`);
  let current = root.absolute;
  const parts = relative.split("/");
  for (const [index, part] of parts.entries()) {
    current = rootEntry(root, path.join(...parts.slice(0, index + 1)), `${rootId} path`);
    const displayPath = `${rootId}:${parts.slice(0, index + 1).join("/")}`;
    const stat = lstatOrMissing(current, displayPath);
    if (!stat) return { kind: "missing", missingAt: parts.slice(0, index + 1).join("/") };
    const isLast = index === parts.length - 1;
    if (stat.isSymbolicLink()) {
      if (options.allowSymlink && isLast) return { kind: "symlink", mode: stat.mode & 0o7777 };
      fail(`forbidden symlink at ${rootId}:${parts.slice(0, index + 1).join("/")}`);
    }
    if (!isLast && !stat.isDirectory()) {
      return { kind: "invalid-path", at: parts.slice(0, index + 1).join("/") };
    }
    if (isLast) {
      if (stat.isDirectory()) {
        if (options.hashDirectories === false) return { kind: "directory", mode: stat.mode & 0o7777 };
        const inspectionContext = rootId === "agents-skills"
          ? { sourceRoot: rootId, sourcePath: relative, phase: "hashing" }
          : { targetRoot: rootId, targetPath: relative, phase: "hashing" };
        return { kind: "directory", mode: stat.mode & 0o7777, ...hashDirectory(current, inspectionContext) };
      }
      if (stat.isFile()) {
        const inspectionContext = rootId === "agents-skills"
          ? { sourceRoot: rootId, sourcePath: relative, phase: "hashing" }
          : { targetRoot: rootId, targetPath: relative, phase: "hashing" };
        return { kind: "file", mode: stat.mode & 0o7777, size: stat.size, sha256: digestFile(current, inspectionContext) };
      }
      return { kind: "unsupported", mode: stat.mode & 0o7777 };
    }
  }
  fail(`cannot inspect empty path: ${rootId}:${relative}`);
}

function inspectSummary(snapshot) {
  if (snapshot.kind === "directory") {
    const result = { kind: snapshot.kind, mode: snapshot.mode };
    if (snapshot.treeHash) {
      result.treeHash = snapshot.treeHash;
      result.fileCount = snapshot.fileCount;
      result.entryCount = snapshot.entryCount;
    }
    return result;
  }
  return { ...snapshot };
}

function relationFor(source, target) {
  if (source.kind === "missing" && target.kind === "missing") return "both-missing";
  if (source.kind === "missing") return "source-missing";
  if (target.kind === "missing") return "target-missing";
  if (source.kind !== target.kind) return "type-different";
  if (source.kind === "directory" && target.kind === "directory" && source.treeHash === target.treeHash) return "equal";
  if (source.kind === "file" && target.kind === "file" && source.sha256 === target.sha256) return "equal";
  return "different";
}

function scanUnlistedSource(context) {
  const source = context.roots.get("agents-skills");
  const candidateSources = new Set(context.candidates.map((candidate) => candidate.sourcePath));
  const decisionSources = new Set(context.decisions.map((decision) => decision.sourcePath));
  const unlisted = [];
  const children = nativeFs(
    () => fs.readdirSync(source.absolute, { withFileTypes: true }),
    { sourceRoot: "agents-skills", sourcePath: ".", phase: "scan upstream" },
  ).sort((a, b) => compareStrings(a.name, b.name));
  for (const child of children) {
    const relative = child.name;
    const authority = pathAuthority(context, "agents-skills", relative);
    if (candidateSources.has(relative) || decisionSources.has(relative) || authority.protected || authority.excluded) continue;
    const stat = nativeFs(
      () => fs.lstatSync(path.join(source.absolute, child.name)),
      { sourceRoot: "agents-skills", sourcePath: relative, phase: "scan upstream" },
    );
    if (stat.isSymbolicLink()) fail(`unlisted upstream symlink is forbidden: agents-skills:${relative}`);
    unlisted.push({ path: relative, kind: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "unsupported" });
  }
  return unlisted;
}

function inspectDecisionSource(context, decision) {
  const label = `decision source ${decision.sourcePath}`;
  try {
    const source = inspectPath(context, "agents-skills", decision.sourcePath);
    if (source.kind !== "directory") {
      return { source, valid: false, reason: `source is not a directory: ${source.kind}` };
    }
    if (!hasNonSymlinkSkillFile(context, decision.sourcePath)) {
      return { source, valid: false, reason: "source has no non-symlink SKILL.md" };
    }
    return { source, valid: true, reason: null };
  } catch (error) {
    if (error instanceof SyncError) {
      return { source: { kind: "invalid-path" }, valid: false, reason: error.message };
    }
    fail(`cannot inspect ${label}: ${errorDetail(error, { phase: "inspect", sourceRoot: "agents-skills", sourcePath: decision.sourcePath })}`);
  }
}

function decisionObservations(context) {
  return [...context.decisions]
    .sort((left, right) => compareStrings(left.sourcePath, right.sourcePath))
    .map((decision) => {
      const inspected = inspectDecisionSource(context, decision);
      const sourceTreeHash = inspected.valid ? inspected.source.treeHash : null;
      const decisionHashMatches = inspected.valid && sourceTreeHash === decision.sourceTreeHash;
      return {
        sourceRoot: "agents-skills",
        sourcePath: decision.sourcePath,
        state: `UPSTREAM + ${decision.state}`,
        source: inspectSummary(inspected.source),
        sourceTreeHash,
        decisionHashMatches,
        staleDecision: !decisionHashMatches,
        reason: inspected.reason,
        decision,
      };
    });
}

function dryRun(context) {
  const decisionObservationList = decisionObservations(context);
  const comparisons = [...context.candidates]
    .sort((a, b) => compareStrings(a.sourcePath, b.sourcePath))
    .map((candidate) => {
      const source = inspectPath(context, candidate.sourceRoot, candidate.sourcePath);
      const target = inspectPath(context, candidate.targetRoot, candidate.targetPath);
      const imported = context.importByKey.get(recordKey(candidate.sourceRoot, candidate.sourcePath)) ?? null;
      const targetAuthority = pathAuthority(context, candidate.targetRoot, candidate.targetPath);
      const sourceAuthority = pathAuthority(context, candidate.sourceRoot, candidate.sourcePath);
      const sourceHash = source.kind === "directory" ? source.treeHash : null;
      const targetHash = target.kind === "directory" ? target.treeHash : null;
      return {
        sourceRoot: candidate.sourceRoot,
        sourcePath: candidate.sourcePath,
        targetRoot: candidate.targetRoot,
        targetPath: candidate.targetPath,
        relation: relationFor(source, target),
        source: inspectSummary(source),
        target: inspectSummary(target),
        lastImportedTreeHash: imported?.lastImportedTreeHash ?? null,
        sourceChangedSinceImport: imported ? sourceHash !== imported.lastImportedTreeHash : null,
        targetChangedSinceImport: imported ? targetHash !== imported.lastImportedTreeHash : null,
        sourceAuthority: sourceAuthority.protected ? "protected" : sourceAuthority.excluded ? "excluded" : "candidate",
        targetAuthority: targetAuthority.protected ? "protected" : targetAuthority.excluded ? "excluded" : imported ? "managed" : "candidate",
        provenance: candidate.provenance,
      };
    });

  const protectedObservations = [...context.protectedPaths]
    .sort((a, b) => compareStrings(recordKey(a.root, a.path), recordKey(b.root, b.path)))
    .map((entry) => ({ ...entry, snapshot: inspectSummary(inspectPath(context, entry.root, entry.path)) }));
  const excludedObservations = [...context.excludedPaths]
    .sort((a, b) => compareStrings(recordKey(a.root, a.path), recordKey(b.root, b.path)))
    .map((entry) => ({ ...entry, snapshot: inspectSummary(inspectPath(context, entry.root, entry.path, { allowSymlink: true, hashDirectories: false })) }));
  const tombstoneObservations = [...context.tombstones]
    .sort((a, b) => compareStrings(a.id, b.id))
    .map((entry) => ({
      ...entry,
      source: inspectSummary(inspectPath(context, entry.sourceRoot, entry.sourcePath)),
      target: inspectSummary(inspectPath(context, entry.targetRoot, entry.targetPath)),
    }));

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: "skills-curator-dry-run",
    mode: "dry-run",
    manifestSha256: context.manifestSha256,
    hashAlgorithm: HASH_ALGORITHM,
    hashScope: TREE_HASH_SCOPE,
    roots: [...context.roots.values()].map((root) => ({ id: root.id, path: root.path, role: root.role, readOnly: root.readOnly === true })),
    comparisons,
    protectedPaths: protectedObservations,
    excludedPaths: excludedObservations,
    unlistedSourcePaths: scanUnlistedSource(context),
    tombstones: tombstoneObservations,
    decisions: context.decisions,
    decisionObservations: decisionObservationList,
    staleDecisions: decisionObservationList.filter((observation) => observation.staleDecision),
    operations: [],
  };
}

function discoveryCandidate(context, relative) {
  let source;
  try {
    source = inspectPath(context, "agents-skills", relative);
  } catch (error) {
    if (error instanceof SyncError && /forbidden symlink|unsupported filesystem entry/.test(error.message)) {
      return { accepted: false, reason: error.message, source: { kind: "rejected" } };
    }
    throw error;
  }
  if (source.kind !== "directory") return { accepted: false, reason: "source is not a directory", source };
  if (!hasNonSymlinkSkillFile(context, relative)) {
    return { accepted: false, reason: "direct source directory has no non-symlink SKILL.md", source };
  }
  return { accepted: true, source };
}

function rootStatSnapshot(stat) {
  return {
    kind: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "unsupported",
    mode: stat.mode & 0o7777,
  };
}

function hasNonSymlinkSkillFile(context, relative) {
  const skillFile = rootEntry(context.roots.get("agents-skills"), `${relative}/SKILL.md`, `skill file ${relative}`);
  const skillStat = lstatOrMissing(skillFile);
  return Boolean(skillStat && !skillStat.isSymbolicLink() && skillStat.isFile());
}

function discoverPending(context) {
  const sourceRoot = context.roots.get("agents-skills");
  const states = [];
  const pending = [];
  const rejectedPaths = [];
  const decisionObservationList = decisionObservations(context);
  const decisionObservationByPath = new Map(decisionObservationList.map((observation) => [observation.sourcePath, observation]));
  const entries = nativeFs(
    () => fs.readdirSync(sourceRoot.absolute, { withFileTypes: true }),
    { sourceRoot: "agents-skills", sourcePath: ".", phase: "discover pending" },
  ).sort((left, right) => compareStrings(left.name, right.name));

  for (const entry of entries) {
    const relative = directChild(entry.name, `discovery source path ${entry.name}`);
    const authority = pathAuthority(context, "agents-skills", relative);
    const decision = context.decisionByPath.get(relative) ?? null;
    const stat = lstatOrMissing(path.join(sourceRoot.absolute, entry.name), `agents-skills:${relative}`);
    if (!stat) continue;
    if (stat.isSymbolicLink()) {
      if (authority.protected || authority.excluded || decision) {
        rejectedPaths.push({ path: relative, kind: "symlink", reason: "protected or excluded symlink is not an auditable skill" });
        continue;
      }
      fail(`discovery encountered an unapproved upstream symlink: agents-skills:${relative}`);
    }
    const restrictedState = decision
      ? null
      : authority.protected
        ? "PROTECTED"
        : authority.excluded
          ? "EXCLUDED"
          : null;
    // Manifest authority is deterministic; restricted roots receive root-level stat evidence only.
    const candidate = restrictedState
      ? { accepted: true, source: rootStatSnapshot(stat) }
      : discoveryCandidate(context, relative);
    if (!candidate.accepted) {
      rejectedPaths.push({ path: relative, kind: candidate.source.kind, reason: candidate.reason });
      continue;
    }

    const mapping = context.candidates.find((record) => record.sourcePath === relative) ?? null;
    const imported = context.importByKey.get(recordKey("agents-skills", relative)) ?? null;
    const targetPath = mapping?.targetPath ?? imported?.targetPath ?? null;
    const targetAuthority = targetPath ? pathAuthority(context, "canonical", targetPath) : { protected: null, excluded: null };
    const targetIsRestricted = Boolean(targetAuthority.protected || targetAuthority.excluded);
    const target = targetPath && !restrictedState
      ? inspectPath(context, "canonical", targetPath, {
        allowSymlink: targetIsRestricted,
        hashDirectories: !targetIsRestricted,
      })
      : null;
    const decisionObservation = decisionObservationByPath.get(relative) ?? null;
    const decisionHashMatches = decisionObservation?.decisionHashMatches ?? null;
    let state;
    if (decision) {
      state = `UPSTREAM + ${decision.state}`;
    } else if (restrictedState) {
      state = `UPSTREAM + ${restrictedState}`;
    } else if (authority.protected) {
      state = "UPSTREAM + PROTECTED";
    } else if (authority.excluded) {
      state = "UPSTREAM + EXCLUDED";
    } else if (targetAuthority.protected) {
      state = "UPSTREAM + PROTECTED";
    } else if (targetAuthority.excluded) {
      state = "UPSTREAM + EXCLUDED";
    } else if (imported) {
      state = "UPSTREAM + IMPORTED";
    } else {
      state = "UPSTREAM + PENDING";
    }
    const targetAuthorityRecord = targetAuthority.protected ?? targetAuthority.excluded;
    const targetAuthorityState = targetAuthority.protected
      ? "protected"
      : targetAuthority.excluded
        ? "excluded"
        : imported
          ? "managed"
          : targetPath
            ? "candidate"
            : null;
    const observation = {
      state,
      sourceRoot: "agents-skills",
      sourcePath: relative,
      sourceTreeHash: restrictedState ? null : candidate.source.treeHash,
      sourceAuthority: authority.protected ? "protected" : authority.excluded ? "excluded" : decision ? decision.state.toLowerCase() : "candidate",
      targetRoot: mapping?.targetRoot ?? imported?.targetRoot ?? (targetPath ? "canonical" : null),
      targetPath,
      targetTreeHash: target?.kind === "directory" ? target.treeHash : null,
      target: target ? inspectSummary(target) : null,
      targetAuthority: targetAuthorityState,
      targetAuthorityEvidence: targetAuthorityRecord
        ? { root: "canonical", path: targetAuthorityRecord.path, state: targetAuthorityState, reason: targetAuthorityRecord.reason }
        : null,
      provenance: mapping ? "MAPPED" : "UNRESOLVED",
      mapping: mapping ? { sourcePath: mapping.sourcePath, targetPath: mapping.targetPath, provenance: mapping.provenance } : null,
      importId: imported?.id ?? null,
      decision: decision ?? null,
      decisionHashMatches,
      staleDecision: Boolean(decision && !decisionHashMatches),
    };
    states.push(observation);
    if (state === "UPSTREAM + PENDING") pending.push(observation);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: "skills-curator-pending-discovery",
    mode: "discover-pending",
    manifestSha256: context.manifestSha256,
    hashAlgorithm: HASH_ALGORITHM,
    hashScope: TREE_HASH_SCOPE,
    sourceRoot: { id: "agents-skills", path: sourceRoot.path, role: sourceRoot.role, readOnly: true },
    states,
    pending,
    rejectedPaths,
    decisions: context.decisions,
    decisionObservations: decisionObservationList,
    staleDecisions: decisionObservationList.filter((observation) => observation.staleDecision),
  };
}

function assertTargetParent(context, relative) {
  const parent = path.posix.dirname(relative);
  if (parent === ".") return;
  const snapshot = inspectPath(context, "canonical", parent, { hashDirectories: false });
  if (snapshot.kind !== "directory") fail(`target parent is not an existing directory: canonical:${parent}`);
}

function assertNoTargetOverlap(operations) {
  const targets = operations
    .filter((operation) => operation.targetPath !== null)
    .map((operation) => operation.targetPath)
    .sort(compareStrings);
  for (let leftIndex = 0; leftIndex < targets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < targets.length; rightIndex += 1) {
      if (pathsOverlap(targets[leftIndex], targets[rightIndex])) {
        fail(`approved operations overlap target paths: ${targets[leftIndex]} and ${targets[rightIndex]}`);
      }
    }
  }
}

function assertOperationManifestState(context, operation, phase) {
  const label = `${phase} ${operation.operationId}`;
  if (operation.operation === "record-decision") {
    const currentCandidate = context.candidates.find((candidate) => candidate.sourcePath === operation.sourcePath) ?? null;
    if (Boolean(currentCandidate) !== Boolean(operation.existingCandidate)) {
      fail(`${label}: candidate mapping changed before mutation`);
    }
    if (currentCandidate && !candidateMappingEqual(currentCandidate, operation.existingCandidate)) {
      fail(`${label}: candidate mapping changed before mutation`);
    }
    const currentDecision = context.decisionByPath.get(operation.sourcePath) ?? null;
    if (Boolean(currentDecision) !== Boolean(operation.existingDecision)) {
      fail(`${label}: decision state changed before mutation`);
    }
    if (currentDecision && !decisionRecordEqual(currentDecision, operation.existingDecision)) {
      fail(`${label}: decision evidence changed before mutation`);
    }
    if (context.importByKey.has(recordKey("agents-skills", operation.sourcePath))) {
      fail(`${label}: managed import appeared before mutation`);
    }
    return;
  }

  const currentCandidate = context.candidates.find((candidate) => candidate.sourcePath === operation.sourcePath && candidate.targetPath === operation.targetPath) ?? null;
  if (operation.candidateIsNew) {
    if (currentCandidate) fail(`${label}: proposed candidate mapping appeared before mutation`);
  } else if (!currentCandidate || !candidateMappingEqual(currentCandidate, operation.candidate)) {
    fail(`${label}: candidate mapping changed before mutation`);
  }
  const currentImport = context.importByKey.get(recordKey("agents-skills", operation.sourcePath)) ?? null;
  if (operation.operation === "copy" && currentImport) fail(`${label}: managed import appeared before copy`);
  if (operation.operation !== "copy") {
    if (!currentImport || currentImport.id !== operation.importRecord.id || currentImport.lastImportedTreeHash !== operation.importRecord.lastImportedTreeHash) {
      fail(`${label}: managed import changed before mutation`);
    }
  }
}

function assertSourceSnapshot(context, operation, phase) {
  const label = `${phase} ${operation.operationId} source`;
  const source = inspectPath(context, "agents-skills", operation.sourcePath);
  if (operation.operation === "delete") {
    if (source.kind !== "missing") fail(`${label} must be absent`);
    return source;
  }
  if (source.kind !== "directory" || !hasNonSymlinkSkillFile(context, operation.sourcePath)) {
    fail(`${label} must be a direct non-symlink skill directory`);
  }
  if (source.treeHash !== operation.expectedSourceTreeHash) {
    fail(`${label} hash changed: expected ${operation.expectedSourceTreeHash}, got ${source.treeHash}`);
  }
  return source;
}

function assertTargetSnapshot(context, operation, phase, staged = false) {
  if (operation.operation === "record-decision") return null;
  const authority = pathAuthority(context, "canonical", operation.targetPath);
  if (authority.protected || authority.excluded) {
    fail(`${phase} ${operation.operationId} targets a protected or excluded path: canonical:${operation.targetPath}`);
  }
  const target = inspectPath(context, "canonical", operation.targetPath);
  if (operation.operation === "copy") {
    if (staged) {
      if (target.kind !== "directory" || target.treeHash !== operation.expectedSourceTreeHash) {
        fail(`${phase} ${operation.operationId} staged target does not match the source hash`);
      }
    } else if (target.kind !== "missing") {
      fail(`${phase} ${operation.operationId} target must be absent`);
    }
    return target;
  }
  if (operation.operation === "replace") {
    const expectedHash = staged ? operation.expectedSourceTreeHash : operation.expectedTargetTreeHash;
    if (target.kind !== "directory" || target.treeHash !== expectedHash) {
      fail(`${phase} ${operation.operationId} target hash changed`);
    }
    return target;
  }
  if (staged) {
    if (target.kind !== "missing") fail(`${phase} ${operation.operationId} delete target must be absent after staging`);
  } else if (target.kind !== "directory" || target.treeHash !== operation.expectedTargetTreeHash) {
    fail(`${phase} ${operation.operationId} delete target hash changed`);
  }
  return target;
}

function assertOperationBeforeMutation(context, operation, phase) {
  assertOperationManifestState(context, operation, phase);
  assertSourceSnapshot(context, operation, phase);
  assertTargetSnapshot(context, operation, phase);
}

function assertStagedOperation(context, operation, phase) {
  assertOperationManifestState(context, operation, phase);
  assertSourceSnapshot(context, operation, phase);
  assertTargetSnapshot(context, operation, phase, true);
}

function validateManagedImportRecord(record, label) {
  if (!isObject(record)) fail(`${label} must be an object`);
  assertExactKeys(
    record,
    ["id", "sourceRoot", "sourcePath", "targetRoot", "targetPath", "status", "lastImportedTreeHash", "authority"],
    label,
  );
  requiredString(record.id, `${label}.id`);
  if (record.sourceRoot !== "agents-skills" || record.targetRoot !== "canonical") {
    fail(`${label} must map agents-skills to canonical`);
  }
  directChild(record.sourcePath, `${label}.sourcePath`);
  directChild(record.targetPath, `${label}.targetPath`);
  if (record.status !== "managed") fail(`${label}.status must be managed`);
  if (!/^[0-9a-f]{64}$/.test(record.lastImportedTreeHash)) {
    fail(`${label}.lastImportedTreeHash must be a lowercase SHA-256 hash`);
  }
  validateImportAuthority(record, label);
  return record;
}

function validateApprovalEvidence(context, approval, operationId, decisionId, label) {
  if (!isObject(approval)) fail(`${label} must be an object`);
  assertExactKeys(approval, ["approved", "marker", "decisionId", "operationId"], label);
  if (approval.approved !== true) fail(`${label}.approved must be true`);
  if (approval.marker !== context.auditPolicy.userApprovalMarker) {
    fail(`${label}.marker must be ${context.auditPolicy.userApprovalMarker}`);
  }
  if (approval.decisionId !== decisionId) fail(`${label}.decisionId must match the top-level user approval`);
  if (approval.operationId !== operationId) fail(`${label}.operationId must match the operation id`);
}

function validateManifestUpdate(context, update, operation, decisionId, label) {
  if (!isObject(update)) fail(`${label} must be an object`);
  assertExactKeys(update, MANIFEST_UPDATE_FIELDS, label);
  if (update.operationId !== operation.operationId) fail(`${label}.operationId does not match its operation`);
  validateApprovalEvidence(context, update.approval, operation.operationId, decisionId, `${label}.approval`);
  if (update.expectedSourceTreeHash !== operation.expectedSourceTreeHash) {
    fail(`${label}.expectedSourceTreeHash must match the operation`);
  }
  if (update.expectedTargetTreeHash !== operation.expectedTargetTreeHash) {
    fail(`${label}.expectedTargetTreeHash must match the operation`);
  }
  if (typeof update.removeCandidate !== "boolean") fail(`${label}.removeCandidate must be boolean`);
  if (typeof update.replaceDecision !== "boolean") fail(`${label}.replaceDecision must be boolean`);

  const expectedAction = {
    copy: "add-import",
    replace: "update-import",
    delete: "remove-import",
    "record-decision": "record-decision",
  }[operation.operation];
  if (update.action !== expectedAction) fail(`${label}.action must be ${expectedAction}`);
  const importKey = recordKey("agents-skills", operation.sourcePath);
  const existing = context.importByKey.get(importKey) ?? null;

  if (update.action === "add-import") {
    if (update.removeCandidate !== false || update.replaceDecision !== false) {
      fail(`${label}.removeCandidate and replaceDecision must be false for add-import`);
    }
    if (update.tombstoneId !== null) fail(`${label}.tombstoneId must be null for add-import`);
    if (update.tombstoneRecord !== null) fail(`${label}.tombstoneRecord must be null for add-import`);
    if (update.decisionRecord !== null) fail(`${label}.decisionRecord must be null for add-import`);
    if (existing) fail(`${label} cannot add an import that already exists`);
    if (operation.candidateIsNew) {
      if (update.candidateRecord === null) fail(`${label}.candidateRecord is required for a first-time candidate import`);
      const candidate = validatePlanCandidate(context, update.candidateRecord, `${label}.candidateRecord`);
      if (!candidateMappingEqual(candidate, operation.candidate)) {
        fail(`${label}.candidateRecord must match the operation candidate mapping`);
      }
    } else if (update.candidateRecord !== null) {
      fail(`${label}.candidateRecord must be null for an existing candidate mapping`);
    }
    const requiresAudit = operation.candidate.provenance.kind === "manifest-candidate" && operation.candidate.provenance.requiresAudit === true;
    if (requiresAudit) {
      const storedAuditRecord = findReusableAuditRecord(
        context,
        operation.sourcePath,
        operation.source.treeHash,
        `${label}.auditRecord`,
      );
      const auditRecord = validateAuditRecordShape(operation.auditRecord, `${label}.operation.auditRecord`, context.auditPolicy.copyAllowedCategories);
      if (storedAuditRecord) {
        requireStoredAuditRecord(context, auditRecord, `${label}.operation.auditRecord`);
        if (update.auditRecord !== null) {
          fail(`${label}.auditRecord must be null when the candidate source already has a stored audit receipt`);
        }
      } else {
        const freshAuditRecord = validateAuditRecordShape(
          update.auditRecord,
          `${label}.auditRecord`,
          context.auditPolicy.copyAllowedCategories,
        );
        if (!auditRecordRecordEqual(freshAuditRecord, auditRecord)) {
          fail(`${label}.auditRecord must match the operation audit record`);
        }
        if (context.auditRecords.some((record) => record.recordId === auditRecord.recordId)) {
          fail(`${label}.auditRecord.recordId already exists in the current manifest`);
        }
        if (auditRecord.manifestSha256 !== context.manifestSha256) {
          fail(`${label}.auditRecord.manifestSha256 must match the current manifest for a fresh receipt`);
        }
      }
      if (auditRecord.candidateSourcePath !== operation.sourcePath) {
        fail(`${label}.operation.auditRecord.candidateSourcePath must match the candidate source path`);
      }
      if (auditRecord.sourceTreeHash !== operation.source.treeHash) {
        fail(`${label}.operation.auditRecord.sourceTreeHash must match the current source tree hash`);
      }
    } else {
      if (operation.auditRecord !== undefined) {
        fail(`copy carries an audit record for a candidate that does not require one: ${operation.sourcePath}`);
      }
      if (update.auditRecord !== null) {
        fail(`${label}.auditRecord must be null for a candidate that does not require one`);
      }
    }
    const record = validateManagedImportRecord(update.importRecord, `${label}.importRecord`);
    if (record.sourcePath !== operation.sourcePath || record.targetPath !== operation.targetPath) {
      fail(`${label}.importRecord mapping must match the operation`);
    }
    if (record.lastImportedTreeHash !== operation.source.treeHash) {
      fail(`${label}.importRecord.lastImportedTreeHash must match the source tree hash`);
    }
    if (context.imports.some((candidate) => candidate.id === record.id)) {
      fail(`${label}.importRecord.id already exists in the current manifest`);
    }
    return update;
  }

  if (update.candidateRecord !== null) fail(`${label}.candidateRecord must be null for ${update.action}`);
  if (update.auditRecord !== null) fail(`${label}.auditRecord must be null for ${update.action}`);
  if (update.action !== "remove-import" && update.tombstoneRecord !== null) {
    fail(`${label}.tombstoneRecord must be null for ${update.action}`);
  }
  if (update.action !== "record-decision" && (update.removeCandidate !== false || update.replaceDecision !== false)) {
    fail(`${label}.removeCandidate and replaceDecision must be false for ${update.action}`);
  }

  if (update.action === "update-import") {
    if (update.tombstoneId !== null) fail(`${label}.tombstoneId must be null for update-import`);
    if (update.tombstoneRecord !== null) fail(`${label}.tombstoneRecord must be null for update-import`);
    if (update.decisionRecord !== null) fail(`${label}.decisionRecord must be null for update-import`);
    if (!existing) fail(`${label} requires an existing managed import`);
    const record = validateManagedImportRecord(update.importRecord, `${label}.importRecord`);
    if (record.id !== existing.id || record.sourcePath !== operation.sourcePath || record.targetPath !== operation.targetPath) {
      fail(`${label}.importRecord identity and mapping must match the current import and operation`);
    }
    if (record.lastImportedTreeHash !== operation.source.treeHash) {
      fail(`${label}.importRecord.lastImportedTreeHash must match the source tree hash`);
    }
    return update;
  }

  if (update.action === "record-decision") {
    const existingCandidate = context.candidates.find((candidate) => candidate.sourcePath === operation.sourcePath) ?? null;
    const existingDecision = context.decisionByPath.get(operation.sourcePath) ?? null;
    if (update.removeCandidate !== Boolean(existingCandidate)) {
      fail(`${label}.removeCandidate must match the current candidate mapping state`);
    }
    if (update.replaceDecision !== Boolean(existingDecision)) {
      fail(`${label}.replaceDecision must match the current decision state`);
    }
    if (existingDecision && decisionRecordEqual(existingDecision, operation.decisionRecord)) {
      fail(`${label}.decisionRecord is an exact duplicate of the current decision`);
    }
    if (existingDecision && !decisionReplacementDiffers(existingDecision, operation.decisionRecord)) {
      fail(`${label}.decisionRecord replacement does not change decision evidence`);
    }
    if (update.tombstoneId !== null) fail(`${label}.tombstoneId must be null for record-decision`);
    if (update.tombstoneRecord !== null) fail(`${label}.tombstoneRecord must be null for record-decision`);
    if (update.importRecord !== null) fail(`${label}.importRecord must be null for record-decision`);
    if (!operation.decisionRecord) fail(`${label} requires the operation decision record`);
    const decision = validateDecisionRecord(update.decisionRecord, `${label}.decisionRecord`);
    if (!decisionRecordEqual(decision, operation.decisionRecord)) {
      fail(`${label}.decisionRecord must match the operation decision record`);
    }
    return update;
  }

  if (update.importRecord !== null) fail(`${label}.importRecord must be null for remove-import`);
  if (update.decisionRecord !== null) fail(`${label}.decisionRecord must be null for remove-import`);
  if (!existing) fail(`${label} requires an existing managed import`);
  if (update.tombstoneId !== operation.tombstoneId) fail(`${label}.tombstoneId must retain the approved delete tombstone`);
  const tombstone = operation.tombstoneId === null
    ? null
    : context.tombstones.find((candidate) => candidate.id === update.tombstoneId) ?? null;
  if (tombstone) {
    if (update.tombstoneRecord !== null) fail(`${label}.tombstoneRecord must be null when retaining an existing tombstone`);
    if (tombstone.sourcePath !== operation.sourcePath || tombstone.targetPath !== operation.targetPath) {
      fail(`${label}.tombstoneId must reference the exact approved tombstone`);
    }
  } else {
    if (operation.tombstoneId !== null) fail(`${label}.tombstoneId must reference an existing manifest tombstone or be null for a new one`);
    const tombstoneRecord = validateTombstoneRecord(
      update.tombstoneRecord,
      `${label}.tombstoneRecord`,
      context.protectedPaths,
      context.excludedPaths,
    );
    if (tombstoneRecord.sourcePath !== operation.sourcePath || tombstoneRecord.targetPath !== operation.targetPath) {
      fail(`${label}.tombstoneRecord mapping must match the delete operation`);
    }
    if (context.tombstones.some((candidate) => candidate.sourcePath === operation.sourcePath && candidate.targetPath === operation.targetPath)) {
      fail(`${label}.tombstoneRecord cannot duplicate an existing tombstone mapping`);
    }
    if (context.tombstones.some((candidate) => candidate.id === tombstoneRecord.id)) {
      fail(`${label}.tombstoneRecord.id already exists in the current manifest`);
    }
  }
  if (existing.lastImportedTreeHash !== operation.target.treeHash) {
    fail(`${label} current import hash must match the delete target tree hash`);
  }
  return update;
}

function validatePlan(context, plan) {
  if (!isObject(plan) || plan.schemaVersion !== SCHEMA_VERSION || plan.kind !== "skills-curator-approved-plan") {
    fail(`apply plan must use kind skills-curator-approved-plan and schemaVersion ${SCHEMA_VERSION}`);
  }
  assertExactKeys(plan, ["schemaVersion", "kind", "approved", "manifestSha256", "userApproval", "operations", "manifestUpdates", "approvalPayloadSha256"], "apply plan");
  if (!/^[0-9a-f]{64}$/.test(plan.approvalPayloadSha256)) {
    fail("apply plan approvalPayloadSha256 must be a lowercase SHA-256 hash");
  }
  if (plan.approvalPayloadSha256 !== approvalPayloadSha256(plan)) {
    fail("apply plan approvalPayloadSha256 does not match the canonical plan payload");
  }
  if (plan.approved !== true) fail("apply plan must carry approved: true");
  if (plan.manifestSha256 !== context.manifestSha256) fail("apply plan manifest SHA-256 does not match the current manifest");
  if (!isObject(plan.userApproval)) fail("apply plan userApproval must be an object");
  assertExactKeys(plan.userApproval, ["marker", "decisionId", "approvedOperationIds"], "apply plan userApproval");
  if (plan.userApproval.marker !== context.auditPolicy.userApprovalMarker) {
    fail(`apply plan userApproval.marker must be ${context.auditPolicy.userApprovalMarker}`);
  }
  const approvalDecisionId = requiredString(plan.userApproval.decisionId, "apply plan userApproval.decisionId");
  if (!Array.isArray(plan.userApproval.approvedOperationIds)) {
    fail("apply plan userApproval.approvedOperationIds must be an array");
  }
  const approvedOperationIds = new Set();
  for (const operationId of plan.userApproval.approvedOperationIds) {
    requiredString(operationId, "apply plan userApproval.approvedOperationIds entry");
    if (approvedOperationIds.has(operationId)) fail(`duplicate approved operation id: ${operationId}`);
    approvedOperationIds.add(operationId);
  }
  if (!Array.isArray(plan.operations)) fail("apply plan operations must be an array");
  if (!Array.isArray(plan.manifestUpdates)) fail("apply plan manifestUpdates must be an array");
  const updateHints = new Map();
  for (const [index, update] of plan.manifestUpdates.entries()) {
    if (!isObject(update)) fail(`manifestUpdates[${index}] must be an object`);
    const operationId = requiredString(update.operationId, `manifestUpdates[${index}].operationId`);
    if (updateHints.has(operationId)) fail(`duplicate manifest update for operation: ${operationId}`);
    updateHints.set(operationId, update);
  }
  const seen = new Set();
  const auditRecordIds = new Set();
  const tombstoneRecordIds = new Set();
  const proposedCandidateSources = [];
  const proposedCandidateTargets = [];
  const operations = [];

  for (const [index, operation] of plan.operations.entries()) {
    if (!isObject(operation)) fail(`operations[${index}] must be an object`);
    assertKnownKeys(
      operation,
      ["operationId", "operation", "sourceRoot", "sourcePath", "targetRoot", "targetPath", "expectedSourceTreeHash", "expectedTargetTreeHash", "approval", "auditRecord", "tombstoneId", "decisionRecord"],
      `operations[${index}]`,
    );
    const operationId = requiredString(operation.operationId, `operations[${index}].operationId`);
    if (seen.has(operationId)) fail(`duplicate operation id: ${operationId}`);
    seen.add(operationId);
    if (!isObject(operation.approval)) {
      fail(`operations[${index}] must carry an explicit approval marker`);
    }
    assertExactKeys(operation.approval, ["approved", "marker", "decisionId", "operationId"], `operations[${index}].approval`);
    if (operation.approval.approved !== true) fail(`operations[${index}].approval.approved must be true`);
    if (operation.approval.marker !== context.auditPolicy.userApprovalMarker) {
      fail(`operations[${index}].approval.marker must be ${context.auditPolicy.userApprovalMarker}`);
    }
    if (operation.approval.decisionId !== approvalDecisionId) {
      fail(`operations[${index}].approval.decisionId must match the top-level user approval`);
    }
    if (operation.approval.operationId !== operationId) {
      fail(`operations[${index}].approval.operationId must match the operation id`);
    }
    if (!["copy", "replace", "delete", "record-decision"].includes(operation.operation)) {
      fail(`unsupported operation: ${operation.operation}`);
    }
    if (operation.sourceRoot !== "agents-skills") {
      fail(`operations[${index}] may only read from agents-skills`);
    }
    const sourcePath = directChild(operation.sourcePath, `operations[${index}].sourcePath`);
    const updateHint = updateHints.get(operationId) ?? null;

    if (operation.operation === "record-decision") {
      if (operation.targetRoot !== null || operation.targetPath !== null) {
        fail(`record-decision must not carry a canonical target: ${operationId}`);
      }
      if (operation.expectedTargetTreeHash !== null) {
        fail(`record-decision expectedTargetTreeHash must be null: ${operationId}`);
      }
      if (operation.auditRecord !== undefined) fail(`record-decision cannot carry an audit record: ${operationId}`);
      if (operation.tombstoneId !== undefined) fail(`record-decision cannot carry a tombstone id: ${operationId}`);
      if (context.importByKey.has(recordKey("agents-skills", sourcePath))) {
        fail(`record-decision cannot target a managed import: ${sourcePath}`);
      }
      const existingCandidate = context.candidates.find((candidate) => candidate.sourcePath === sourcePath) ?? null;
      const existingDecision = context.decisionByPath.get(sourcePath) ?? null;
      const authority = pathAuthority(context, "agents-skills", sourcePath);
      if (authority.protected || authority.excluded) {
        fail(`record-decision source already has explicit protected or excluded authority: ${sourcePath}`);
      }
      const source = inspectPath(context, "agents-skills", sourcePath);
      if (source.kind !== "directory" || !hasNonSymlinkSkillFile(context, sourcePath)) {
        fail(`record-decision source must be a direct skill directory with a non-symlink SKILL.md: ${sourcePath}`);
      }
      if (operation.expectedSourceTreeHash !== source.treeHash) {
        fail(`record-decision source hash changed: ${sourcePath}`);
      }
      const decisionRecord = validateDecisionRecord(operation.decisionRecord, `operations[${index}].decisionRecord`);
      if (decisionRecord.sourcePath !== sourcePath || decisionRecord.sourceTreeHash !== source.treeHash) {
        fail(`operations[${index}].decisionRecord must match the current source path and tree hash`);
      }
      if (decisionRecord.approvalDecisionId !== approvalDecisionId) {
        fail(`operations[${index}].decisionRecord.approvalDecisionId must match the top-level user approval`);
      }
      if (existingDecision && decisionRecordEqual(existingDecision, decisionRecord)) {
        fail(`record-decision is an exact duplicate for ${sourcePath}`);
      }
      if (existingDecision && !decisionReplacementDiffers(existingDecision, decisionRecord)) {
        fail(`record-decision replacement must change the source hash, reason, state, or approval: ${sourcePath}`);
      }
      operations.push({
        ...operation,
        operationId,
        sourcePath,
        targetPath: null,
        source,
        target: null,
        importRecord: null,
        candidate: existingCandidate,
        candidateIsNew: false,
        existingCandidate,
        existingDecision,
        decisionRecord,
      });
      continue;
    }

    if (operation.decisionRecord !== undefined && operation.decisionRecord !== null) {
      fail(`only record-decision operations may carry a decision record: ${operationId}`);
    }

    if (operation.targetRoot !== "canonical") {
      fail(`operations[${index}] may only write to canonical`);
    }
    const targetPath = directChild(operation.targetPath, `operations[${index}].targetPath`);
    const currentCandidate = context.candidates.find((entry) => entry.sourcePath === sourcePath && entry.targetPath === targetPath) ?? null;
    let candidate = currentCandidate;
    let candidateIsNew = false;
    if (!candidate) {
      if (operation.operation !== "copy" || !updateHint || updateHint.action !== "add-import" || !updateHint.candidateRecord) {
        fail(`NEW copy requires an existing candidate mapping or a bound add-import candidateRecord: ${sourcePath}->${targetPath}`);
      }
      candidate = validatePlanCandidate(context, updateHint.candidateRecord, `manifestUpdates for ${operationId}.candidateRecord`);
      if (candidate.sourcePath !== sourcePath || candidate.targetPath !== targetPath) {
        fail(`manifest candidate mapping must match the operation: ${operationId}`);
      }
      if (proposedCandidateSources.some((existing) => pathsOverlap(existing, candidate.sourcePath))) {
        fail(`manifest candidate source paths overlap within the plan: ${candidate.sourcePath}`);
      }
      if (proposedCandidateTargets.some((existing) => pathsOverlap(existing, candidate.targetPath))) {
        fail(`manifest candidate target paths overlap within the plan: ${candidate.targetPath}`);
      }
      proposedCandidateSources.push(candidate.sourcePath);
      proposedCandidateTargets.push(candidate.targetPath);
      candidateIsNew = true;
    }
    const targetAuthority = pathAuthority(context, "canonical", targetPath);
    if (targetAuthority.protected || targetAuthority.excluded) {
      fail(`operation targets a protected or excluded path: canonical:${targetPath}`);
    }
    const source = inspectPath(context, "agents-skills", sourcePath);
    const target = inspectPath(context, "canonical", targetPath);
    const importRecord = context.importByKey.get(recordKey("agents-skills", sourcePath)) ?? null;

    if (operation.operation !== "copy" && operation.auditRecord !== undefined) {
      fail(`only copy operations may carry an audit record: ${operationId}`);
    }
    if (operation.operation !== "delete" && operation.tombstoneId !== undefined) {
      fail(`only delete operations may carry a tombstone id: ${operationId}`);
    }

    if (operation.operation === "copy") {
      if (importRecord) fail(`copy cannot replace a managed import; use replace: ${sourcePath}`);
      if (source.kind !== "directory") fail(`copy source must be an existing directory: agents-skills:${sourcePath}`);
      if (target.kind !== "missing") fail(`copy target must be absent: canonical:${targetPath}`);
      if (operation.expectedTargetTreeHash !== null) fail("copy expectedTargetTreeHash must be null");
      if (operation.expectedSourceTreeHash !== source.treeHash) fail(`copy source hash changed: ${sourcePath}`);
      const requiresAudit = candidate.provenance.kind === "manifest-candidate" && candidate.provenance.requiresAudit === true;
      if (requiresAudit) {
        const storedAuditRecord = findReusableAuditRecord(
          context,
          sourcePath,
          source.treeHash,
          `operations[${index}].auditRecord`,
        );
        const auditRecord = validateAuditRecordShape(
          operation.auditRecord,
          `operations[${index}].auditRecord`,
          context.auditPolicy.copyAllowedCategories,
        );
        if (auditRecordIds.has(auditRecord.recordId)) fail(`duplicate audit record id: ${auditRecord.recordId}`);
        if (storedAuditRecord) {
          requireStoredAuditRecord(context, auditRecord, `operations[${index}].auditRecord`);
        } else {
          if (context.auditRecords.some((record) => record.recordId === auditRecord.recordId)) {
            fail(`operations[${index}].auditRecord.recordId already exists in the current manifest`);
          }
          if (auditRecord.manifestSha256 !== context.manifestSha256) {
            fail(`operations[${index}].auditRecord.manifestSha256 must match the current manifest for a fresh receipt`);
          }
        }
        if (auditRecord.candidateSourcePath !== sourcePath) {
          fail(`operations[${index}].auditRecord.candidateSourcePath must match the candidate source path`);
        }
        if (auditRecord.sourceTreeHash !== source.treeHash) {
          fail(`operations[${index}].auditRecord.sourceTreeHash must match the current source tree hash`);
        }
        auditRecordIds.add(auditRecord.recordId);
      } else if (operation.auditRecord !== undefined) {
        fail(`copy carries an audit record for a candidate that does not require one: ${sourcePath}`);
      }
    } else if (operation.operation === "replace") {
      if (!importRecord) fail(`replace requires a managed import record: ${sourcePath}`);
      if (source.kind !== "directory" || target.kind !== "directory") fail(`replace requires source and target directories: ${sourcePath}`);
      if (operation.expectedSourceTreeHash !== source.treeHash) fail(`replace source hash changed: ${sourcePath}`);
      if (operation.expectedTargetTreeHash !== target.treeHash || target.treeHash !== importRecord.lastImportedTreeHash) {
        fail(`replace target drifted from its recorded imported hash: ${targetPath}`);
      }
    } else {
      if (operation.tombstoneId !== null && typeof operation.tombstoneId !== "string") {
        fail(`delete tombstoneId must be an existing id or null: ${operationId}`);
      }
      const tombstone = operation.tombstoneId === null
        ? null
        : context.tombstones.find((entry) => entry.id === operation.tombstoneId) ?? null;
      if (tombstone && (tombstone.sourcePath !== sourcePath || tombstone.targetPath !== targetPath)) {
        fail(`delete tombstone does not match ${sourcePath}->${targetPath}`);
      }
      if (!tombstone && operation.tombstoneId !== null) {
        fail(`delete tombstone id is not present in the manifest: ${operation.tombstoneId}`);
      }
      if (!tombstone && context.tombstones.some((entry) => entry.sourcePath === sourcePath && entry.targetPath === targetPath)) {
        fail(`delete requires the existing tombstone id for ${sourcePath}->${targetPath}`);
      }
      if (!importRecord) fail(`delete requires a matching managed import record: ${sourcePath}`);
      if (source.kind !== "missing") fail(`delete requires the upstream source to be absent: ${sourcePath}`);
      if (target.kind !== "directory") fail(`delete target must be an existing directory: ${targetPath}`);
      if (operation.expectedSourceTreeHash !== null) fail("delete expectedSourceTreeHash must be null");
      if (operation.expectedTargetTreeHash !== target.treeHash) fail(`delete target hash changed: ${targetPath}`);
      if (target.treeHash !== importRecord.lastImportedTreeHash) {
        fail(`delete target drifted from its recorded imported hash: ${targetPath}`);
      }
    }
    assertTargetParent(context, targetPath);
    operations.push({ ...operation, operationId, sourcePath, targetPath, source, target, importRecord, candidate, candidateIsNew });
  }
  if (JSON.stringify([...approvedOperationIds].sort(compareStrings)) !== JSON.stringify([...seen].sort(compareStrings))) {
    fail("apply plan userApproval.approvedOperationIds must exactly match the operation ids");
  }
  assertNoTargetOverlap(operations);
  const updatesByOperationId = new Map();
  for (const [index, update] of plan.manifestUpdates.entries()) {
    const operation = operations.find((candidate) => candidate.operationId === update?.operationId);
    if (!operation) fail(`manifestUpdates[${index}] does not reference an approved operation`);
    if (updatesByOperationId.has(operation.operationId)) fail(`duplicate manifest update for operation: ${operation.operationId}`);
    const validatedUpdate = validateManifestUpdate(context, update, operation, approvalDecisionId, `manifestUpdates[${index}]`);
    if (validatedUpdate.tombstoneRecord !== null) {
      if (tombstoneRecordIds.has(validatedUpdate.tombstoneRecord.id)) {
        fail(`duplicate new tombstone id in apply plan: ${validatedUpdate.tombstoneRecord.id}`);
      }
      tombstoneRecordIds.add(validatedUpdate.tombstoneRecord.id);
    }
    updatesByOperationId.set(operation.operationId, validatedUpdate);
  }
  if (updatesByOperationId.size !== operations.length) {
    fail("manifestUpdates must contain exactly one metadata update for every operation");
  }
  return {
    operations,
    manifestUpdates: operations.map((operation) => updatesByOperationId.get(operation.operationId)),
  };
}

function copyDirectory(source, target, relative = "", context = {}) {
  const operationContext = {
    ...context,
    sourcePath: appendContextPath(context.sourcePath, relative),
    targetPath: appendContextPath(context.targetPath, relative),
  };
  const sourceStat = nativeFs(() => fs.lstatSync(source), { ...operationContext, phase: "copy source" });
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) fail("copy source is not a non-symlink directory");
  nativeFs(() => fs.mkdirSync(target, { mode: sourceStat.mode & 0o7777 }), { ...operationContext, phase: "copy mkdir" });
  const children = nativeFs(
    () => fs.readdirSync(source, { withFileTypes: true }),
    { ...operationContext, phase: "copy directory read" },
  ).sort((a, b) => compareStrings(a.name, b.name));
  for (const child of children) {
    const sourceChild = path.join(source, child.name);
    const targetChild = path.join(target, child.name);
    const childRelative = relative ? `${relative}/${child.name}` : child.name;
    const childContext = {
      ...context,
      sourcePath: appendContextPath(context.sourcePath, childRelative),
      targetPath: appendContextPath(context.targetPath, childRelative),
    };
    const stat = nativeFs(() => fs.lstatSync(sourceChild), { ...childContext, phase: "copy source" });
    if (stat.isSymbolicLink()) fail(`copy encountered a forbidden symlink: ${childRelative}`);
    if (stat.isDirectory()) {
      copyDirectory(sourceChild, targetChild, childRelative, context);
    } else if (stat.isFile()) {
      nativeFs(() => fs.copyFileSync(sourceChild, targetChild), { ...childContext, phase: "copy file" });
      nativeFs(() => fs.chmodSync(targetChild, stat.mode & 0o7777), { ...childContext, phase: "copy chmod" });
    } else {
      fail(`copy encountered an unsupported entry: ${childRelative}`);
    }
  }
  nativeFs(() => fs.chmodSync(target, sourceStat.mode & 0o7777), { ...operationContext, phase: "copy chmod" });
}

function uniqueSibling(parent, prefix) {
  let candidate;
  do {
    candidate = path.join(parent, `${prefix}-${process.pid}-${crypto.randomBytes(6).toString("hex")}`);
  } while (lstatOrMissing(candidate));
  return candidate;
}

function beginFilesystemOperation(context, operation) {
  assertOperationBeforeMutation(context, operation, "before filesystem mutation");
  const canonical = context.roots.get("canonical");
  const source = rootEntry(context.roots.get("agents-skills"), operation.sourcePath, `operation ${operation.operationId} source`);
  const target = rootEntry(canonical, operation.targetPath, `operation ${operation.operationId} target`);
  const parent = path.dirname(target);
  const temporary = uniqueSibling(parent, ".skill-tree-sync-temp");
  const backup = uniqueSibling(parent, ".skill-tree-sync-backup");
  const operationContext = {
    operationId: operation.operationId,
    sourceRoot: "agents-skills",
    sourcePath: operation.sourcePath,
    targetRoot: "canonical",
    targetPath: operation.targetPath,
  };

  if (operation.operation === "copy" || operation.operation === "replace") {
    try {
      copyDirectory(source, temporary, "", operationContext);
      const sourceAfterCopy = assertSourceSnapshot(context, operation, "after staging");
      const staged = hashDirectory(temporary, { ...operationContext, phase: "staging" });
      if (staged.treeHash !== sourceAfterCopy.treeHash) {
        fail(`after staging ${operation.operationId} temporary tree does not match the source hash`);
      }
    } catch (error) {
      try {
        nativeFs(
          () => fs.rmSync(temporary, { recursive: true, force: true }),
          { ...operationContext, phase: "staging cleanup" },
        );
      } catch (cleanupError) {
        throw markCleanupFailure(error, `operation ${operation.operationId}`, cleanupError, operationContext);
      }
      throw error;
    }
  }

  if (operation.operation === "copy") {
    try {
      assertSourceSnapshot(context, operation, "before copy rename");
      assertTargetSnapshot(context, operation, "before copy rename");
      nativeFs(
        () => fs.renameSync(temporary, target),
        { ...operationContext, phase: "copy rename" },
      );
    } catch (error) {
      try {
        nativeFs(
          () => fs.rmSync(temporary, { recursive: true, force: true }),
          { ...operationContext, phase: "copy cleanup" },
        );
      } catch (cleanupError) {
        throw markCleanupFailure(error, `operation ${operation.operationId}`, cleanupError, operationContext);
      }
      throw error;
    }
    return {
      context: operationContext,
      rollback: () => nativeFs(
        () => fs.rmSync(target, { recursive: true, force: false }),
        { ...operationContext, phase: "rollback" },
      ),
      commit: () => {},
    };
  }

  if (operation.operation === "replace") {
    try {
      assertSourceSnapshot(context, operation, "before replace rename");
      assertTargetSnapshot(context, operation, "before replace rename");
      nativeFs(
        () => fs.renameSync(target, backup),
        { ...operationContext, phase: "replace backup" },
      );
      nativeFs(
        () => fs.renameSync(temporary, target),
        { ...operationContext, phase: "replace rename" },
      );
    } catch (error) {
      let cleanupError = null;
      try {
        nativeFs(
          () => fs.rmSync(temporary, { recursive: true, force: true }),
          { ...operationContext, phase: "replace cleanup" },
        );
      } catch (temporaryCleanupError) {
        cleanupError = temporaryCleanupError;
      }
      if (lstatOrMissing(backup)) {
        try {
          nativeFs(
            () => fs.renameSync(backup, target),
            { ...operationContext, phase: "replace rollback" },
          );
        } catch (rollbackError) {
          throw markRollbackFailure(error, `operation ${operation.operationId}`, rollbackError, operationContext);
        }
      }
      if (cleanupError) throw markCleanupFailure(error, `operation ${operation.operationId}`, cleanupError, operationContext);
      throw error;
    }
    return {
      context: operationContext,
      rollback: () => {
        nativeFs(
          () => fs.rmSync(target, { recursive: true, force: false }),
          { ...operationContext, phase: "rollback" },
        );
        nativeFs(
          () => fs.renameSync(backup, target),
          { ...operationContext, phase: "rollback" },
        );
      },
      commit: () => nativeFs(
        () => fs.rmSync(backup, { recursive: true, force: false }),
        { ...operationContext, phase: "commit cleanup" },
      ),
    };
  }

  try {
    assertSourceSnapshot(context, operation, "before delete rename");
    assertTargetSnapshot(context, operation, "before delete rename");
    nativeFs(
      () => fs.renameSync(target, backup),
      { ...operationContext, phase: "delete rename" },
    );
  } catch (error) {
    throw error;
  }
  return {
    context: operationContext,
    rollback: () => nativeFs(
      () => fs.renameSync(backup, target),
      { ...operationContext, phase: "rollback" },
    ),
    commit: () => nativeFs(
      () => fs.rmSync(backup, { recursive: true, force: false }),
      { ...operationContext, phase: "commit cleanup" },
    ),
  };
}

function buildManifestAfterUpdates(context, manifestUpdates, operations) {
  const nextManifest = JSON.parse(JSON.stringify(context.manifest));
  for (const update of manifestUpdates) {
    const operation = operations.find((candidate) => candidate.operationId === update.operationId);
    if (!operation) fail(`cannot apply manifest update for operation ${update.operationId}`);
    const operationKey = `${operation.sourcePath}->${operation.targetPath}`;
    if (update.action === "add-import") {
      if (update.candidateRecord !== null) nextManifest.candidatePaths.push(update.candidateRecord);
      if (update.auditRecord !== null) nextManifest.auditRecords.push(update.auditRecord);
      nextManifest.imports.push(update.importRecord);
      continue;
    }
    if (update.action === "record-decision") {
      if (update.removeCandidate) {
        nextManifest.candidatePaths = nextManifest.candidatePaths
          .filter((candidate) => candidate.sourcePath !== operation.sourcePath);
        nextManifest.auditRecords = nextManifest.auditRecords
          .filter((record) => record.candidateSourcePath !== operation.sourcePath);
      }
      if (update.replaceDecision) {
        const decisionIndex = nextManifest.decisions.findIndex((decision) => decision.sourcePath === operation.sourcePath);
        if (decisionIndex < 0) fail(`cannot replace missing decision for operation ${update.operationId}`);
        nextManifest.decisions[decisionIndex] = update.decisionRecord;
      } else {
        nextManifest.decisions.push(update.decisionRecord);
      }
      continue;
    }
    const index = nextManifest.imports.findIndex((record) => `${record.sourcePath}->${record.targetPath}` === operationKey);
    if (index < 0) {
      fail(`cannot apply manifest update for operation ${update.operationId}`);
    }
    if (update.action === "update-import") {
      nextManifest.imports[index] = update.importRecord;
    } else if (update.action === "remove-import") {
      nextManifest.imports.splice(index, 1);
      if (update.tombstoneRecord !== null) nextManifest.tombstones.push(update.tombstoneRecord);
    }
  }
  return nextManifest;
}

function verifyAppliedState(context, operations, manifestUpdates) {
  for (const operation of operations) {
    const manifestUpdate = manifestUpdates.find((update) => update.operationId === operation.operationId);
    const source = inspectPath(context, "agents-skills", operation.sourcePath);
    if (operation.operation === "delete") {
      if (source.kind !== "missing") fail(`source verification failed: agents-skills:${operation.sourcePath} must remain absent`);
    } else if (source.kind !== "directory" || source.treeHash !== operation.expectedSourceTreeHash) {
      fail(`source verification failed: agents-skills:${operation.sourcePath}`);
    }
    if (
      operation.operation === "copy"
      && operation.candidate.provenance.kind === "manifest-candidate"
      && operation.candidate.provenance.requiresAudit === true
    ) {
      const storedAuditRecord = context.auditRecords.find((record) => record.recordId === operation.auditRecord.recordId) ?? null;
      if (!storedAuditRecord || !auditRecordRecordEqual(storedAuditRecord, operation.auditRecord)) {
        fail(`manifest verification failed: audit receipt does not match ${operation.operationId}`);
      }
    }
    if (operation.operation === "record-decision") {
      const decision = context.decisionByPath.get(operation.sourcePath);
      if (!decision || !decisionRecordEqual(decision, operation.decisionRecord)) {
        fail(`manifest verification failed: decision does not match ${operation.operationId}`);
      }
      continue;
    }
    const target = inspectPath(context, "canonical", operation.targetPath);
    if (operation.operation === "delete") {
      if (target.kind !== "missing") fail(`delete verification failed: canonical:${operation.targetPath}`);
      if (context.importByKey.has(recordKey("agents-skills", operation.sourcePath))) {
        fail(`manifest verification failed: import remains for deleted operation ${operation.operationId}`);
      }
      const tombstoneId = manifestUpdate?.tombstoneRecord?.id ?? operation.tombstoneId;
      const tombstone = context.tombstones.find((candidate) => candidate.id === tombstoneId) ?? null;
      if (!tombstone) {
        fail(`manifest verification failed: tombstone was not retained for ${operation.operationId}`);
      }
      if (manifestUpdate?.tombstoneRecord && !tombstoneRecordEqual(tombstone, manifestUpdate.tombstoneRecord)) {
        fail(`manifest verification failed: new tombstone does not match ${operation.operationId}`);
      }
      continue;
    }
    if (target.kind !== "directory" || target.treeHash !== operation.source.treeHash) {
      fail(`copy verification failed: canonical:${operation.targetPath}`);
    }
    const importRecord = context.importByKey.get(recordKey("agents-skills", operation.sourcePath));
    if (!importRecord || importRecord.targetPath !== operation.targetPath || importRecord.lastImportedTreeHash !== target.treeHash) {
      fail(`manifest verification failed: import does not match ${operation.operationId}`);
    }
  }
}

function manifestErrorContext(context, phase) {
  const canonical = context.roots.get("canonical");
  const relative = path.relative(canonical.absolute, context.manifestFile).split(path.sep).join("/");
  return { phase, targetRoot: "canonical", targetPath: relative };
}

function prepareManifestBackup(context) {
  const errorContext = manifestErrorContext(context, "manifest backup");
  const manifestStat = nativeFs(() => fs.lstatSync(context.manifestFile), errorContext);
  const backup = uniqueSibling(path.dirname(context.manifestFile), ".skill-tree-sync-manifest-backup");
  nativeFs(() => fs.copyFileSync(context.manifestFile, backup), errorContext);
  return { backup, mode: manifestStat.mode & 0o7777, context: errorContext };
}

function replaceManifest(context, raw, transaction) {
  const temporary = uniqueSibling(path.dirname(context.manifestFile), ".skill-tree-sync-manifest-temp");
  const errorContext = { ...transaction.context, phase: "manifest replacement" };
  let failure = null;
  try {
    nativeFs(() => fs.writeFileSync(temporary, raw, { mode: transaction.mode }), errorContext);
    nativeFs(() => fs.chmodSync(temporary, transaction.mode), errorContext);
    nativeFs(() => fs.renameSync(temporary, context.manifestFile), errorContext);
    transaction.written = true;
  } catch (error) {
    failure = error;
  }
  try {
    if (lstatOrMissing(temporary)) {
      nativeFs(
        () => fs.rmSync(temporary, { force: true }),
        { ...errorContext, phase: "manifest replacement cleanup" },
      );
    }
  } catch (cleanupError) {
    if (failure) throw markCleanupFailure(failure, "manifest replacement", cleanupError, errorContext);
    throw cleanupError;
  }
  if (failure) throw failure;
}

function restoreManifest(context, transaction) {
  if (!transaction.written) return;
  const temporary = uniqueSibling(path.dirname(context.manifestFile), ".skill-tree-sync-manifest-restore");
  const errorContext = { ...transaction.context, phase: "manifest rollback" };
  let failure = null;
  try {
    nativeFs(() => fs.copyFileSync(transaction.backup, temporary, { mode: transaction.mode }), errorContext);
    nativeFs(() => fs.chmodSync(temporary, transaction.mode), errorContext);
    nativeFs(() => fs.renameSync(temporary, context.manifestFile), errorContext);
    transaction.written = false;
  } catch (error) {
    failure = error;
  }
  try {
    if (lstatOrMissing(temporary)) {
      nativeFs(
        () => fs.rmSync(temporary, { force: true }),
        { ...errorContext, phase: "manifest rollback cleanup" },
      );
    }
  } catch (cleanupError) {
    if (failure) throw markCleanupFailure(failure, "manifest rollback", cleanupError, errorContext);
    throw cleanupError;
  }
  if (failure) throw failure;
}

function reloadManifestContext(context) {
  const actualManifest = readJson(context.manifestFile, "current manifest before apply");
  return validateManifest(actualManifest.value, context.manifestFile, actualManifest.raw);
}

function assertManifestUnchanged(context, phase) {
  const actualManifest = readJson(context.manifestFile, `${phase} manifest`);
  if (actualManifest.raw !== context.manifestRaw || digestBytes(Buffer.from(actualManifest.raw, "utf8")) !== context.manifestSha256) {
    fail(`${phase}: manifest changed after plan validation`);
  }
  return validateManifest(actualManifest.value, context.manifestFile, actualManifest.raw);
}

function applyPlan(initialContext, plan) {
  const context = reloadManifestContext(initialContext);
  const preflight = validatePlan(context, plan);
  const { operations, manifestUpdates } = preflight;
  if (operations.length === 0) {
    return {
      schemaVersion: SCHEMA_VERSION,
      kind: "skills-curator-apply-result",
      mode: "apply",
      manifestSha256: context.manifestSha256,
      applied: [],
      manifestUpdates: [],
      warnings: [],
    };
  }

  const nextManifest = buildManifestAfterUpdates(context, manifestUpdates, operations);
  const nextRaw = `${JSON.stringify(nextManifest, null, 2)}\n`;
  validateManifest(nextManifest, context.manifestFile, nextRaw);

  assertManifestUnchanged(context, "before filesystem staging");
  const filesystemTransactions = [];
  const manifestTransaction = prepareManifestBackup(context);
  const warnings = [];
  try {
    for (const operation of operations) {
      if (operation.operation === "record-decision") {
        assertOperationBeforeMutation(context, operation, "before decision mutation");
        continue;
      }
      assertOperationBeforeMutation(context, operation, "before filesystem mutation");
      const transaction = beginFilesystemOperation(context, operation);
      filesystemTransactions.push(transaction);
    }

    const currentContext = assertManifestUnchanged(context, "before manifest replacement");
    for (const operation of operations) {
      assertStagedOperation(currentContext, operation, "before manifest replacement");
    }
    replaceManifest(context, nextRaw, manifestTransaction);
    const actualManifest = readJson(context.manifestFile, "updated manifest");
    const updatedContext = validateManifest(actualManifest.value, context.manifestFile, actualManifest.raw);
    verifyAppliedState(updatedContext, operations, manifestUpdates);

    for (const transaction of filesystemTransactions) {
      try {
        transaction.commit();
      } catch (error) {
        warnings.push(`cleanup failed: ${errorDetail(error, { ...transaction.context, phase: "cleanup" })}`);
      }
    }
    try {
      nativeFs(
        () => fs.rmSync(manifestTransaction.backup, { force: false }),
        { ...manifestTransaction.context, phase: "manifest backup cleanup" },
      );
    } catch (error) {
      warnings.push(`manifest backup cleanup failed: ${errorDetail(error, { ...manifestTransaction.context, phase: "manifest backup cleanup" })}`);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      kind: "skills-curator-apply-result",
      mode: "apply",
      manifestSha256: updatedContext.manifestSha256,
      applied: operations.map((operation) => ({ operationId: operation.operationId, operation: operation.operation, sourcePath: operation.sourcePath, targetPath: operation.targetPath })),
      manifestUpdates: manifestUpdates.map((update) => ({ operationId: update.operationId, action: update.action })),
      warnings,
    };
  } catch (error) {
    const rollbackErrors = [];
    const cleanupErrors = [];
    if (error && typeof error.rollbackFailure === "string") {
      rollbackErrors.push(error.rollbackFailure);
    }
    if (error && typeof error.cleanupFailure === "string") {
      cleanupErrors.push(error.cleanupFailure);
    }
    try {
      restoreManifest(context, manifestTransaction);
    } catch (rollbackError) {
      if (typeof rollbackError?.rollbackFailure === "string") rollbackErrors.push(rollbackError.rollbackFailure);
      if (typeof rollbackError?.cleanupFailure === "string") cleanupErrors.push(rollbackError.cleanupFailure);
      rollbackErrors.push({
        label: "manifest rollback failed",
        error: rollbackError,
        context: { ...manifestTransaction.context, phase: "rollback" },
      });
    }
    for (const transaction of filesystemTransactions.reverse()) {
      try {
        transaction.rollback();
      } catch (rollbackError) {
        rollbackErrors.push({
          label: "filesystem rollback failed",
          error: rollbackError,
          context: { ...transaction.context, phase: "rollback" },
        });
      }
    }
    try {
      if (lstatOrMissing(manifestTransaction.backup)) {
        nativeFs(
          () => fs.rmSync(manifestTransaction.backup, { force: false }),
          { ...manifestTransaction.context, phase: "manifest backup cleanup" },
        );
      }
    } catch (cleanupError) {
      cleanupErrors.push({
        label: "manifest backup cleanup failed",
        error: cleanupError,
        context: { ...manifestTransaction.context, phase: "cleanup" },
      });
    }
    fail(formatTransactionFailure(error, {
      rollbackErrors,
      cleanupErrors,
      context: { phase: "transaction" },
    }));
  }
}

function parseArguments(argv) {
  const result = { manifest: null, dryRun: false, discoverPending: false, applyPlan: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      result.help = true;
    } else if (argument === "--dry-run") {
      result.dryRun = true;
    } else if (argument === "--discover-pending") {
      result.discoverPending = true;
    } else if (argument === "--manifest") {
      result.manifest = argv[++index];
      if (!result.manifest) fail("--manifest requires a path");
    } else if (argument === "--apply-plan") {
      result.applyPlan = argv[++index];
      if (!result.applyPlan) fail("--apply-plan requires a path or -");
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }
  if (result.help) return result;
  if (!result.manifest) fail("--manifest is required");
  const selectedModes = [result.dryRun, result.discoverPending, Boolean(result.applyPlan)].filter(Boolean).length;
  if (selectedModes !== 1) fail("choose exactly one of --dry-run, --discover-pending, or --apply-plan");
  return result;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const manifestFile = path.resolve(process.cwd(), args.manifest);
  const { raw, value } = readJson(manifestFile, "manifest");
  const context = validateManifest(value, manifestFile, raw);
  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify(dryRun(context), null, 2)}\n`);
    return;
  }
  if (args.discoverPending) {
    process.stdout.write(`${JSON.stringify(discoverPending(context), null, 2)}\n`);
    return;
  }
  const planRaw = args.applyPlan === "-"
    ? nativeFs(() => fs.readFileSync(0, "utf8"), { phase: "read apply plan" })
    : readJson(path.resolve(process.cwd(), args.applyPlan), "apply plan").raw;
  let plan;
  try {
    plan = JSON.parse(planRaw);
  } catch (error) {
    fail(`malformed apply plan JSON: ${error.message}`);
  }
  validatePlan(context, plan);
  process.stdout.write(`${JSON.stringify(applyPlan(context, plan), null, 2)}\n`);
}

export { formatCliError, formatTransactionFailure, sanitizeNativeError };

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${formatCliError(error)}\n`);
    process.exitCode = 1;
  }
}
