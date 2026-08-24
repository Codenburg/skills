import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const SCRIPT = fileURLToPath(new URL("./skill-tree-sync.mjs", import.meta.url));
const APPROVAL_MARKER = "explicit-user-approval";
const POSIX_PLATFORMS = new Set(["aix", "android", "darwin", "freebsd", "haiku", "linux", "openbsd", "sunos"]);
const IS_POSIX = POSIX_PLATFORMS.has(process.platform);
const { formatCliError, formatTransactionFailure, sanitizeNativeError } = await import(pathToFileURL(SCRIPT).href);

function canonicalizeJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalizeJson(entry)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key])}`).join(",")}}`;
}

function approvalPayloadSha256(plan) {
  const payload = { ...plan };
  delete payload.approvalPayloadSha256;
  return crypto.createHash("sha256").update(canonicalizeJson(payload), "utf8").digest("hex");
}

function withApprovalPayload(plan) {
  plan.approvalPayloadSha256 = approvalPayloadSha256(plan);
  return plan;
}

function refreshApprovalPayload(plan) {
  return withApprovalPayload(plan);
}

function makeFixture({ targetPath = "candidate-skill", protectedPaths = [] } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "skill-tree-sync-"));
  const canonical = path.join(base, "canonical");
  const home = path.join(base, "home");
  const upstream = path.join(home, ".agents", "skills");
  fs.mkdirSync(canonical, { recursive: true });
  fs.mkdirSync(upstream, { recursive: true });
  fs.writeFileSync(path.join(canonical, ".gitignore"), "\n");
  fs.writeFileSync(path.join(upstream, "skills-lock.json"), `${JSON.stringify({ version: 1, skills: {} }, null, 2)}\n`);

  const sourcePath = "candidate-skill";
  fs.mkdirSync(path.join(upstream, sourcePath), { recursive: true });
  fs.writeFileSync(path.join(upstream, sourcePath, "SKILL.md"), "# Candidate\n");

  const manifest = {
    schemaVersion: 3,
    authority: {
      direction: "source-to-canonical-only",
      reverseSync: "forbidden",
      unknownPathPolicy: "stop-or-exclude",
      ownership: "manifest-only",
      supportedProvenanceKinds: ["manifest-candidate", "skills-lock", "manifest-explicit-baseline"],
      auditPolicy: {
        recordFields: [
          "recordId",
          "candidateSourcePath",
          "sourceTreeHash",
          "manifestSha256",
          "category",
        ],
        categories: ["RECOMMENDED", "RECOMMENDED_WITH_NOTES", "REDUNDANT", "CONFLICTING", "NOT_RELEVANT", "UNSAFE", "NEEDS_REVIEW"],
        copyAllowedCategories: ["RECOMMENDED", "RECOMMENDED_WITH_NOTES"],
        userApprovalMarker: APPROVAL_MARKER,
      },
      decisionPolicy: {
        recordFields: [
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
        ],
        states: ["EXCLUDED", "PROTECTED"],
        userApprovalMarker: APPROVAL_MARKER,
      },
    },
    roots: [
      { id: "canonical", path: ".", role: "canonical-git-repository", readOnly: false, followSymlinks: false },
      { id: "agents-skills", path: "~/.agents/skills", role: "upstream-read-only", readOnly: true, followSymlinks: false },
    ],
    metadata: {
      gitTrackedState: { root: "canonical", path: ".gitignore", authority: "explicit-git-state", command: "fixture" },
      gitignore: { root: "canonical", path: ".gitignore", authority: "explicit-protected-path-metadata", command: "fixture" },
      skillsLock: { root: "agents-skills", path: "skills-lock.json", authority: "explicit-source-provenance-only", records: [] },
    },
    protectedPaths,
    excludedPaths: [],
    candidatePaths: [
      {
        sourceRoot: "agents-skills",
        sourcePath,
        targetRoot: "canonical",
        targetPath,
        provenance: { kind: "manifest-candidate", requiresAudit: true },
      },
    ],
    imports: [],
    tombstones: [],
    auditRecords: [],
    decisions: [],
  };

  return { base, canonical, home, upstream, sourcePath, targetPath, manifest, manifestFile: path.join(canonical, "skills-sources.json") };
}

function writeManifest(fixture) {
  fs.writeFileSync(fixture.manifestFile, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
}

function run(fixture, args, input) {
  return spawnSync(process.execPath, [SCRIPT, "--manifest", fixture.manifestFile, ...args], {
    cwd: fixture.base,
    encoding: "utf8",
    env: { ...process.env, HOME: fixture.home, USERPROFILE: fixture.home },
    input,
  });
}

function dryRun(fixture) {
  writeManifest(fixture);
  const result = run(fixture, ["--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function seedAuditRecord(fixture, baseline, operationId = "copy-candidate") {
  fixture.manifest.auditRecords = [{
    recordId: `audit-${operationId}`,
    candidateSourcePath: fixture.sourcePath,
    sourceTreeHash: baseline.comparisons[0].source.treeHash,
    manifestSha256: baseline.manifestSha256,
    category: "RECOMMENDED",
  }];
}

function addImportUpdate(comparison, operationId, decisionId, importId = `import-${operationId}`) {
  return {
    operationId,
    action: "add-import",
    expectedSourceTreeHash: comparison.source.treeHash,
    expectedTargetTreeHash: null,
    tombstoneId: null,
    tombstoneRecord: null,
    removeCandidate: false,
    replaceDecision: false,
    candidateRecord: null,
    auditRecord: null,
    importRecord: {
      id: importId,
      sourceRoot: "agents-skills",
      sourcePath: comparison.sourcePath,
      targetRoot: "canonical",
      targetPath: comparison.targetPath,
      status: "managed",
      lastImportedTreeHash: comparison.source.treeHash,
      authority: { kind: "manifest-explicit-baseline", basis: "fixture approved import" },
      },
    decisionRecord: null,
    approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
  };
}

function copyPlan(dry, comparison, { auditRecord = null, operationId = "copy-candidate" } = {}) {
  const decisionId = "decision-test-001";
  const operation = {
    operationId,
    operation: "copy",
    sourceRoot: "agents-skills",
    sourcePath: comparison.sourcePath,
    targetRoot: "canonical",
    targetPath: comparison.targetPath,
    expectedSourceTreeHash: comparison.source.treeHash,
    expectedTargetTreeHash: null,
    approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
  };
  if (auditRecord) operation.auditRecord = auditRecord;
  return withApprovalPayload({
    schemaVersion: 3,
    kind: "skills-curator-approved-plan",
    approved: true,
    manifestSha256: dry.manifestSha256,
    userApproval: { marker: APPROVAL_MARKER, decisionId, approvedOperationIds: [operationId] },
    operations: [operation],
    manifestUpdates: [addImportUpdate(comparison, operationId, decisionId)],
  });
}

function newTombstoneDeletePlan(dry, comparison, tombstoneRecord, operationId = tombstoneRecord.id) {
  const decisionId = `decision-${operationId}`;
  return withApprovalPayload({
    schemaVersion: 3,
    kind: "skills-curator-approved-plan",
    approved: true,
    manifestSha256: dry.manifestSha256,
    userApproval: { marker: APPROVAL_MARKER, decisionId, approvedOperationIds: [operationId] },
    operations: [{
      operationId,
      operation: "delete",
      sourceRoot: "agents-skills",
      sourcePath: comparison.sourcePath,
      targetRoot: "canonical",
      targetPath: comparison.targetPath,
      expectedSourceTreeHash: null,
      expectedTargetTreeHash: comparison.target.treeHash,
      tombstoneId: null,
      approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
    }],
    manifestUpdates: [{
      operationId,
      action: "remove-import",
      expectedSourceTreeHash: null,
      expectedTargetTreeHash: comparison.target.treeHash,
      tombstoneId: null,
      tombstoneRecord,
      removeCandidate: false,
      replaceDecision: false,
      candidateRecord: null,
      auditRecord: null,
      importRecord: null,
      decisionRecord: null,
      approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
    }],
  });
}

function applyPlan(fixture, plan) {
  const planFile = path.join(fixture.base, "plan.json");
  fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
  return run(fixture, ["--apply-plan", planFile]);
}

function discover(fixture) {
  writeManifest(fixture);
  const result = run(fixture, ["--discover-pending"]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function decisionPlan(discovery, entries) {
  const decisionId = "decision-record-001";
  const operations = entries.map((entry, index) => {
    const operationId = `record-${entry.state.toLowerCase()}-${index + 1}`;
    const decisionRecord = {
      id: `decision-${entry.sourcePath}`,
      root: "agents-skills",
      sourcePath: entry.sourcePath,
      state: entry.state,
      sourceTreeHash: entry.sourceTreeHash,
      reason: `Fixture ${entry.state.toLowerCase()} decision`,
      auditVerdict: null,
      evidenceRef: null,
      approvalDecisionId: decisionId,
      userApprovalMarker: APPROVAL_MARKER,
    };
    return {
      operationId,
      operation: "record-decision",
      sourceRoot: "agents-skills",
      sourcePath: entry.sourcePath,
      targetRoot: null,
      targetPath: null,
      expectedSourceTreeHash: entry.sourceTreeHash,
      expectedTargetTreeHash: null,
      approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      decisionRecord,
    };
  });
  return withApprovalPayload({
    schemaVersion: 3,
    kind: "skills-curator-approved-plan",
    approved: true,
    manifestSha256: discovery.manifestSha256,
    userApproval: {
      marker: APPROVAL_MARKER,
      decisionId,
      approvedOperationIds: operations.map((operation) => operation.operationId),
    },
    operations,
    manifestUpdates: operations.map((operation, index) => ({
      operationId: operation.operationId,
      action: "record-decision",
      expectedSourceTreeHash: operation.expectedSourceTreeHash,
      expectedTargetTreeHash: null,
      tombstoneId: null,
      tombstoneRecord: null,
      removeCandidate: Boolean(entries[index].removeCandidate),
      replaceDecision: Boolean(entries[index].replaceDecision),
      candidateRecord: null,
      auditRecord: null,
      importRecord: null,
      decisionRecord: operation.decisionRecord,
      approval: operation.approval,
    })),
  });
}

function removeFixture(fixture) {
  fs.rmSync(fixture.base, { recursive: true, force: true });
}

function nativeErrorFixture(fixture, code) {
  const error = new Error(
    `native filesystem failure at ${fixture.base}; home=${fixture.home}; canonical=${fixture.canonical}; upstream=${fixture.upstream}`,
  );
  error.code = code;
  error.path = path.join(fixture.canonical, fixture.targetPath);
  error.dest = path.join(fixture.upstream, fixture.sourcePath);
  return error;
}

test("sanitizes native filesystem errors without absolute path leakage", () => {
  const fixture = makeFixture();
  try {
    const output = sanitizeNativeError(
      nativeErrorFixture(fixture, "EACCES"),
      {
        operationId: "copy-native-error",
        phase: "copy file",
        sourceRoot: "agents-skills",
        sourcePath: fixture.sourcePath,
        targetRoot: "canonical",
        targetPath: fixture.targetPath,
      },
    );
    assert.match(output, /EACCES/);
    assert.match(output, /operation copy-native-error/);
    assert.match(output, /phase copy file/);
    assert.match(output, /agents-skills:candidate-skill/);
    assert.match(output, /canonical:candidate-skill/);
    for (const absolutePath of [fixture.base, fixture.home, fixture.canonical, fixture.upstream]) {
      assert.equal(output.includes(absolutePath), false, absolutePath);
    }
  } finally {
    removeFixture(fixture);
  }
});

test("reports rollback failures separately without absolute path leakage", () => {
  const fixture = makeFixture();
  try {
    const output = formatTransactionFailure(
      nativeErrorFixture(fixture, "EACCES"),
      {
        context: {
          operationId: "replace-native-error",
          phase: "replace",
          sourceRoot: "agents-skills",
          sourcePath: fixture.sourcePath,
          targetRoot: "canonical",
          targetPath: fixture.targetPath,
        },
        rollbackErrors: [{
          label: "filesystem rollback failed",
          error: nativeErrorFixture(fixture, "EPERM"),
          context: {
            operationId: "replace-native-error",
            phase: "rollback",
            sourceRoot: "agents-skills",
            sourcePath: fixture.sourcePath,
            targetRoot: "canonical",
            targetPath: fixture.targetPath,
          },
        }],
      },
    );
    assert.match(output, /transaction rollback failed and state may be partial/);
    assert.match(output, /filesystem rollback failed/);
    assert.match(output, /EPERM/);
    assert.doesNotMatch(output, /cleanup failed/);
    for (const absolutePath of [fixture.base, fixture.home, fixture.canonical, fixture.upstream]) {
      assert.equal(output.includes(absolutePath), false, absolutePath);
    }
  } finally {
    removeFixture(fixture);
  }
});

test("reports cleanup failures separately without absolute path leakage", () => {
  const fixture = makeFixture();
  try {
    const output = formatTransactionFailure(
      nativeErrorFixture(fixture, "EACCES"),
      {
        context: {
          operationId: "copy-native-error",
          phase: "copy",
          sourceRoot: "agents-skills",
          sourcePath: fixture.sourcePath,
          targetRoot: "canonical",
          targetPath: fixture.targetPath,
        },
        cleanupErrors: [{
          label: "manifest backup cleanup failed",
          error: nativeErrorFixture(fixture, "ENOTEMPTY"),
          context: {
            operationId: "copy-native-error",
            phase: "cleanup",
            targetRoot: "canonical",
            targetPath: "skills-sources.json",
          },
        }],
      },
    );
    assert.match(output, /transaction rolled back; cleanup failed/);
    assert.match(output, /manifest backup cleanup failed/);
    assert.match(output, /ENOTEMPTY/);
    assert.doesNotMatch(output, /transaction rollback failed/);
    for (const absolutePath of [fixture.base, fixture.home, fixture.canonical, fixture.upstream]) {
      assert.equal(output.includes(absolutePath), false, absolutePath);
    }
  } finally {
    removeFixture(fixture);
  }
});

test("sanitizes unexpected global native failures while retaining the error code", () => {
  const fixture = makeFixture();
  try {
    const output = formatCliError(nativeErrorFixture(fixture, "EXDEV"));
    assert.match(output, /unexpected failure/);
    assert.match(output, /EXDEV/);
    assert.match(output, /phase global/);
    for (const absolutePath of [fixture.base, fixture.home, fixture.canonical, fixture.upstream]) {
      assert.equal(output.includes(absolutePath), false, absolutePath);
    }
  } finally {
    removeFixture(fixture);
  }
});

test("rejects malformed manifests", () => {
  const fixture = makeFixture();
  try {
    fs.writeFileSync(fixture.manifestFile, "{\n");
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /malformed JSON in manifest/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects exact duplicate historical audit receipts", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline, "exact-duplicate");
    fixture.manifest.auditRecords.push({ ...fixture.manifest.auditRecords[0] });
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate audit record/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects an audit record id reused for a different historical record", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline, "reused-id");
    fixture.manifest.auditRecords.push({
      ...fixture.manifest.auditRecords[0],
      sourceTreeHash: "0".repeat(64),
    });
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /audit record id is reused for a different record/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects unknown ownership and provenance claims", () => {
  const fixture = makeFixture();
  try {
    fixture.manifest.authority.ownership = "candidate-content";
    writeManifest(fixture);
    let result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ownership must be manifest-only/);

    fixture.manifest.authority.ownership = "manifest-only";
    fixture.manifest.candidatePaths[0].provenance = { kind: "untrusted-source" };
    writeManifest(fixture);
    result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /provenance\.kind is unsupported/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects equal or nested canonical and upstream roots", () => {
  const fixture = makeFixture();
  try {
    fixture.manifest.roots[1].path = ".";
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /roots must be disjoint/);
  } finally {
    removeFixture(fixture);
  }
});

test("resolves canonical dot and the manifest-declared upstream root internally", () => {
  const fixture = makeFixture();
  try {
    const dry = dryRun(fixture);
    assert.deepEqual(dry.roots.map((root) => ({ id: root.id, path: root.path })), [
      { id: "canonical", path: "." },
      { id: "agents-skills", path: "~/.agents/skills" },
    ]);
    assert.equal(dry.comparisons[0].source.kind, "directory");
    assert.equal(dry.comparisons[0].target.kind, "missing");
  } finally {
    removeFixture(fixture);
  }
});

test("resolves the upstream root against the controlled HOME without touching the real HOME", () => {
  const fixture = makeFixture();
  try {
    const dry = dryRun(fixture);
    assert.equal(dry.roots.find((root) => root.id === "agents-skills").path, "~/.agents/skills");
    assert.equal(dry.comparisons[0].source.treeHash.length, 64);
    assert.equal(JSON.stringify(dry).includes(fixture.home), false);
    assert.equal(JSON.stringify(dry).includes(os.homedir()), false);
  } finally {
    removeFixture(fixture);
  }
});

test("tree hash = root mode metadata + deterministic descendant tree", () => {
  const fixture = makeFixture();
  try {
    const source = path.join(fixture.upstream, fixture.sourcePath);
    const skillFile = path.join(source, "SKILL.md");
    const childDirectory = path.join(source, "nested");
    const childFile = path.join(childDirectory, "nested.txt");
    fs.mkdirSync(childDirectory);
    fs.writeFileSync(childFile, "nested\n");
    fs.chmodSync(source, 0o755);
    fs.chmodSync(skillFile, 0o644);
    fs.chmodSync(childDirectory, 0o755);
    fs.chmodSync(childFile, 0o644);

    const baseline = dryRun(fixture).comparisons[0].source;
    const repeated = dryRun(fixture).comparisons[0].source;
    assert.deepEqual(repeated, baseline);

    if (IS_POSIX) {
      fs.chmodSync(source, 0o700);
      assert.equal(fs.lstatSync(source).mode & 0o7777, 0o700);
      const rootModeChanged = dryRun(fixture).comparisons[0].source;
      assert.notEqual(rootModeChanged.treeHash, baseline.treeHash);

      fs.chmodSync(source, 0o755);
      fs.chmodSync(childFile, 0o600);
      assert.equal(fs.lstatSync(childFile).mode & 0o7777, 0o600);
      const childFileModeChanged = dryRun(fixture).comparisons[0].source;
      assert.notEqual(childFileModeChanged.treeHash, baseline.treeHash);

      fs.chmodSync(childFile, 0o644);
      fs.chmodSync(childDirectory, 0o700);
      assert.equal(fs.lstatSync(childDirectory).mode & 0o7777, 0o700);
      const childDirectoryModeChanged = dryRun(fixture).comparisons[0].source;
      assert.notEqual(childDirectoryModeChanged.treeHash, baseline.treeHash);
    }

    fs.chmodSync(source, 0o755);
    fs.chmodSync(childDirectory, 0o755);
    fs.chmodSync(childFile, 0o644);
    fs.appendFileSync(childFile, "changed\n");
    const contentChanged = dryRun(fixture).comparisons[0].source;
    assert.notEqual(contentChanged.treeHash, baseline.treeHash);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects absolute, drive, and UNC root declarations portably", () => {
  const rejectedPaths = [
    "/tmp/skills",
    "/home/example/.agents/skills",
    "/Users/example/.agents/skills",
    "C:/Users/example/.agents/skills",
    "C:\\Users\\example\\.agents\\skills",
    "\\\\server\\share\\skills",
    "//server/share/skills",
  ];
  for (const rejectedPath of rejectedPaths) {
    const fixture = makeFixture();
    try {
      fixture.manifest.roots[1].path = rejectedPath;
      writeManifest(fixture);
      const result = run(fixture, ["--dry-run"]);
      assert.notEqual(result.status, 0, rejectedPath);
      assert.match(result.stderr, /root agents-skills\.path|portable|Windows drive|POSIX separators/, rejectedPath);
    } finally {
      removeFixture(fixture);
    }
  }
});

test("rejects home aliases, environment expansion, and relative traversal", () => {
  const rejectedPaths = [
    "~/../secret",
    "~//foo",
    "~/foo/../bar",
    "../outside",
    "nested/../../escape",
    "$HOME/.agents/skills",
    "${HOME}/.agents/skills",
    "~otheruser/.agents/skills",
  ];
  for (const rejectedPath of rejectedPaths) {
    const fixture = makeFixture();
    try {
      fixture.manifest.roots[1].path = rejectedPath;
      writeManifest(fixture);
      const result = run(fixture, ["--dry-run"]);
      assert.notEqual(result.status, 0, rejectedPath);
      assert.match(result.stderr, /root agents-skills\.path|escapes|normalized|environment|current user/, rejectedPath);
    } finally {
      removeFixture(fixture);
    }
  }
});

test("keeps dry-run and pending discovery output portable while retaining root identity", () => {
  const fixture = makeFixture();
  try {
    const dry = dryRun(fixture);
    const discovery = discover(fixture);
    for (const output of [dry, discovery]) {
      const serialized = JSON.stringify(output);
      assert.equal(serialized.includes(fixture.home), false);
      assert.equal(serialized.includes(fixture.upstream), false);
      assert.match(serialized, /agents-skills/);
      assert.match(serialized, /candidate-skill/);
    }
    assert.equal(discovery.sourceRoot.path, "~/.agents/skills");
    assert.equal(discovery.pending[0].sourcePath, "candidate-skill");
    assert.equal(discovery.pending[0].provenance, "MAPPED");
  } finally {
    removeFixture(fixture);
  }
});

test("keeps declared-root errors portable", () => {
  const fixture = makeFixture();
  try {
    fixture.manifest.roots[1].path = "~/.missing-skills";
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /declared root does not exist: agents-skills \(\~\/\.missing-skills\)/);
    assert.equal(result.stderr.includes(fixture.home), false);
  } finally {
    removeFixture(fixture);
  }
});

test("keeps missing manifest read errors portable", () => {
  const fixture = makeFixture();
  try {
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot read manifest: ENOENT/);
    assert.equal(result.stderr.includes(fixture.manifestFile), false);
    assert.equal(result.stderr.includes(fixture.base), false);
    assert.equal(result.stderr.includes(fixture.home), false);
  } finally {
    removeFixture(fixture);
  }
});

test("keeps missing apply-plan read errors portable", () => {
  const fixture = makeFixture();
  try {
    writeManifest(fixture);
    const missingPlan = path.join(fixture.base, "plans", "approved-plan.json");
    const result = run(fixture, ["--apply-plan", missingPlan]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot read apply plan: ENOENT/);
    assert.equal(result.stderr.includes(missingPlan), false);
    assert.equal(result.stderr.includes(fixture.base), false);
    assert.equal(result.stderr.includes(fixture.home), false);
  } finally {
    removeFixture(fixture);
  }
});

test("keeps declared metadata errors portable", () => {
  const fixture = makeFixture();
  try {
    fixture.manifest.metadata.skillsLock.path = "missing-skills-lock.json";
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /manifest\.metadata\.skillsLock\.path must be a non-symlink file: agents-skills:missing-skills-lock\.json/);
    assert.equal(result.stderr.includes(fixture.upstream), false);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects symlinked candidate trees without following them", () => {
  const fixture = makeFixture();
  try {
    const external = path.join(fixture.base, "external-skill");
    fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, "SKILL.md"), "# External\n");
    fs.rmSync(path.join(fixture.upstream, fixture.sourcePath), { recursive: true, force: true });
    fs.symlinkSync(external, path.join(fixture.upstream, fixture.sourcePath), "dir");
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /forbidden symlink/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects nested candidate paths", () => {
  const fixture = makeFixture();
  try {
    fixture.manifest.candidatePaths[0].sourcePath = "candidate-skill/nested";
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /direct-child skill directory/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects candidate mappings whose paths overlap", () => {
  const fixture = makeFixture();
  try {
    fixture.manifest.candidatePaths.push({
      sourceRoot: "agents-skills",
      sourcePath: "other-skill",
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      provenance: { kind: "manifest-candidate", requiresAudit: true },
    });
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /candidate target paths overlap/);
  } finally {
    removeFixture(fixture);
  }
});

test("treats a protected child as authority over a candidate parent", () => {
  const fixture = makeFixture({
    targetPath: "protected",
    protectedPaths: [{ root: "canonical", path: "protected/child", reason: "protected fixture" }],
  });
  try {
    const dry = dryRun(fixture);
    assert.equal(dry.comparisons[0].targetAuthority, "protected");
    const result = applyPlan(fixture, copyPlan(dry, dry.comparisons[0]));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /protected or excluded path/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a NEW copy without its bound audit record", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline);
    const dry = dryRun(fixture);
    const result = applyPlan(fixture, copyPlan(dry, dry.comparisons[0]));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /auditRecord must be an object/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("allows NEW copy for an existing mapping with a fresh audit receipt in add-import", () => {
  const fixture = makeFixture();
  try {
    const dry = dryRun(fixture);
    const comparison = dry.comparisons[0];
    const auditRecord = {
      recordId: "audit-existing-mapping-fresh-001",
      candidateSourcePath: comparison.sourcePath,
      sourceTreeHash: comparison.source.treeHash,
      manifestSha256: dry.manifestSha256,
      category: "RECOMMENDED",
    };
    const plan = copyPlan(dry, comparison, { auditRecord, operationId: "copy-existing-mapping-fresh" });
    plan.manifestUpdates[0].auditRecord = auditRecord;
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(appliedManifest.auditRecords[0].recordId, auditRecord.recordId);
    assert.equal(appliedManifest.imports[0].sourcePath, comparison.sourcePath);
  } finally {
    removeFixture(fixture);
  }
});

test("blocks a NEW copy when the only stored audit receipt is stale and no fresh receipt is supplied", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline, "stale-no-fresh");
    fs.appendFileSync(path.join(fixture.upstream, fixture.sourcePath, "SKILL.md"), "changed\n");
    const dry = dryRun(fixture);
    const comparison = dry.comparisons[0];
    assert.notEqual(fixture.manifest.auditRecords[0].sourceTreeHash, comparison.source.treeHash);
    const result = applyPlan(fixture, copyPlan(dry, comparison, { operationId: "copy-stale-no-fresh" }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /operations\[0\]\.auditRecord must be an object/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("allows a changed source to reimport with a fresh receipt while retaining its stale receipt", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline, "stale-with-fresh");
    fixture.manifest.auditRecords[0].category = "REDUNDANT";
    fs.appendFileSync(path.join(fixture.upstream, fixture.sourcePath, "SKILL.md"), "changed\n");
    const dry = dryRun(fixture);
    const comparison = dry.comparisons[0];
    const freshAuditRecord = {
      recordId: "audit-stale-with-fresh-current-001",
      candidateSourcePath: comparison.sourcePath,
      sourceTreeHash: comparison.source.treeHash,
      manifestSha256: dry.manifestSha256,
      category: "RECOMMENDED",
    };
    const plan = copyPlan(dry, comparison, {
      auditRecord: freshAuditRecord,
      operationId: "copy-stale-with-fresh",
    });
    plan.manifestUpdates[0].auditRecord = freshAuditRecord;
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.deepEqual(appliedManifest.auditRecords.map((record) => record.recordId), [
      "audit-stale-with-fresh",
      freshAuditRecord.recordId,
    ]);
    assert.equal(appliedManifest.imports[0].lastImportedTreeHash, comparison.source.treeHash);
  } finally {
    removeFixture(fixture);
  }
});

test("blocks a sole current-hash non-copy-eligible stored receipt without a fresh receipt", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    fixture.manifest.auditRecords = [{
      recordId: "audit-current-non-copy-only-001",
      candidateSourcePath: fixture.sourcePath,
      sourceTreeHash: baseline.comparisons[0].source.treeHash,
      manifestSha256: baseline.manifestSha256,
      category: "REDUNDANT",
    }];
    const dry = dryRun(fixture);
    const result = applyPlan(fixture, copyPlan(dry, dry.comparisons[0], {
      operationId: "copy-current-non-copy-only",
    }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contradictory non-copy-eligible audit receipts for the current source tree hash/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("blocks a fresh copy-eligible receipt when same-hash stored evidence is non-copy-eligible", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    fixture.manifest.auditRecords = [{
      recordId: "audit-current-non-copy-with-fresh-001",
      candidateSourcePath: fixture.sourcePath,
      sourceTreeHash: baseline.comparisons[0].source.treeHash,
      manifestSha256: baseline.manifestSha256,
      category: "REDUNDANT",
    }];
    const dry = dryRun(fixture);
    const comparison = dry.comparisons[0];
    const freshAuditRecord = {
      recordId: "audit-current-fresh-copy-eligible-001",
      candidateSourcePath: comparison.sourcePath,
      sourceTreeHash: comparison.source.treeHash,
      manifestSha256: dry.manifestSha256,
      category: "RECOMMENDED",
    };
    const plan = copyPlan(dry, comparison, {
      auditRecord: freshAuditRecord,
      operationId: "copy-current-non-copy-with-fresh",
    });
    plan.manifestUpdates[0].auditRecord = freshAuditRecord;
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contradictory non-copy-eligible audit receipts for the current source tree hash/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("blocks conflicting current-hash audit receipts instead of selecting one", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    const sourceTreeHash = baseline.comparisons[0].source.treeHash;
    fixture.manifest.auditRecords = [
      {
        recordId: "audit-conflict-recommended-001",
        candidateSourcePath: fixture.sourcePath,
        sourceTreeHash,
        manifestSha256: baseline.manifestSha256,
        category: "RECOMMENDED",
      },
      {
        recordId: "audit-conflict-redundant-001",
        candidateSourcePath: fixture.sourcePath,
        sourceTreeHash,
        manifestSha256: baseline.manifestSha256,
        category: "REDUNDANT",
      },
    ];
    const dry = dryRun(fixture);
    const result = applyPlan(fixture, copyPlan(dry, dry.comparisons[0], {
      auditRecord: fixture.manifest.auditRecords[0],
      operationId: "copy-conflicting-current-receipts",
    }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contradictory non-copy-eligible audit receipts for the current source tree hash/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a NEW copy with a mismatched stored audit record", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline);
    const dry = dryRun(fixture);
    const stored = fixture.manifest.auditRecords[0];
    const mismatched = { ...stored, sourceTreeHash: "0".repeat(64) };
    const result = applyPlan(fixture, copyPlan(dry, dry.comparisons[0], { auditRecord: mismatched }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match the current manifest audit record/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a NEW copy when no stored receipt exists and the plan omits a fresh receipt", () => {
  const fixture = makeFixture();
  try {
    const dry = dryRun(fixture);
    assert.equal(fixture.manifest.auditRecords.length, 0);
    const result = applyPlan(fixture, copyPlan(dry, dry.comparisons[0]));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /operations\[0\]\.auditRecord must be an object/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a NEW copy with a fresh receipt whose source hash is wrong", () => {
  const fixture = makeFixture();
  try {
    const dry = dryRun(fixture);
    const comparison = dry.comparisons[0];
    const auditRecord = {
      recordId: "audit-fresh-wrong-hash-001",
      candidateSourcePath: comparison.sourcePath,
      sourceTreeHash: "0".repeat(64),
      manifestSha256: dry.manifestSha256,
      category: "RECOMMENDED",
    };
    const plan = copyPlan(dry, comparison, { auditRecord, operationId: "copy-fresh-wrong-hash" });
    plan.manifestUpdates[0].auditRecord = auditRecord;
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /sourceTreeHash must match the current source tree hash/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a NEW copy with a fresh non-copy-eligible audit category", () => {
  const fixture = makeFixture();
  try {
    const dry = dryRun(fixture);
    const comparison = dry.comparisons[0];
    const auditRecord = {
      recordId: "audit-fresh-category-001",
      candidateSourcePath: comparison.sourcePath,
      sourceTreeHash: comparison.source.treeHash,
      manifestSha256: dry.manifestSha256,
      category: "REDUNDANT",
    };
    const plan = copyPlan(dry, comparison, { auditRecord, operationId: "copy-fresh-category" });
    plan.manifestUpdates[0].auditRecord = auditRecord;
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /category is not an allowed audit category/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a NEW copy without its required manifest update", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline);
    const dry = dryRun(fixture);
    const plan = copyPlan(dry, dry.comparisons[0], { auditRecord: fixture.manifest.auditRecords[0] });
    plan.manifestUpdates = [];
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /manifestUpdates must contain exactly one metadata update/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a NEW copy with mismatched manifest update metadata", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline);
    const dry = dryRun(fixture);
    const plan = copyPlan(dry, dry.comparisons[0], { auditRecord: fixture.manifest.auditRecords[0] });
    plan.manifestUpdates[0].importRecord.lastImportedTreeHash = "0".repeat(64);
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /lastImportedTreeHash must match the source tree hash/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("blocks NEW copy without an existing mapping or approved add-import mapping", () => {
  const fixture = makeFixture();
  try {
    const mappedDry = dryRun(fixture);
    fixture.manifest.candidatePaths = [];
    const unmappedDry = dryRun(fixture);
    const plan = copyPlan(mappedDry, mappedDry.comparisons[0]);
    plan.manifestSha256 = unmappedDry.manifestSha256;
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /NEW copy requires an existing candidate mapping or a bound add-import candidateRecord/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("allows NEW copy when approved add-import supplies the first mapping, receipt, and import", () => {
  const fixture = makeFixture();
  try {
    const mappedDry = dryRun(fixture);
    const comparison = mappedDry.comparisons[0];
    fixture.manifest.candidatePaths = [];
    const discovery = discover(fixture);
    assert.equal(discovery.pending[0].state, "UPSTREAM + PENDING");
    assert.equal(discovery.pending[0].provenance, "UNRESOLVED");
    assert.equal(discovery.pending[0].targetAuthority, null);
    const auditRecord = {
      recordId: "audit-first-pass-001",
      candidateSourcePath: comparison.sourcePath,
      sourceTreeHash: comparison.source.treeHash,
      manifestSha256: discovery.manifestSha256,
      category: "RECOMMENDED",
    };
    const plan = copyPlan(discovery, comparison, { auditRecord, operationId: "copy-first-pass" });
    plan.userApproval.decisionId = "decision-first-pass-001";
    plan.operations[0].approval.decisionId = "decision-first-pass-001";
    plan.manifestUpdates[0].approval.decisionId = "decision-first-pass-001";
    plan.manifestUpdates[0].candidateRecord = {
      sourceRoot: "agents-skills",
      sourcePath: comparison.sourcePath,
      targetRoot: "canonical",
      targetPath: comparison.targetPath,
      provenance: { kind: "manifest-candidate", requiresAudit: true },
    };
    plan.manifestUpdates[0].auditRecord = auditRecord;
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(appliedManifest.candidatePaths[0].sourcePath, comparison.sourcePath);
    assert.equal(appliedManifest.auditRecords[0].recordId, auditRecord.recordId);
    assert.equal(appliedManifest.imports[0].sourcePath, comparison.sourcePath);
    assert.equal(fs.readFileSync(path.join(fixture.canonical, fixture.targetPath, "SKILL.md"), "utf8"), "# Candidate\n");
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a first-time copy when its approved mutation omits the audit receipt", () => {
  const fixture = makeFixture();
  try {
    const mappedDry = dryRun(fixture);
    const comparison = mappedDry.comparisons[0];
    fixture.manifest.candidatePaths = [];
    const discovery = discover(fixture);
    const auditRecord = {
      recordId: "audit-first-pass-002",
      candidateSourcePath: comparison.sourcePath,
      sourceTreeHash: comparison.source.treeHash,
      manifestSha256: discovery.manifestSha256,
      category: "RECOMMENDED",
    };
    const plan = copyPlan(discovery, comparison, { auditRecord, operationId: "copy-first-pass-missing-receipt" });
    plan.userApproval.decisionId = "decision-first-pass-002";
    plan.operations[0].approval.decisionId = "decision-first-pass-002";
    plan.manifestUpdates[0].approval.decisionId = "decision-first-pass-002";
    plan.manifestUpdates[0].candidateRecord = {
      sourceRoot: "agents-skills",
      sourcePath: comparison.sourcePath,
      targetRoot: "canonical",
      targetPath: comparison.targetPath,
      provenance: { kind: "manifest-candidate", requiresAudit: true },
    };
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /auditRecord must be an object/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
  } finally {
    removeFixture(fixture);
  }
});

test("persists approved EXCLUDED and PROTECTED decisions and subtracts them from pending discovery", () => {
  const fixture = makeFixture();
  try {
    for (const sourcePath of ["excluded-skill", "protected-skill"]) {
      fs.mkdirSync(path.join(fixture.upstream, sourcePath));
      fs.writeFileSync(path.join(fixture.upstream, sourcePath, "SKILL.md"), `# ${sourcePath}\n`);
    }
    const before = discover(fixture);
    const entries = ["excluded-skill", "protected-skill"].map((sourcePath) => before.pending.find((entry) => entry.sourcePath === sourcePath));
    assert.equal(entries.every(Boolean), true);
    const plan = decisionPlan(before, [
      { ...entries[0], state: "EXCLUDED" },
      { ...entries[1], state: "PROTECTED" },
    ]);
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.deepEqual(appliedManifest.decisions.map((decision) => decision.state), ["EXCLUDED", "PROTECTED"]);
    fixture.manifest = appliedManifest;

    const after = discover(fixture);
    assert.equal(after.pending.some((entry) => entry.sourcePath === "excluded-skill"), false);
    assert.equal(after.pending.some((entry) => entry.sourcePath === "protected-skill"), false);
    assert.equal(after.states.find((entry) => entry.sourcePath === "excluded-skill").state, "UPSTREAM + EXCLUDED");
    assert.equal(after.states.find((entry) => entry.sourcePath === "protected-skill").state, "UPSTREAM + PROTECTED");
  } finally {
    removeFixture(fixture);
  }
});

test("removes a mapped candidate and its audit receipt while persisting a decision", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline, "mapped-decision");
    const before = discover(fixture);
    const entry = before.pending.find((candidate) => candidate.sourcePath === fixture.sourcePath);
    const plan = decisionPlan(before, [{ ...entry, state: "EXCLUDED", removeCandidate: true }]);
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(appliedManifest.candidatePaths.some((candidate) => candidate.sourcePath === fixture.sourcePath), false);
    assert.equal(appliedManifest.auditRecords.some((record) => record.candidateSourcePath === fixture.sourcePath), false);
    assert.equal(appliedManifest.decisions[0].sourcePath, fixture.sourcePath);
  } finally {
    removeFixture(fixture);
  }
});

test("replaces a stale decision by source path and rejects an exact duplicate", () => {
  const fixture = makeFixture();
  try {
    const before = discover(fixture);
    const firstPlan = decisionPlan(before, [{ ...before.pending.find((entry) => entry.sourcePath === fixture.sourcePath), state: "EXCLUDED", removeCandidate: true }]);
    let result = applyPlan(fixture, firstPlan);
    assert.equal(result.status, 0, result.stderr);
    fixture.manifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));

    const exact = discover(fixture);
    const exactEntry = exact.states.find((entry) => entry.sourcePath === fixture.sourcePath);
    result = applyPlan(fixture, decisionPlan(exact, [{ ...exactEntry, state: "EXCLUDED" }]));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exact duplicate/);

    fs.appendFileSync(path.join(fixture.upstream, fixture.sourcePath, "SKILL.md"), "changed\n");
    const stale = discover(fixture);
    const staleEntry = stale.states.find((entry) => entry.sourcePath === fixture.sourcePath);
    const replacement = decisionPlan(stale, [{
      ...staleEntry,
      state: "PROTECTED",
      replaceDecision: true,
    }]);
    result = applyPlan(fixture, replacement);
    assert.equal(result.status, 0, result.stderr);
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(appliedManifest.decisions.length, 1);
    assert.equal(appliedManifest.decisions[0].state, "PROTECTED");
    assert.equal(appliedManifest.decisions[0].sourceTreeHash, staleEntry.sourceTreeHash);
  } finally {
    removeFixture(fixture);
  }
});

test("keeps missing and invalid decision sources in stale decision observations", () => {
  const fixture = makeFixture();
  try {
    fs.writeFileSync(path.join(fixture.upstream, "invalid-decision"), "not a skill\n");
    const hash = "0".repeat(64);
    fixture.manifest.decisions = [
      {
        id: "decision-missing",
        root: "agents-skills",
        sourcePath: "missing-decision",
        state: "EXCLUDED",
        sourceTreeHash: hash,
        reason: "Missing fixture source",
        auditVerdict: null,
        evidenceRef: null,
        approvalDecisionId: "decision-fixture",
        userApprovalMarker: APPROVAL_MARKER,
      },
      {
        id: "decision-invalid",
        root: "agents-skills",
        sourcePath: "invalid-decision",
        state: "PROTECTED",
        sourceTreeHash: hash,
        reason: "Invalid fixture source",
        auditVerdict: null,
        evidenceRef: null,
        approvalDecisionId: "decision-fixture",
        userApprovalMarker: APPROVAL_MARKER,
      },
    ];
    const result = discover(fixture);
    assert.equal(result.decisionObservations.length, 2);
    assert.equal(result.staleDecisions.length, 2);
    assert.equal(result.decisionObservations.find((entry) => entry.sourcePath === "missing-decision").source.kind, "missing");
    assert.equal(result.decisionObservations.find((entry) => entry.sourcePath === "invalid-decision").staleDecision, true);
    assert.equal(result.pending.some((entry) => entry.sourcePath === "missing-decision"), false);
  } finally {
    removeFixture(fixture);
  }
});

test("maps target protected and excluded authority into discovery states", () => {
  for (const authority of ["protected", "excluded"]) {
    const fixture = makeFixture();
    try {
      fixture.manifest[`${authority}Paths`].push({ root: "canonical", path: fixture.targetPath, reason: `${authority} fixture` });
      const result = discover(fixture);
      const entry = result.states.find((candidate) => candidate.sourcePath === fixture.sourcePath);
      assert.equal(entry.state, `UPSTREAM + ${authority.toUpperCase()}`);
      assert.equal(entry.targetAuthority, authority);
      assert.equal(entry.targetAuthorityEvidence.state, authority);
      assert.equal(result.pending.some((candidate) => candidate.sourcePath === fixture.sourcePath), false);
    } finally {
      removeFixture(fixture);
    }
  }
});

test("subtracts persisted decisions from dry-run unlisted source paths", () => {
  const fixture = makeFixture();
  try {
    const sourcePath = "unlisted-decision";
    fs.mkdirSync(path.join(fixture.upstream, sourcePath));
    fs.writeFileSync(path.join(fixture.upstream, sourcePath, "SKILL.md"), "# Unlisted\n");
    const before = dryRun(fixture);
    assert.equal(before.unlistedSourcePaths.some((entry) => entry.path === sourcePath), true);
    const discovery = discover(fixture);
    const entry = discovery.pending.find((candidate) => candidate.sourcePath === sourcePath);
    const plan = decisionPlan(discovery, [{ ...entry, state: "EXCLUDED" }]);
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    fixture.manifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    const after = dryRun(fixture);
    assert.equal(after.unlistedSourcePaths.some((candidate) => candidate.path === sourcePath), false);
  } finally {
    removeFixture(fixture);
  }
});

test("discovery rejects invalid direct candidates without aborting the valid inventory", () => {
  const fixture = makeFixture({
    protectedPaths: [{ root: "agents-skills", path: "protected-skill", reason: "fixture protection" }],
  });
  try {
    fs.mkdirSync(path.join(fixture.upstream, "protected-skill"));
    fs.writeFileSync(path.join(fixture.upstream, "protected-skill", "SKILL.md"), "# Protected\n");
    fs.mkdirSync(path.join(fixture.upstream, "nested-link-skill"));
    fs.writeFileSync(path.join(fixture.upstream, "nested-link-skill", "SKILL.md"), "# Nested link\n");
    const external = path.join(fixture.base, "outside");
    fs.mkdirSync(external);
    fs.symlinkSync(external, path.join(fixture.upstream, "nested-link-skill", "linked"), "dir");
    fs.symlinkSync(external, path.join(fixture.upstream, "excluded-link"), "dir");
    fixture.manifest.excludedPaths.push({ root: "agents-skills", path: "excluded-link", reason: "fixture exclusion" });
    const result = discover(fixture);
    assert.equal(result.states.some((entry) => entry.sourcePath === fixture.sourcePath), true);
    assert.equal(result.states.some((entry) => entry.sourcePath === "protected-skill"), true);
    assert.equal(result.rejectedPaths.some((entry) => entry.path === "nested-link-skill"), true);
    assert.equal(result.rejectedPaths.some((entry) => entry.path === "excluded-link"), true);
  } finally {
    removeFixture(fixture);
  }
});

test("classifies restricted roots before recursive inspection and preserves normal symlink rejection", () => {
  const fixture = makeFixture();
  const restrictedRoots = [
    { sourcePath: "protected-root", manifestKey: "protectedPaths", state: "PROTECTED" },
    { sourcePath: "excluded-root", manifestKey: "excludedPaths", state: "EXCLUDED" },
  ];
  try {
    const external = path.join(fixture.base, "restricted-external");
    fs.mkdirSync(external);
    for (const { sourcePath, manifestKey, state } of restrictedRoots) {
      const root = path.join(fixture.upstream, sourcePath);
      const nested = path.join(root, "nested");
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(root, "SKILL.md"), `# ${sourcePath}\n`);
      fs.symlinkSync(external, path.join(nested, "forbidden"), "dir");
      const unreadable = path.join(nested, "unreadable");
      fs.mkdirSync(unreadable);
      if (IS_POSIX) fs.chmodSync(unreadable, 0o000);
      fixture.manifest[manifestKey].push({ root: "agents-skills", path: sourcePath, reason: `${state} fixture` });
    }

    const discovery = discover(fixture);
    for (const { sourcePath, state } of restrictedRoots) {
      const observation = discovery.states.find((entry) => entry.sourcePath === sourcePath);
      assert.equal(observation.state, `UPSTREAM + ${state}`);
      assert.equal(observation.sourceTreeHash, null);
      assert.equal(Object.hasOwn(observation, "source"), false);
    }
    assert.deepEqual(discovery.pending.map((entry) => entry.sourcePath), [fixture.sourcePath]);

    const normalFixture = makeFixture();
    try {
      const normalSource = path.join(normalFixture.upstream, normalFixture.sourcePath);
      const normalNested = path.join(normalSource, "nested");
      const normalExternal = path.join(normalFixture.base, "normal-external");
      fs.mkdirSync(normalNested);
      fs.mkdirSync(normalExternal);
      fs.symlinkSync(normalExternal, path.join(normalNested, "forbidden"), "dir");
      writeManifest(normalFixture);
      const result = run(normalFixture, ["--dry-run"]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /forbidden symlink encountered while hashing: nested\/forbidden/);
    } finally {
      removeFixture(normalFixture);
    }
  } finally {
    for (const { sourcePath } of restrictedRoots) {
      const unreadable = path.join(fixture.upstream, sourcePath, "nested", "unreadable");
      if (IS_POSIX && fs.existsSync(unreadable)) fs.chmodSync(unreadable, 0o755);
    }
    removeFixture(fixture);
  }
});

test("rejects a persisted decision without the exact approval marker", () => {
  const fixture = makeFixture();
  try {
    fs.mkdirSync(path.join(fixture.upstream, "decision-skill"));
    fs.writeFileSync(path.join(fixture.upstream, "decision-skill", "SKILL.md"), "# Decision\n");
    const discovery = discover(fixture);
    const entry = discovery.pending.find((candidate) => candidate.sourcePath === "decision-skill");
    const plan = decisionPlan(discovery, [{ ...entry, state: "EXCLUDED" }]);
    plan.operations[0].approval.marker = "not-user-approval";
    refreshApprovalPayload(plan);
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /approval\.marker/);
    assert.equal(JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8")).decisions.length, 0);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a tombstone for an unmanaged target", () => {
  const fixture = makeFixture();
  try {
    fs.rmSync(path.join(fixture.upstream, fixture.sourcePath), { recursive: true, force: true });
    fs.mkdirSync(path.join(fixture.canonical, fixture.targetPath));
    fs.writeFileSync(path.join(fixture.canonical, fixture.targetPath, "SKILL.md"), "# Local\n");
    fixture.manifest.tombstones = [{
      id: "delete-unmanaged",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "approved",
      deleteAuthorized: true,
    }];
    writeManifest(fixture);
    const result = run(fixture, ["--dry-run"]);
    assert.equal(result.status, 0, result.stderr);
    const dry = JSON.parse(result.stdout);
    const decisionId = "decision-delete-unmanaged-001";
    const operationId = "delete-unmanaged";
    const plan = withApprovalPayload({
      schemaVersion: 3,
      kind: "skills-curator-approved-plan",
      approved: true,
      manifestSha256: dry.manifestSha256,
      userApproval: { marker: APPROVAL_MARKER, decisionId, approvedOperationIds: [operationId] },
      operations: [{
        operationId,
        operation: "delete",
        sourceRoot: "agents-skills",
        sourcePath: fixture.sourcePath,
        targetRoot: "canonical",
        targetPath: fixture.targetPath,
        expectedSourceTreeHash: null,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: "delete-unmanaged",
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
      manifestUpdates: [{
        operationId,
        action: "remove-import",
        expectedSourceTreeHash: null,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: "delete-unmanaged",
        tombstoneRecord: null,
        removeCandidate: false,
        replaceDecision: false,
        candidateRecord: null,
        auditRecord: null,
        importRecord: null,
        decisionRecord: null,
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
    });
    const applyResult = applyPlan(fixture, plan);
    assert.notEqual(applyResult.status, 0);
    assert.match(applyResult.stderr, /matching managed import/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects delete when the managed target has drifted", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    const baselineHash = baseline.comparisons[0].source.treeHash;
    const source = path.join(fixture.upstream, fixture.sourcePath);
    const target = path.join(fixture.canonical, fixture.targetPath);
    fs.cpSync(source, target, { recursive: true });
    fs.appendFileSync(path.join(target, "SKILL.md"), "drift\n");
    fs.rmSync(source, { recursive: true, force: true });
    fixture.manifest.imports = [{
      id: "import-candidate",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "managed",
      lastImportedTreeHash: baselineHash,
      authority: { kind: "manifest-explicit-baseline", basis: "fixture baseline" },
    }];
    fixture.manifest.tombstones = [{
      id: "delete-candidate",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "approved",
      deleteAuthorized: true,
    }];
    const dry = dryRun(fixture);
    const decisionId = "decision-delete-001";
    const operationId = "delete-candidate";
    const plan = withApprovalPayload({
      schemaVersion: 3,
      kind: "skills-curator-approved-plan",
      approved: true,
      manifestSha256: dry.manifestSha256,
      userApproval: { marker: APPROVAL_MARKER, decisionId, approvedOperationIds: [operationId] },
      operations: [{
        operationId,
        operation: "delete",
        sourceRoot: "agents-skills",
        sourcePath: fixture.sourcePath,
        targetRoot: "canonical",
        targetPath: fixture.targetPath,
        expectedSourceTreeHash: null,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: "delete-candidate",
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
      manifestUpdates: [{
        operationId,
        action: "remove-import",
        expectedSourceTreeHash: null,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: "delete-candidate",
        tombstoneRecord: null,
        removeCandidate: false,
        replaceDecision: false,
        candidateRecord: null,
        auditRecord: null,
        importRecord: null,
        decisionRecord: null,
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
    });
    const result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /drifted from its recorded imported hash/);
    assert.equal(fs.existsSync(target), true);
  } finally {
    removeFixture(fixture);
  }
});

test("applies an approved delete by removing only the managed import", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    const baselineHash = baseline.comparisons[0].source.treeHash;
    const source = path.join(fixture.upstream, fixture.sourcePath);
    const target = path.join(fixture.canonical, fixture.targetPath);
    fs.cpSync(source, target, { recursive: true });
    fs.rmSync(source, { recursive: true, force: true });
    fixture.manifest.imports = [{
      id: "import-candidate",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "managed",
      lastImportedTreeHash: baselineHash,
      authority: { kind: "manifest-explicit-baseline", basis: "fixture baseline" },
    }];
    fixture.manifest.tombstones = [{
      id: "delete-candidate",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "approved",
      deleteAuthorized: true,
    }];
    const dry = dryRun(fixture);
    const decisionId = "decision-delete-success-001";
    const operationId = "delete-candidate";
    const plan = withApprovalPayload({
      schemaVersion: 3,
      kind: "skills-curator-approved-plan",
      approved: true,
      manifestSha256: dry.manifestSha256,
      userApproval: { marker: APPROVAL_MARKER, decisionId, approvedOperationIds: [operationId] },
      operations: [{
        operationId,
        operation: "delete",
        sourceRoot: "agents-skills",
        sourcePath: fixture.sourcePath,
        targetRoot: "canonical",
        targetPath: fixture.targetPath,
        expectedSourceTreeHash: null,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: "delete-candidate",
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
      manifestUpdates: [{
        operationId,
        action: "remove-import",
        expectedSourceTreeHash: null,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: "delete-candidate",
        tombstoneRecord: null,
        removeCandidate: false,
        replaceDecision: false,
        candidateRecord: null,
        auditRecord: null,
        importRecord: null,
        decisionRecord: null,
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
    });
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(target), false);
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(appliedManifest.imports.length, 0);
    assert.equal(appliedManifest.tombstones[0].id, "delete-candidate");
  } finally {
    removeFixture(fixture);
  }
});

test("atomically creates a new tombstone while removing a managed import", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    const baselineHash = baseline.comparisons[0].source.treeHash;
    const source = path.join(fixture.upstream, fixture.sourcePath);
    const target = path.join(fixture.canonical, fixture.targetPath);
    fs.cpSync(source, target, { recursive: true });
    fs.rmSync(source, { recursive: true, force: true });
    fixture.manifest.imports = [{
      id: "import-candidate",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "managed",
      lastImportedTreeHash: baselineHash,
      authority: { kind: "manifest-explicit-baseline", basis: "fixture new tombstone" },
    }];
    const dry = dryRun(fixture);
    const decisionId = "decision-delete-new-tombstone-001";
    const operationId = "delete-new-tombstone";
    const tombstoneRecord = {
      id: "delete-new-tombstone",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "approved",
      deleteAuthorized: true,
    };
    const plan = withApprovalPayload({
      schemaVersion: 3,
      kind: "skills-curator-approved-plan",
      approved: true,
      manifestSha256: dry.manifestSha256,
      userApproval: { marker: APPROVAL_MARKER, decisionId, approvedOperationIds: [operationId] },
      operations: [{
        operationId,
        operation: "delete",
        sourceRoot: "agents-skills",
        sourcePath: fixture.sourcePath,
        targetRoot: "canonical",
        targetPath: fixture.targetPath,
        expectedSourceTreeHash: null,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: null,
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
      manifestUpdates: [{
        operationId,
        action: "remove-import",
        expectedSourceTreeHash: null,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: null,
        tombstoneRecord,
        removeCandidate: false,
        replaceDecision: false,
        candidateRecord: null,
        auditRecord: null,
        importRecord: null,
        decisionRecord: null,
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
    });
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(target), false);
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(appliedManifest.imports.length, 0);
    assert.deepEqual(appliedManifest.tombstones[0], tombstoneRecord);
  } finally {
    removeFixture(fixture);
  }
});

test("retains historical receipts and tombstones across an approved changed-source reimport", () => {
  const fixture = makeFixture();
  try {
    const initialDry = dryRun(fixture);
    const initialComparison = initialDry.comparisons[0];
    const receiptA = {
      recordId: "audit-lifecycle-a-001",
      candidateSourcePath: initialComparison.sourcePath,
      sourceTreeHash: initialComparison.source.treeHash,
      manifestSha256: initialDry.manifestSha256,
      category: "RECOMMENDED",
    };
    const importAPlan = copyPlan(initialDry, initialComparison, {
      auditRecord: receiptA,
      operationId: "import-lifecycle-a",
    });
    importAPlan.manifestUpdates[0].auditRecord = receiptA;
    refreshApprovalPayload(importAPlan);
    let result = applyPlan(fixture, importAPlan);
    assert.equal(result.status, 0, result.stderr);
    fixture.manifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(fs.readFileSync(path.join(fixture.canonical, fixture.targetPath, "SKILL.md"), "utf8"), "# Candidate\n");

    fs.rmSync(path.join(fixture.upstream, fixture.sourcePath), { recursive: true, force: true });
    const deleteDry = dryRun(fixture);
    const deleteComparison = deleteDry.comparisons[0];
    const tombstone = {
      id: "delete-lifecycle-a",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "approved",
      deleteAuthorized: true,
    };
    result = applyPlan(fixture, newTombstoneDeletePlan(deleteDry, deleteComparison, tombstone));
    assert.equal(result.status, 0, result.stderr);
    const afterDelete = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);
    assert.equal(afterDelete.imports.length, 0);
    assert.deepEqual(afterDelete.auditRecords, [receiptA]);
    assert.deepEqual(afterDelete.tombstones, [tombstone]);
    fixture.manifest = afterDelete;

    fs.mkdirSync(path.join(fixture.upstream, fixture.sourcePath), { recursive: true });
    fs.writeFileSync(path.join(fixture.upstream, fixture.sourcePath, "SKILL.md"), "# Candidate B\n");
    const reimportDry = dryRun(fixture);
    const reimportComparison = reimportDry.comparisons[0];
    const receiptB = {
      recordId: "audit-lifecycle-b-001",
      candidateSourcePath: reimportComparison.sourcePath,
      sourceTreeHash: reimportComparison.source.treeHash,
      manifestSha256: reimportDry.manifestSha256,
      category: "RECOMMENDED",
    };
    const importBPlan = copyPlan(reimportDry, reimportComparison, {
      auditRecord: receiptB,
      operationId: "import-lifecycle-b",
    });
    importBPlan.manifestUpdates[0].auditRecord = receiptB;
    refreshApprovalPayload(importBPlan);
    result = applyPlan(fixture, importBPlan);
    assert.equal(result.status, 0, result.stderr);
    const afterReimport = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(fs.readFileSync(path.join(fixture.canonical, fixture.targetPath, "SKILL.md"), "utf8"), "# Candidate B\n");
    assert.equal(afterReimport.imports[0].lastImportedTreeHash, reimportComparison.source.treeHash);
    assert.deepEqual(afterReimport.auditRecords.map((record) => record.recordId), [receiptA.recordId, receiptB.recordId]);
    assert.deepEqual(afterReimport.tombstones, [tombstone]);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a new tombstone delete when the managed target has drifted", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    const baselineHash = baseline.comparisons[0].source.treeHash;
    const source = path.join(fixture.upstream, fixture.sourcePath);
    const target = path.join(fixture.canonical, fixture.targetPath);
    fs.cpSync(source, target, { recursive: true });
    fs.appendFileSync(path.join(target, "SKILL.md"), "drift\n");
    fs.rmSync(source, { recursive: true, force: true });
    fixture.manifest.imports = [{
      id: "import-new-tombstone-drift",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "managed",
      lastImportedTreeHash: baselineHash,
      authority: { kind: "manifest-explicit-baseline", basis: "fixture new tombstone drift" },
    }];
    const dry = dryRun(fixture);
    const tombstoneRecord = {
      id: "delete-new-tombstone-drift",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "approved",
      deleteAuthorized: true,
    };
    const result = applyPlan(fixture, newTombstoneDeletePlan(dry, dry.comparisons[0], tombstoneRecord));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /delete target drifted from its recorded imported hash/);
    assert.equal(fs.existsSync(target), true);
    assert.equal(JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8")).tombstones.length, 0);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects a new tombstone delete for an unmanaged target", () => {
  const fixture = makeFixture();
  try {
    fs.rmSync(path.join(fixture.upstream, fixture.sourcePath), { recursive: true, force: true });
    const target = path.join(fixture.canonical, fixture.targetPath);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "SKILL.md"), "# Local\n");
    const dry = dryRun(fixture);
    const tombstoneRecord = {
      id: "delete-new-tombstone-unmanaged",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "approved",
      deleteAuthorized: true,
    };
    const result = applyPlan(fixture, newTombstoneDeletePlan(dry, dry.comparisons[0], tombstoneRecord));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /matching managed import/);
    assert.equal(fs.existsSync(target), true);
    assert.equal(JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8")).tombstones.length, 0);
  } finally {
    removeFixture(fixture);
  }
});

test("reuses a stored current-hash copy-eligible receipt for NEW copy", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline);
    const dry = dryRun(fixture);
    assert.equal(fixture.manifest.auditRecords[0].sourceTreeHash, dry.comparisons[0].source.treeHash);
    assert.equal(fixture.manifest.auditRecords[0].category, "RECOMMENDED");
    const result = applyPlan(fixture, copyPlan(dry, dry.comparisons[0], { auditRecord: fixture.manifest.auditRecords[0] }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).applied[0].operation, "copy");
    assert.equal(fs.readFileSync(path.join(fixture.canonical, fixture.targetPath, "SKILL.md"), "utf8"), "# Candidate\n");
    const appliedManifest = JSON.parse(fs.readFileSync(fixture.manifestFile, "utf8"));
    assert.equal(appliedManifest.imports[0].lastImportedTreeHash, dry.comparisons[0].source.treeHash);
    assert.equal(appliedManifest.auditRecords[0].recordId, fixture.manifest.auditRecords[0].recordId);
  } finally {
    removeFixture(fixture);
  }
});

test("blocks NEW copy for a managed import and reserves the mutation for replace", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline, "managed-copy");
    const source = path.join(fixture.upstream, fixture.sourcePath);
    const target = path.join(fixture.canonical, fixture.targetPath);
    fs.cpSync(source, target, { recursive: true });
    fixture.manifest.imports = [{
      id: "import-managed-copy",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "managed",
      lastImportedTreeHash: baseline.comparisons[0].source.treeHash,
      authority: { kind: "manifest-explicit-baseline", basis: "fixture managed import" },
    }];
    const dry = dryRun(fixture);
    const result = applyPlan(fixture, copyPlan(dry, dry.comparisons[0], {
      auditRecord: fixture.manifest.auditRecords[0],
      operationId: "new-managed-copy",
    }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /copy cannot replace a managed import; use replace/);
    assert.equal(fs.existsSync(target), true);
  } finally {
    removeFixture(fixture);
  }
});

test("applies an approved replacement only when the managed target is unchanged", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    const source = path.join(fixture.upstream, fixture.sourcePath);
    const target = path.join(fixture.canonical, fixture.targetPath);
    fs.cpSync(source, target, { recursive: true });
    fs.appendFileSync(path.join(source, "SKILL.md"), "updated\n");
    fixture.manifest.imports = [{
      id: "import-candidate",
      sourceRoot: "agents-skills",
      sourcePath: fixture.sourcePath,
      targetRoot: "canonical",
      targetPath: fixture.targetPath,
      status: "managed",
      lastImportedTreeHash: baseline.comparisons[0].source.treeHash,
      authority: { kind: "manifest-explicit-baseline", basis: "fixture baseline" },
    }];
    const dry = dryRun(fixture);
    const decisionId = "decision-replace-001";
    const operationId = "replace-candidate";
    const plan = withApprovalPayload({
      schemaVersion: 3,
      kind: "skills-curator-approved-plan",
      approved: true,
      manifestSha256: dry.manifestSha256,
      userApproval: { marker: APPROVAL_MARKER, decisionId, approvedOperationIds: [operationId] },
      operations: [{
        operationId,
        operation: "replace",
        sourceRoot: "agents-skills",
        sourcePath: fixture.sourcePath,
        targetRoot: "canonical",
        targetPath: fixture.targetPath,
        expectedSourceTreeHash: dry.comparisons[0].source.treeHash,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
      manifestUpdates: [{
        operationId,
        action: "update-import",
        expectedSourceTreeHash: dry.comparisons[0].source.treeHash,
        expectedTargetTreeHash: dry.comparisons[0].target.treeHash,
        tombstoneId: null,
        tombstoneRecord: null,
        removeCandidate: false,
        replaceDecision: false,
        candidateRecord: null,
        auditRecord: null,
        importRecord: {
          id: "import-candidate",
          sourceRoot: "agents-skills",
          sourcePath: fixture.sourcePath,
          targetRoot: "canonical",
          targetPath: fixture.targetPath,
          status: "managed",
          lastImportedTreeHash: dry.comparisons[0].source.treeHash,
          authority: { kind: "manifest-explicit-baseline", basis: "fixture approved replacement" },
        },
        decisionRecord: null,
        approval: { approved: true, marker: APPROVAL_MARKER, decisionId, operationId },
      }],
    });
    const result = applyPlan(fixture, plan);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(target, "SKILL.md"), "utf8"), "# Candidate\nupdated\n");
  } finally {
    removeFixture(fixture);
  }
});

test("rechecks the manifest digest and source hash before applying a plan", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline, "toctou-copy");
    const dry = dryRun(fixture);
    const plan = copyPlan(dry, dry.comparisons[0], { auditRecord: fixture.manifest.auditRecords[0], operationId: "toctou-copy" });
    fs.appendFileSync(path.join(fixture.upstream, fixture.sourcePath, "SKILL.md"), "source changed\n");
    let result = applyPlan(fixture, plan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source hash changed/);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false);

    const fresh = dryRun(fixture);
    const freshPlan = copyPlan(fresh, fresh.comparisons[0], { auditRecord: fixture.manifest.auditRecords[0], operationId: "toctou-manifest" });
    fixture.manifest.protectedPaths.push({ root: "canonical", path: "other-protected", reason: "manifest changed after planning" });
    writeManifest(fixture);
    result = applyPlan(fixture, freshPlan);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /manifest SHA-256 does not match/);
  } finally {
    removeFixture(fixture);
  }
});

test("rejects approval payload mutations and changed digests", () => {
  const mutations = [
    ["operation target", (plan) => { plan.operations[0].targetPath = "mutated-target"; }],
    ["operation source hash", (plan) => { plan.operations[0].expectedSourceTreeHash = "0".repeat(64); }],
    ["manifest update import", (plan) => { plan.manifestUpdates[0].importRecord.targetPath = "mutated-target"; }],
    ["approval operation set", (plan) => { plan.userApproval.approvedOperationIds = ["other-operation"]; }],
    ["approval decision", (plan) => { plan.userApproval.decisionId = "other-decision"; }],
    ["changed digest", (plan) => { plan.approvalPayloadSha256 = "0".repeat(64); }],
  ];
  for (const [label, mutate] of mutations) {
    const fixture = makeFixture();
    try {
      const baseline = dryRun(fixture);
      seedAuditRecord(fixture, baseline, `payload-${label.replaceAll(" ", "-")}`);
      const dry = dryRun(fixture);
      const plan = copyPlan(dry, dry.comparisons[0], { auditRecord: fixture.manifest.auditRecords[0], operationId: `payload-${label.replaceAll(" ", "-")}` });
      mutate(plan);
      const result = applyPlan(fixture, plan);
      assert.notEqual(result.status, 0, label);
      assert.match(result.stderr, /approvalPayloadSha256/, label);
      assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), false, label);
    } finally {
      removeFixture(fixture);
    }
  }
});

test("accepts a valid approval payload digest independent of object key order", () => {
  const fixture = makeFixture();
  try {
    const baseline = dryRun(fixture);
    seedAuditRecord(fixture, baseline, "payload-key-order");
    const dry = dryRun(fixture);
    const plan = copyPlan(dry, dry.comparisons[0], { auditRecord: fixture.manifest.auditRecords[0], operationId: "payload-key-order" });
    const reorderedPlan = Object.fromEntries(Object.entries(plan).reverse());
    const result = applyPlan(fixture, reorderedPlan);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(fixture.canonical, fixture.targetPath)), true);
  } finally {
    removeFixture(fixture);
  }
});

test("keeps the helper executable with no external runtime dependencies", () => {
  const output = execFileSync(process.execPath, [SCRIPT, "--help"], { encoding: "utf8" });
  assert.match(output, /--dry-run/);
  assert.match(output, /--discover-pending/);
  assert.match(output, /--apply-plan/);
});
