import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST_PATH = path.resolve(
  SCRIPT_DIRECTORY,
  "..",
  "setup",
  "upstream-skills.json",
);
const CLI_AGENT = "opencode";
const LOCK_FILE = ".skill-lock.json";
const LOCK_VERSION = 3;
const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SOURCE_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})?\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})?$/u;
const PATH_PATTERN = /^[A-Za-z0-9._/-]+$/u;
const HASH_PATTERN = /^[0-9a-f]{40}$/iu;
const CHILD_HOST_ENVIRONMENT_KEYS = [
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "ComSpec",
  "TMPDIR",
  "TEMP",
  "TMP",
];
const CHILD_PROBE_OVERRIDE_KEYS = new Set([
  "XDG_CACHE_HOME",
  "TMPDIR",
  "TEMP",
  "TMP",
  "npm_config_cache",
]);
const OPEN_CODE_SKILLS_SUFFIX = path.join("opencode", "skills");

export class BootstrapError extends Error {
  constructor(message) {
    super(message);
    this.name = "BootstrapError";
  }
}

function fail(message) {
  throw new BootstrapError(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, expected, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort(compareStrings);
  const wanted = [...expected].sort(compareStrings);
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} has unknown or missing fields`);
  }
}

function assertSafeText(value, label) {
  if (/^[\u0000-\u001f\u007f]/u.test(value) || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(`${label} contains control characters`);
  }
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function validateSkillName(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 64 ||
    !SKILL_NAME_PATTERN.test(value)
  ) {
    fail(`${label} is not a normalized skill name`);
  }
  assertSafeText(value, label);
  return value;
}

function validateSource(value, label) {
  if (typeof value !== "string" || !SOURCE_PATTERN.test(value)) {
    fail(`${label} is not a GitHub owner/repository identity`);
  }
  assertSafeText(value, label);
  return value;
}

function validateSourceUrl(value, source, label) {
  if (typeof value !== "string") fail(`${label} must be a string`);
  assertSafeText(value, label);

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} is not a valid URL`);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    fail(`${label} must be a normalized HTTPS GitHub URL`);
  }

  const pathname = parsed.pathname;
  const sourceFromUrl = pathname.startsWith("/") && pathname.endsWith(".git")
    ? pathname.slice(1, -4)
    : "";
  if (sourceFromUrl !== source || value !== `https://github.com/${source}.git`) {
    fail(`${label} does not match its GitHub source identity`);
  }
  return value;
}

function validateSkillPath(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a relative SKILL.md path`);
  }
  assertSafeText(value, label);
  if (
    value.includes("\\") ||
    !PATH_PATTERN.test(value) ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("//")
  ) {
    fail(`${label} is not a normalized relative path`);
  }

  const segments = value.split("/");
  if (
    segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
    segments.some((segment) => !/^[A-Za-z0-9._-]+$/u.test(segment)) ||
    segments.at(-1) !== "SKILL.md"
  ) {
    fail(`${label} is not a normalized relative SKILL.md path`);
  }
  return value;
}

export function validateManifest(value) {
  assertExactKeys(value, ["schemaVersion", "sources"], "manifest");
  if (value.schemaVersion !== 1) fail("manifest schemaVersion must be 1");
  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    fail("manifest sources must be a non-empty array");
  }

  const sourceNames = new Set();
  const sourceUrls = new Set();
  const skillNames = new Set();
  const sources = value.sources.map((sourceValue, sourceIndex) => {
    const sourceLabel = `manifest.sources[${sourceIndex}]`;
    assertExactKeys(sourceValue, ["source", "sourceUrl", "skills"], sourceLabel);
    const source = validateSource(sourceValue.source, `${sourceLabel}.source`);
    const sourceUrl = validateSourceUrl(
      sourceValue.sourceUrl,
      source,
      `${sourceLabel}.sourceUrl`,
    );
    if (sourceNames.has(source) || sourceUrls.has(sourceUrl)) {
      fail("manifest contains duplicate source groups");
    }
    sourceNames.add(source);
    sourceUrls.add(sourceUrl);
    if (!Array.isArray(sourceValue.skills) || sourceValue.skills.length === 0) {
      fail(`${sourceLabel}.skills must be a non-empty array`);
    }

    const skills = sourceValue.skills.map((skillValue, skillIndex) => {
      const skillLabel = `${sourceLabel}.skills[${skillIndex}]`;
      assertExactKeys(skillValue, ["name", "skillPath"], skillLabel);
      const name = validateSkillName(skillValue.name, `${skillLabel}.name`);
      const skillPath = validateSkillPath(
        skillValue.skillPath,
        `${skillLabel}.skillPath`,
      );
      if (skillNames.has(name)) fail("manifest contains duplicate skill names");
      skillNames.add(name);
      return { name, skillPath };
    });

    skills.sort((left, right) => compareStrings(left.name, right.name));
    return { source, sourceUrl, skills };
  });

  sources.sort((left, right) => {
    const sourceOrder = compareStrings(left.source, right.source);
    return sourceOrder !== 0
      ? sourceOrder
      : compareStrings(left.sourceUrl, right.sourceUrl);
  });
  return { schemaVersion: 1, sources };
}

function stableErrorCode(error) {
  const code = isRecord(error) ? error.code : undefined;
  return typeof code === "string" && /^[A-Z][A-Z0-9_]*$/u.test(code)
    ? code
    : "UNKNOWN";
}

export function formatManifestReadError(error) {
  const code = stableErrorCode(error);
  return code === "EACCES" || code === "EPERM"
    ? `manifest inaccessible: ${code}`
    : `manifest read failed: ${code}`;
}

export async function loadManifest(
  manifestPath = DEFAULT_MANIFEST_PATH,
  { readFile = fs.readFile } = {},
) {
  let text;
  try {
    text = await readFile(manifestPath, "utf8");
  } catch (error) {
    fail(formatManifestReadError(error));
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail("manifest parse failed");
  }
  return validateManifest(parsed);
}

export function manifestStats(manifest) {
  const validated = validateManifest(manifest);
  return {
    sources: validated.sources.length,
    skills: validated.sources.reduce((total, source) => total + source.skills.length, 0),
  };
}

function resolvePath(value, label) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    fail(`${label} must be an absolute runtime path`);
  }
  const resolved = path.resolve(value);
  if (resolved !== value) fail(`${label} must be normalized`);
  return resolved;
}

function optionalRuntimePath(environment, key, label) {
  const value = environment[key];
  if (value === undefined || value === "") return undefined;
  return resolvePath(value, label);
}

export function getGlobalLockPath(environment = process.env, home = homedir()) {
  const resolvedHome = resolvePath(home, "home");
  const xdgStateHome = optionalRuntimePath(
    environment,
    "XDG_STATE_HOME",
    "XDG_STATE_HOME",
  );
  if (xdgStateHome) {
    return path.join(xdgStateHome, "skills", LOCK_FILE);
  }
  return path.join(resolvedHome, ".agents", LOCK_FILE);
}

export function getDefaultRoots(environment = process.env, home = homedir()) {
  const resolvedHome = resolvePath(home, "home");
  const xdgConfigHome = optionalRuntimePath(
    environment,
    "XDG_CONFIG_HOME",
    "XDG_CONFIG_HOME",
  );
  const xdgStateHome = optionalRuntimePath(
    environment,
    "XDG_STATE_HOME",
    "XDG_STATE_HOME",
  );
  const roots = {
    home: resolvedHome,
    canonicalRoot: path.join(resolvedHome, ".config", "opencode", "skills"),
    upstreamRoot: path.join(resolvedHome, ".agents", "skills"),
    lockPath: getGlobalLockPath(environment, resolvedHome),
  };
  if (xdgConfigHome) roots.xdgConfigHome = xdgConfigHome;
  if (xdgStateHome) roots.xdgStateHome = xdgStateHome;
  return roots;
}

function isPathWithin(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function pathsOverlap(left, right) {
  return isPathWithin(left, right) || isPathWithin(right, left);
}

async function lstatOptional(targetPath) {
  try {
    return await fs.lstat(targetPath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    fail(`could not inspect a runtime path: ${error.code ?? "filesystem error"}`);
  }
}

async function assertNoSymlinkComponents(targetPath, label) {
  const normalized = resolvePath(targetPath, label);
  const parsed = path.parse(normalized);
  let current = parsed.root;
  const remainder = normalized.slice(parsed.root.length).split(path.sep).filter(Boolean);

  for (const segment of remainder) {
    current = path.join(current, segment);
    const stat = await lstatOptional(current);
    if (!stat) return;
    if (stat.isSymbolicLink()) fail(`${label} contains a symlink component`);
  }
}

function protectedTargetCandidates(roots) {
  if (!isRecord(roots)) fail("runtime roots are required");
  const home = resolvePath(roots.home, "home");
  const candidates = [
    {
      label: "HOME OpenCode skills target",
      path: path.join(home, ".config", OPEN_CODE_SKILLS_SUFFIX),
    },
  ];
  if (roots.xdgConfigHome !== undefined) {
    const xdgConfigHome = resolvePath(roots.xdgConfigHome, "XDG_CONFIG_HOME");
    candidates.push({
      label: "XDG_CONFIG_HOME OpenCode skills target",
      path: path.join(xdgConfigHome, OPEN_CODE_SKILLS_SUFFIX),
    });
  }
  return candidates.map((candidate) => ({
    ...candidate,
    path: resolvePath(candidate.path, candidate.label),
  }));
}

export async function resolveProtectedOpenCodeTargets(roots) {
  const resolved = [];
  const identities = new Set();
  for (const candidate of protectedTargetCandidates(roots)) {
    await assertNoSymlinkComponents(candidate.path, candidate.label);
    const stat = await lstatOptional(candidate.path);
    if (stat && stat.isSymbolicLink()) {
      fail(`${candidate.label} is a symlink`);
    }
    if (stat && !stat.isDirectory()) {
      fail(`${candidate.label} must be a real directory when present`);
    }

    let identity = candidate.path;
    if (stat) {
      try {
        identity = await fs.realpath(candidate.path);
      } catch (error) {
        fail(`could not resolve a protected OpenCode skills target: ${stableErrorCode(error)}`);
      }
    }
    if (identities.has(identity)) continue;
    identities.add(identity);
    resolved.push(candidate.path);
  }
  for (const target of resolved) {
    await assertProtectedNestedSymlinks(target, resolved);
  }
  return resolved;
}

export async function assertSafeRoots(
  roots,
  { cwd = process.cwd(), requireCanonicalCwd = false } = {},
) {
  if (!isRecord(roots)) fail("runtime roots are required");
  const home = resolvePath(roots.home, "home");
  const canonicalRoot = resolvePath(roots.canonicalRoot, "canonical root");
  const upstreamRoot = resolvePath(roots.upstreamRoot, "upstream root");
  const lockPath = resolvePath(roots.lockPath, "global lock path");
  const xdgConfigHome = roots.xdgConfigHome === undefined
    ? undefined
    : resolvePath(roots.xdgConfigHome, "XDG_CONFIG_HOME");
  const xdgStateHome = roots.xdgStateHome === undefined
    ? undefined
    : resolvePath(roots.xdgStateHome, "XDG_STATE_HOME");

  if (pathsOverlap(canonicalRoot, upstreamRoot)) {
    fail("canonical and upstream roots overlap");
  }
  if (pathsOverlap(lockPath, canonicalRoot) || pathsOverlap(lockPath, upstreamRoot)) {
    fail("global lock path overlaps a protected skill root");
  }
  if (requireCanonicalCwd && path.resolve(cwd) !== canonicalRoot) {
    fail("run this script from the canonical repository path");
  }

  if (xdgStateHome) {
    const expectedLockPath = path.join(xdgStateHome, "skills", LOCK_FILE);
    if (lockPath !== expectedLockPath) {
      fail("global lock path must match XDG_STATE_HOME");
    }
  }

  const protectedTargets = await resolveProtectedOpenCodeTargets({
    home,
    xdgConfigHome,
  });
  for (let index = 0; index < protectedTargets.length; index += 1) {
    const target = protectedTargets[index];
    if (pathsOverlap(target, upstreamRoot)) {
      fail("protected OpenCode skills target overlaps the upstream root");
    }
    if (pathsOverlap(target, lockPath)) {
      fail("global lock path overlaps a protected skill root");
    }
    for (const other of protectedTargets.slice(index + 1)) {
      if (pathsOverlap(target, other)) {
        fail("protected OpenCode skills targets overlap");
      }
    }
  }

  await assertNoSymlinkComponents(home, "home");
  await assertNoSymlinkComponents(canonicalRoot, "canonical root");
  await assertNoSymlinkComponents(upstreamRoot, "upstream root");
  await assertNoSymlinkComponents(lockPath, "global lock path");
  if (xdgStateHome) await assertNoSymlinkComponents(xdgStateHome, "XDG_STATE_HOME");

  const expectedCanonicalRoot = path.join(home, ".config", OPEN_CODE_SKILLS_SUFFIX);
  if (canonicalRoot !== expectedCanonicalRoot) {
    fail("canonical root must match the HOME OpenCode skills target");
  }

  const canonicalStat = await lstatOptional(canonicalRoot);
  if (!canonicalStat || canonicalStat.isSymbolicLink() || !canonicalStat.isDirectory()) {
    fail("canonical root must be a real directory");
  }
  const upstreamStat = await lstatOptional(upstreamRoot);
  if (
    upstreamStat &&
    (upstreamStat.isSymbolicLink() || !upstreamStat.isDirectory())
  ) {
    fail("upstream root must be a real directory when present");
  }

  const safeRoots = { home, canonicalRoot, upstreamRoot, lockPath };
  if (xdgConfigHome) safeRoots.xdgConfigHome = xdgConfigHome;
  if (xdgStateHome) safeRoots.xdgStateHome = xdgStateHome;
  return safeRoots;
}

function snapshotType(stat) {
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  if (stat.isSymbolicLink()) return "symlink";
  return "other";
}

async function snapshotEntry(targetPath, relativePath, stat) {
  const type = snapshotType(stat);
  const entry = {
    relativePath,
    type,
    mode: stat.mode & 0o7777,
    size: stat.size,
    mtimeNs: stat.mtimeNs?.toString() ?? String(Math.trunc(stat.mtimeMs * 1e6)),
    uid: stat.uid,
    gid: stat.gid,
  };
  if (type === "file") {
    entry.digest = createHash("sha256")
      .update(await fs.readFile(targetPath))
      .digest("hex");
  } else if (type === "symlink") {
    entry.target = await fs.readlink(targetPath);
  }
  return entry;
}

export async function snapshotTree(rootPath) {
  const root = resolvePath(rootPath, "snapshot root");
  const rootStat = await lstatOptional(root);
  if (!rootStat) return { exists: false, entries: [] };
  if (rootStat.isSymbolicLink()) fail("cannot snapshot a symlink root");
  if (!rootStat.isDirectory()) fail("cannot snapshot a non-directory root");

  const entries = [await snapshotEntry(root, ".", rootStat)];
  async function visit(directory, relativeDirectory) {
    const children = await fs.readdir(directory, { withFileTypes: true });
    children.sort((left, right) => compareStrings(left.name, right.name));
    for (const child of children) {
      const childPath = path.join(directory, child.name);
      const relativePath = relativeDirectory === "."
        ? child.name
        : path.join(relativeDirectory, child.name);
      const stat = await fs.lstat(childPath);
      entries.push(await snapshotEntry(childPath, relativePath, stat));
      if (stat.isDirectory()) await visit(childPath, relativePath);
    }
  }
  await visit(root, ".");
  entries.sort((left, right) => compareStrings(left.relativePath, right.relativePath));
  return { exists: true, entries };
}

async function assertProtectedNestedSymlinks(rootPath, protectedRoots, tree = null) {
  const allowedRoots = [];
  for (const protectedRoot of protectedRoots) {
    const normalizedRoot = resolvePath(protectedRoot, "protected OpenCode skills target");
    const stat = await lstatOptional(normalizedRoot);
    if (!stat) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fail("protected OpenCode skills target must be a real directory when present");
    }
    try {
      allowedRoots.push(await fs.realpath(normalizedRoot));
    } catch (error) {
      fail(`could not resolve a protected OpenCode skills target: ${stableErrorCode(error)}`);
    }
  }

  const snapshot = tree ?? await snapshotTree(rootPath);
  // Traverse with lstat only; resolve each link solely to prove it stays inside a snapshotted root.
  for (const entry of snapshot.entries) {
    if (entry.type !== "symlink") continue;
    const linkPath = path.join(rootPath, entry.relativePath);
    let resolvedTarget;
    try {
      resolvedTarget = await fs.realpath(linkPath);
    } catch {
      fail("protected OpenCode skills target contains a dangling or unsafe nested symlink");
    }
    if (!allowedRoots.some((allowedRoot) => isPathWithin(allowedRoot, resolvedTarget))) {
      fail("protected OpenCode skills target contains a nested symlink outside protected roots");
    }
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareStrings)
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function snapshotsEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function snapshotHasSymlink(snapshot) {
  return snapshot.entries.some((entry) => entry.type === "symlink");
}

async function inspectSkillRoot(upstreamRoot, skillName) {
  const root = path.join(upstreamRoot, skillName);
  const rootStat = await lstatOptional(root);
  if (!rootStat) return { status: "missing", root };
  if (rootStat.isSymbolicLink()) {
    return { status: "invalid", root, reason: "root is a symlink" };
  }
  if (!rootStat.isDirectory()) {
    return { status: "invalid", root, reason: "root is not a directory" };
  }

  let snapshot;
  try {
    snapshot = await snapshotTree(root);
  } catch {
    return { status: "invalid", root, reason: "root could not be inspected safely" };
  }
  if (snapshotHasSymlink(snapshot)) {
    return { status: "invalid", root, reason: "root contains a symlink" };
  }
  const skillFile = path.join(root, "SKILL.md");
  const skillFileStat = await lstatOptional(skillFile);
  if (!skillFileStat || !skillFileStat.isFile() || skillFileStat.isSymbolicLink()) {
    return { status: "invalid", root, reason: "SKILL.md is not a regular file" };
  }
  return { status: "installed", root, snapshot };
}

async function listDirectSkillRoots(upstreamRoot) {
  const rootStat = await lstatOptional(upstreamRoot);
  if (!rootStat) return [];
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    fail("upstream root is not a real directory");
  }
  const children = await fs.readdir(upstreamRoot, { withFileTypes: true });
  const names = [];
  for (const child of children) {
    if (!child.isDirectory()) continue;
    const name = child.name;
    const root = path.join(upstreamRoot, name);
    const rootLstat = await fs.lstat(root);
    if (rootLstat.isSymbolicLink()) continue;
    const skillFile = await lstatOptional(path.join(root, "SKILL.md"));
    if (rootLstat.isDirectory() && skillFile?.isFile() && !skillFile.isSymbolicLink()) {
      names.push(name);
    }
  }
  names.sort(compareStrings);
  return names;
}

async function readGlobalLock(roots) {
  const lockStat = await lstatOptional(roots.lockPath);
  if (!lockStat) return { exists: false, data: null };
  if (lockStat.isSymbolicLink() || !lockStat.isFile()) {
    fail("global lock must be a regular file");
  }

  let data;
  try {
    data = JSON.parse(await fs.readFile(roots.lockPath, "utf8"));
  } catch {
    fail("global lock is not valid JSON");
  }
  if (!isRecord(data) || !Number.isInteger(data.version) || data.version !== LOCK_VERSION) {
    fail(`global lock version must be exactly ${LOCK_VERSION}`);
  }
  if (!isRecord(data.skills)) fail("global lock skills metadata must be an object");
  return { exists: true, data };
}

function lockEntryReason(entry, source, skill) {
  if (!isRecord(entry)) return "missing lock record";
  if (entry.sourceType !== "github") return "lock sourceType is not github";
  if (entry.source !== source.source) return "lock source does not match manifest";
  if (entry.sourceUrl !== source.sourceUrl) return "lock sourceUrl does not match manifest";
  if (entry.skillPath !== skill.skillPath) return "lock skillPath does not match manifest";
  if (typeof entry.skillFolderHash !== "string" || !HASH_PATTERN.test(entry.skillFolderHash)) {
    return "lock lacks the skillFolderHash required by skills update";
  }
  return null;
}

function getLockEntry(lock, name) {
  return lock.data?.skills?.[name] ?? null;
}

async function findCanonicalContamination(canonicalRoot, upstreamRoot, skillNames) {
  const issues = [];
  for (const artifact of ["skills-lock.json", LOCK_FILE]) {
    if (await lstatOptional(path.join(canonicalRoot, artifact))) {
      issues.push(`unexpected ${artifact} in canonical root`);
    }
  }
  const canonicalAgents = path.join(canonicalRoot, ".agents", "skills");
  if (await lstatOptional(canonicalAgents)) {
    issues.push("unexpected canonical .agents/skills install target");
  }

  for (const skillName of skillNames) {
    const root = path.join(canonicalRoot, skillName);
    const rootStat = await lstatOptional(root);
    if (!rootStat || rootStat.isSymbolicLink() || !rootStat.isDirectory()) continue;
    const snapshot = await snapshotTree(root);
    for (const entry of snapshot.entries) {
      if (entry.type !== "symlink") continue;
      const linkPath = path.join(root, entry.relativePath);
      let target;
      try {
        target = await fs.realpath(linkPath);
      } catch {
        continue;
      }
      if (isPathWithin(upstreamRoot, target)) {
        issues.push(`canonical symlink overlaps upstream for ${skillName}`);
      }
    }
  }
  return issues;
}

export async function verifyState(manifest, roots, options = {}) {
  const validatedManifest = validateManifest(manifest);
  const safeRoots = await assertSafeRoots(roots, options);
  const lock = await readGlobalLock(safeRoots);
  const declaredNames = new Set();
  const rootStates = new Map();
  const installed = [];
  const missing = [];
  const invalid = [];
  const unresolved = [];
  const lockMismatch = [];

  for (const source of validatedManifest.sources) {
    for (const skill of source.skills) {
      declaredNames.add(skill.name);
      const rootState = await inspectSkillRoot(safeRoots.upstreamRoot, skill.name);
      rootStates.set(skill.name, rootState);
      const reason = lockEntryReason(getLockEntry(lock, skill.name), source, skill);
      if (rootState.status === "installed") installed.push(skill.name);
      else if (rootState.status === "missing") missing.push(skill.name);
      else invalid.push({ name: skill.name, reason: rootState.reason });
      if (reason) {
        unresolved.push(skill.name);
        if (rootState.status === "installed") lockMismatch.push({ name: skill.name, reason });
      }
    }
  }

  const directRoots = await listDirectSkillRoots(safeRoots.upstreamRoot);
  const extra = directRoots.filter((name) => !declaredNames.has(name));
  const lockNames = Object.keys(lock.data?.skills ?? {}).sort(compareStrings);
  const lockExtras = lockNames.filter((name) => !declaredNames.has(name));
  const contamination = await findCanonicalContamination(
    safeRoots.canonicalRoot,
    safeRoots.upstreamRoot,
    [...declaredNames].sort(compareStrings),
  );

  if (options.expectedCanonicalSnapshot) {
    const currentCanonicalSnapshot = await snapshotTree(safeRoots.canonicalRoot);
    if (!snapshotsEqual(options.expectedCanonicalSnapshot, currentCanonicalSnapshot)) {
      contamination.push("canonical snapshot changed unexpectedly");
    }
  }

  installed.sort(compareStrings);
  missing.sort(compareStrings);
  invalid.sort((left, right) => compareStrings(left.name, right.name));
  unresolved.sort(compareStrings);
  lockMismatch.sort((left, right) => compareStrings(left.name, right.name));

  return {
    ok: missing.length === 0 && invalid.length === 0 && unresolved.length === 0 && contamination.length === 0,
    sources: validatedManifest.sources.length,
    declared: declaredNames.size,
    installed: installed.length,
    missing: missing.length,
    extra: extra.length,
    unresolved: unresolved.length,
    lockExtras: lockExtras.length,
    installedNames: installed,
    missingNames: missing,
    extraNames: extra,
    lockExtraNames: lockExtras,
    invalid,
    lockMismatch,
    contamination,
    lockPath: safeRoots.lockPath,
    rootStates,
  };
}

function buildCliAddCommand(sourceUrl, skillNames, version, { allowLocalSource = false } = {}) {
  if (allowLocalSource) {
    resolvePath(sourceUrl, "local probe source");
  } else {
    validateSourceUrl(
      sourceUrl,
      sourceUrl.slice("https://github.com/".length, -4),
      "sourceUrl",
    );
  }
  if (typeof version !== "string" || (!SEMVER_PATTERN.test(version) && version !== "<resolved>")) {
    fail("CLI version is not valid semver");
  }
  if (!Array.isArray(skillNames) || skillNames.length === 0) {
    fail("an add command requires at least one skill");
  }
  const names = [...new Set(skillNames)].sort(compareStrings);
  if (names.length !== skillNames.length) fail("install command contains duplicate skills");
  names.forEach((name) => validateSkillName(name, "install skill"));
  return {
    command: "npm",
    args: [
      "exec",
      "--yes",
      `--package=skills@${version}`,
      "--",
      "skills",
      "add",
      sourceUrl,
      "--skill",
      ...names,
      "--global",
      "--agent",
      CLI_AGENT,
      "--yes",
      "--copy",
    ],
  };
}

export function buildAddCommand(sourceUrl, skillNames, version) {
  return buildCliAddCommand(sourceUrl, skillNames, version);
}

function displayCommand(invocation) {
  return [invocation.command, ...invocation.args].join(" ");
}

function planSummary(plan) {
  return {
    sources: plan.sources.length,
    declared: plan.sources.reduce((total, source) => total + source.skills.length, 0),
    installed: plan.installed,
    missing: plan.missing,
    operations: plan.operations,
    operationSkills: plan.operationSkills,
    extra: plan.extra,
    unresolved: 0,
    lockExtras: plan.lockExtras,
  };
}

export async function buildPlan(manifest, roots, options = {}) {
  const validatedManifest = validateManifest(manifest);
  const safeRoots = await assertSafeRoots(roots, options);
  const lock = await readGlobalLock(safeRoots);
  const update = options.update === true;
  const declaredNames = new Set();
  const sourcePlans = [];

  for (const source of validatedManifest.sources) {
    const installNames = [];
    const updateNames = [];
    const skipNames = [];
    for (const skill of source.skills) {
      declaredNames.add(skill.name);
      const rootState = await inspectSkillRoot(safeRoots.upstreamRoot, skill.name);
      const reason = lockEntryReason(getLockEntry(lock, skill.name), source, skill);
      if (update) {
        if (rootState.status !== "installed") {
          const detail = rootState.status === "invalid"
            ? `: ${rootState.reason}`
            : ": root is missing";
          fail(`declared skill ${skill.name} cannot be updated${detail}`);
        }
        if (reason) {
          fail(`declared skill ${skill.name} has inconsistent lock metadata: ${reason}`);
        }
        updateNames.push(skill.name);
      } else if (rootState.status === "installed") {
        if (reason) {
          fail(`existing declared skill ${skill.name} has inconsistent lock metadata`);
        }
        skipNames.push(skill.name);
      } else if (rootState.status === "missing") {
        installNames.push(skill.name);
      } else {
        fail(`existing declared skill ${skill.name} is unsafe: ${rootState.reason}`);
      }
    }
    installNames.sort(compareStrings);
    updateNames.sort(compareStrings);
    skipNames.sort(compareStrings);
    const operationNames = update ? updateNames : installNames;
    sourcePlans.push({
      mode: update ? "update" : "install",
      source: source.source,
      sourceUrl: source.sourceUrl,
      skills: source.skills.map((skill) => skill.name),
      installNames,
      updateNames,
      skipNames,
      operationNames,
      action: update
        ? `update: ${updateNames.length} declared skill${updateNames.length === 1 ? "" : "s"}`
        : installNames.length === 0
          ? `skip: ${skipNames.length} valid skill${skipNames.length === 1 ? "" : "s"}`
          : `install: ${installNames.length} missing skill${installNames.length === 1 ? "" : "s"}`,
      command: operationNames.length > 0
        ? buildAddCommand(source.sourceUrl, operationNames, "<resolved>")
        : null,
    });
  }

  const directRoots = await listDirectSkillRoots(safeRoots.upstreamRoot);
  const lockNames = Object.keys(lock.data?.skills ?? {}).sort(compareStrings);
  const plan = {
    mode: update ? "update" : "install",
    manifest: validatedManifest,
    roots: safeRoots,
    sources: sourcePlans,
    installed: sourcePlans.reduce(
      (total, source) => total + (update ? source.updateNames.length : source.skipNames.length),
      0,
    ),
    missing: update
      ? 0
      : sourcePlans.reduce((total, source) => total + source.installNames.length, 0),
    operations: sourcePlans.filter((source) => source.command !== null).length,
    operationSkills: sourcePlans.reduce((total, source) => total + source.operationNames.length, 0),
    extra: directRoots.filter((name) => !declaredNames.has(name)).length,
    extraNames: directRoots.filter((name) => !declaredNames.has(name)),
    lockExtras: lockNames.filter((name) => !declaredNames.has(name)).length,
    lockExtraNames: lockNames.filter((name) => !declaredNames.has(name)),
  };
  plan.extraNames.sort(compareStrings);
  return plan;
}

export function buildChildEnvironment(
  roots,
  overrides = {},
  sourceEnvironment = process.env,
) {
  const controlled = {
    HOME: roots.home,
  };
  if (process.platform === "win32") {
    // Node and npm resolve the Windows user directory through USERPROFILE.
    controlled.USERPROFILE = roots.home;
  }
  if (roots.xdgConfigHome !== undefined) {
    controlled.XDG_CONFIG_HOME = roots.xdgConfigHome;
  }
  if (roots.xdgStateHome !== undefined) {
    controlled.XDG_STATE_HOME = roots.xdgStateHome;
  }

  if (!isRecord(overrides)) fail("child environment overrides must be an object");
  for (const key of Object.keys(overrides)) {
    if (Object.hasOwn(controlled, key)) {
      if (overrides[key] !== controlled[key]) {
        fail("child environment override cannot replace a controlled root");
      }
      continue;
    }
    if (!CHILD_PROBE_OVERRIDE_KEYS.has(key)) {
      fail("child environment override key is not permitted");
    }
    if (typeof overrides[key] !== "string") {
      fail("child environment override values must be strings");
    }
    assertSafeText(overrides[key], "child environment override");
  }

  const environment = {};
  for (const key of CHILD_HOST_ENVIRONMENT_KEYS) {
    const value = sourceEnvironment[key];
    if (typeof value === "string") environment[key] = value;
  }

  return {
    ...environment,
    ...controlled,
    ...overrides,
    DISABLE_TELEMETRY: "1",
    DO_NOT_TRACK: "1",
  };
}

function environmentForRoots(roots, overrides = {}) {
  return buildChildEnvironment(roots, overrides);
}

export function spawnCommand(command, args, options = {}) {
  const { meta: _meta, ...spawnOptions } = options;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...spawnOptions,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

async function runNpmCommand(runChild, args, roots, meta) {
  const result = await runProtectedChild(runChild, "npm", args, roots, meta);
  if (result.status !== 0) {
    fail(`npm command failed during ${meta ?? "bootstrap"}`);
  }
  return result;
}

function parseSemverOutput(output, label) {
  const text = output.trim();
  let value = text;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") value = parsed;
  } catch {
    // npm view may return an unquoted value in some npm versions.
  }
  if (!SEMVER_PATTERN.test(value)) fail(`${label} did not return a valid semver`);
  return value;
}

export async function resolveCliVersion(runChild, roots) {
  const resolvedResult = await runNpmCommand(
    runChild,
    ["view", "skills", "version", "--json"],
    roots,
    "CLI version resolution",
  );
  const resolved = parseSemverOutput(resolvedResult.stdout, "CLI version resolution");
  const confirmedResult = await runNpmCommand(
    runChild,
    [
      "exec",
      "--yes",
      `--package=skills@${resolved}`,
      "--",
      "skills",
      "--version",
    ],
    roots,
    "CLI version confirmation",
  );
  const confirmed = confirmedResult.stdout.trim();
  if (confirmed !== resolved) fail("exact skills package version confirmation failed");
  return resolved;
}

async function assertProbeTree(root, expectedName) {
  const snapshot = await snapshotTree(root);
  if (snapshotHasSymlink(snapshot)) fail("CLI probe created an unexpected symlink");
  const directNames = snapshot.entries
    .filter((entry) => entry.relativePath !== "." && !entry.relativePath.includes(path.sep))
    .map((entry) => entry.relativePath)
    .sort(compareStrings);
  if (directNames.length !== 1 || directNames[0] !== expectedName) {
    fail("CLI probe created an unexpected upstream target");
  }
  const skillFile = path.join(root, expectedName, "SKILL.md");
  const skillStat = await lstatOptional(skillFile);
  if (!skillStat?.isFile() || skillStat.isSymbolicLink()) {
    fail("CLI probe did not create a regular SKILL.md");
  }
}

async function assertMissing(targetPath) {
  if (await lstatOptional(targetPath)) fail("CLI probe created an unexpected target");
}

async function snapshotProtectedTarget(targetPath, protectedRoots = [targetPath]) {
  const stat = await lstatOptional(targetPath);
  if (!stat) return { exists: false };
  if (stat.isDirectory()) {
    const tree = await snapshotTree(targetPath);
    await assertProtectedNestedSymlinks(targetPath, protectedRoots, tree);
    return { exists: true, tree };
  }
  return { exists: true, entry: await snapshotEntry(targetPath, ".", stat) };
}

async function snapshotProtectedTargets(targets) {
  const snapshots = new Map();
  for (const target of targets) {
    snapshots.set(target, await snapshotProtectedTarget(target, targets));
  }
  return snapshots;
}

async function assertProtectedTargetsUnchanged(
  before,
  targets,
  { canonicalFailureMessage = null } = {},
) {
  for (const [index, target] of targets.entries()) {
    await assertNoSymlinkComponents(target, "protected OpenCode skills target");
    let after;
    try {
      after = await snapshotProtectedTarget(target, targets);
    } catch (error) {
      if (index === 0 && canonicalFailureMessage && error instanceof BootstrapError) {
        fail(canonicalFailureMessage);
      }
      throw error;
    }
    if (!snapshotsEqual(before.get(target), after)) {
      fail(index === 0 && canonicalFailureMessage
        ? canonicalFailureMessage
        : "a protected OpenCode skills target changed unexpectedly");
    }
  }
}

async function runProtectedChild(
  runChild,
  command,
  args,
  roots,
  meta,
  {
    protectedTargets = null,
    beforeProtectedTargets = null,
    canonicalFailureMessage = null,
    cwd = roots.canonicalRoot,
    env = environmentForRoots(roots),
  } = {},
) {
  const targets = protectedTargets ?? await resolveProtectedOpenCodeTargets(roots);
  const before = beforeProtectedTargets ?? await snapshotProtectedTargets(targets);
  let result;
  try {
    result = await runChild(command, args, {
      cwd,
      env,
      meta,
    });
  } finally {
    await assertProtectedTargetsUnchanged(before, targets, { canonicalFailureMessage });
  }
  return result;
}

function assertProbeSucceeded(result, label) {
  if (result.status !== 0) fail(`${label} failed`);
  return result;
}

async function runRemoteProbeAdd(command, runChild, context, label) {
  const beforeOpenCodeTargets = await snapshotProtectedTargets(context.protectedTargets);
  const beforeUpstream = await snapshotTree(context.roots.upstreamRoot);
  const beforeLock = await readLockSnapshot(context.roots);
  const result = await runProtectedChild(
    runChild,
    command.command,
    command.args,
    context.roots,
    "remote CLI capability probe",
    {
      protectedTargets: context.protectedTargets,
      beforeProtectedTargets: beforeOpenCodeTargets,
      cwd: context.probeRoot,
      env: context.environment,
    },
  );
  assertProbeSucceeded(result, label);
  await assertAllowedUpstreamChanges(
    beforeUpstream,
    await snapshotTree(context.roots.upstreamRoot),
    [context.skill.name],
  );
  const afterLock = await readLockSnapshot(context.roots);
  assertAllowedLockChanges(beforeLock, afterLock, [context.skill.name]);
  return afterLock;
}

async function removeProbeDirectory(directory) {
  const normalized = path.resolve(directory);
  const tempRoot = path.resolve(tmpdir());
  if (!isPathWithin(tempRoot, normalized) || normalized === tempRoot) {
    fail("refusing to remove a probe directory outside the temporary directory");
  }
  await fs.rm(normalized, { recursive: true, force: true });
}

function probeRoots(probeHome, probeRoot, configHome, stateHome) {
  return {
    home: probeHome,
    canonicalRoot: path.join(probeHome, ".config", "opencode", "skills"),
    upstreamRoot: path.join(probeHome, ".agents", "skills"),
    xdgConfigHome: configHome,
    xdgStateHome: stateHome,
    lockPath: path.join(stateHome, "skills", LOCK_FILE),
    probeRoot,
  };
}

function probeEnvironment(roots, cacheHome, tempHome) {
  return environmentForRoots(roots, {
    XDG_CACHE_HOME: cacheHome,
    TMPDIR: tempHome,
    TEMP: tempHome,
    TMP: tempHome,
    // npm_config_cache is adapter-owned probe state, not inherited user config.
    npm_config_cache: cacheHome,
  });
}

async function runLocalFixtureProbe(version, runChild) {
  const probeRoot = await fs.mkdtemp(path.join(tmpdir(), "skills-bootstrap-local-"));
  try {
    const probeHome = path.join(probeRoot, "home");
    const configHome = path.join(probeRoot, "config");
    const stateHome = path.join(probeRoot, "state");
    const cacheHome = path.join(probeRoot, "cache");
    const tempHome = path.join(probeRoot, "tmp");
    const sourceRoot = path.join(probeRoot, "source", "bootstrap-probe");
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.mkdir(probeHome, { recursive: true });
    await fs.mkdir(configHome, { recursive: true });
    await fs.mkdir(stateHome, { recursive: true });
    await fs.mkdir(cacheHome, { recursive: true });
    await fs.mkdir(tempHome, { recursive: true });
    await fs.writeFile(
      path.join(sourceRoot, "SKILL.md"),
      "---\nname: bootstrap-probe\ndescription: Temporary bootstrap probe\n---\n# Probe\n",
      "utf8",
    );

    const roots = probeRoots(probeHome, probeRoot, configHome, stateHome);
    const environment = probeEnvironment(roots, cacheHome, tempHome);
    const protectedTargets = await resolveProtectedOpenCodeTargets(roots);
    const command = buildCliAddCommand(
      path.join(probeRoot, "source"),
      ["bootstrap-probe"],
      version,
      { allowLocalSource: true },
    );
    const beforeOpenCodeTargets = await snapshotProtectedTargets(protectedTargets);
    const result = await runProtectedChild(
      runChild,
      command.command,
      command.args,
      roots,
      "local CLI capability probe",
      {
        protectedTargets,
        beforeProtectedTargets: beforeOpenCodeTargets,
        cwd: probeRoot,
        env: environment,
      },
    );
    assertProbeSucceeded(result, "local CLI capability probe");
    await assertProbeTree(roots.upstreamRoot, "bootstrap-probe");
    await assertMissing(path.join(probeHome, ".config", "opencode", "skills"));
    await assertMissing(path.join(probeHome, ".agents", LOCK_FILE));
    await assertMissing(roots.lockPath);
  } finally {
    await removeProbeDirectory(probeRoot);
  }
}

async function runRemoteFixtureProbe(version, manifest, runChild) {
  const probeRoot = await fs.mkdtemp(path.join(tmpdir(), "skills-bootstrap-remote-"));
  try {
    const probeHome = path.join(probeRoot, "home");
    const configHome = path.join(probeRoot, "config");
    const stateHome = path.join(probeRoot, "state");
    const cacheHome = path.join(probeRoot, "cache");
    const tempHome = path.join(probeRoot, "tmp");
    await fs.mkdir(probeHome, { recursive: true });
    await fs.mkdir(configHome, { recursive: true });
    await fs.mkdir(stateHome, { recursive: true });
    await fs.mkdir(cacheHome, { recursive: true });
    await fs.mkdir(tempHome, { recursive: true });

    const source = manifest.sources[0];
    const skill = source.skills[0];
    const roots = probeRoots(probeHome, probeRoot, configHome, stateHome);
    const environment = probeEnvironment(roots, cacheHome, tempHome);
    const protectedTargets = await resolveProtectedOpenCodeTargets(roots);
    const command = buildAddCommand(source.sourceUrl, [skill.name], version);
    const probeContext = {
      environment,
      protectedTargets,
      probeRoot,
      roots,
      skill,
    };
    const afterLock = await runRemoteProbeAdd(
      command,
      runChild,
      probeContext,
      "remote CLI capability probe",
    );
    await assertProbeTree(roots.upstreamRoot, skill.name);
    await assertMissing(path.join(probeHome, ".config", "opencode", "skills"));

    const reason = lockEntryReason(getLockEntry(afterLock, skill.name), source, skill);
    if (reason) fail(`remote CLI capability probe lock verification failed: ${reason}`);
    await assertMissing(path.join(probeHome, ".agents", LOCK_FILE));

    const afterReaddLock = await runRemoteProbeAdd(
      command,
      runChild,
      probeContext,
      "remote CLI capability re-add probe",
    );
    await assertProbeTree(roots.upstreamRoot, skill.name);
    const readdReason = lockEntryReason(
      getLockEntry(afterReaddLock, skill.name),
      source,
      skill,
    );
    if (readdReason) fail(`remote CLI capability re-add probe lock verification failed: ${readdReason}`);
    await assertMissing(path.join(probeHome, ".config", "opencode", "skills"));
    await assertMissing(path.join(probeHome, ".agents", LOCK_FILE));
  } finally {
    await removeProbeDirectory(probeRoot);
  }
}

export async function runSafetyProbes(version, manifest, runChild) {
  if (!SEMVER_PATTERN.test(version)) fail("CLI probe version is not valid semver");
  await runLocalFixtureProbe(version, runChild);
  await runRemoteFixtureProbe(version, manifest, runChild);
}

function mapByName(manifest) {
  const result = new Map();
  for (const source of manifest.sources) {
    for (const skill of source.skills) result.set(skill.name, { source, skill });
  }
  return result;
}

function snapshotMap(snapshot) {
  return new Map(snapshot.entries.map((entry) => [entry.relativePath, entry]));
}

function topLevel(relativePath) {
  return relativePath.split(path.sep)[0];
}

function compareEntryMaps(before, after, allowedTopLevels, allowRootMetadataChange) {
  const beforeMap = snapshotMap(before);
  const afterMap = snapshotMap(after);
  const allPaths = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  for (const relativePath of allPaths) {
    if (relativePath === ".") {
      if (allowRootMetadataChange) continue;
    } else if (allowedTopLevels.has(topLevel(relativePath))) {
      continue;
    }
    if (!snapshotsEqual(beforeMap.get(relativePath) ?? null, afterMap.get(relativePath) ?? null)) {
      fail("CLI invocation changed an unexpected upstream path");
    }
  }
}

async function assertAllowedUpstreamChanges(before, after, allowedNames) {
  if (!before.exists && !after.exists) fail("CLI invocation did not create the upstream store");
  if (before.exists && !after.exists) fail("CLI invocation removed the upstream store");
  const beforeMap = snapshotMap(before);
  const allowedTopLevels = new Set(allowedNames);
  const allowedRootWasAdded = allowedNames.some((name) => !beforeMap.has(name));
  compareEntryMaps(before, after, allowedTopLevels, allowedRootWasAdded);
}

async function readLockSnapshot(roots) {
  return readGlobalLock(roots);
}

function withoutSkills(data) {
  if (!data) return null;
  const copy = { ...data };
  delete copy.skills;
  return copy;
}

function assertAllowedLockChanges(before, after, allowedNames) {
  if (!after.exists || !after.data) fail("CLI invocation did not create global lock metadata");
  const beforeData = before.data ?? { version: LOCK_VERSION, skills: {} };
  if (before.exists && !snapshotsEqual(withoutSkills(beforeData), withoutSkills(after.data))) {
    fail("CLI invocation changed unexpected global lock metadata");
  }
  const beforeSkills = beforeData.skills ?? {};
  const afterSkills = after.data.skills ?? {};
  const allowed = new Set(allowedNames);
  for (const name of new Set([...Object.keys(beforeSkills), ...Object.keys(afterSkills)])) {
    if (allowed.has(name)) continue;
    if (!snapshotsEqual(beforeSkills[name] ?? null, afterSkills[name] ?? null)) {
      fail("CLI invocation changed an unexpected global lock entry");
    }
  }
}

async function revalidateSourcePlan(plan, context) {
  const { manifest, roots, mode: contextMode = "install" } = context;
  const source = manifest.sources.find((item) => item.source === plan.source);
  if (!source) fail(`install plan references an unknown source group: ${plan.source}`);
  if (plan.sourceUrl !== source.sourceUrl) {
    fail(`install plan source URL is stale for ${plan.source}`);
  }

  const installNames = new Set(plan.installNames);
  const updateNames = new Set(plan.updateNames ?? []);
  const skipNames = new Set(plan.skipNames);
  if (
    installNames.size !== plan.installNames.length ||
    updateNames.size !== (plan.updateNames?.length ?? 0) ||
    skipNames.size !== plan.skipNames.length ||
    [...installNames].some((name) => skipNames.has(name)) ||
    [...updateNames].some((name) => skipNames.has(name))
  ) {
    fail(`install plan action inputs are invalid for ${plan.source}`);
  }

  const mode = plan.mode ?? contextMode;
  const operationNames = mode === "update" ? updateNames : installNames;
  if (mode === "update") {
    if (
      operationNames.size !== source.skills.length ||
      source.skills.some((skill) => !operationNames.has(skill.name)) ||
      skipNames.size !== 0 ||
      installNames.size !== 0
    ) {
      fail(`update plan action inputs are stale for ${plan.source}`);
    }
  } else {
    const plannedNames = new Set([...installNames, ...skipNames]);
    if (
      plannedNames.size !== source.skills.length ||
      source.skills.some((skill) => !plannedNames.has(skill.name))
    ) {
      fail(`install plan action inputs are stale for ${plan.source}`);
    }
  }

  const lock = await readLockSnapshot(roots);
  for (const skill of source.skills) {
    const rootState = await inspectSkillRoot(roots.upstreamRoot, skill.name);
    const reason = lockEntryReason(getLockEntry(lock, skill.name), source, skill);
    if (mode === "update") {
      if (rootState.status !== "installed") {
        const detail = rootState.status === "invalid" ? `: ${rootState.reason}` : ": root is missing";
        fail(`planned existing skill ${skill.name} changed before update${detail}`);
      }
      if (reason) {
        fail(`planned existing skill ${skill.name} has changed lock metadata: ${reason}`);
      }
    } else if (installNames.has(skill.name)) {
      if (rootState.status !== "missing") {
        const detail = rootState.status === "invalid" ? `: ${rootState.reason}` : ": root now exists";
        fail(`planned missing skill ${skill.name} is no longer missing${detail}`);
      }
      continue;
    }

    if (rootState.status !== "installed") {
      const detail = rootState.status === "invalid" ? `: ${rootState.reason}` : ": root is missing";
      fail(`planned existing skill ${skill.name} changed before install${detail}`);
    }
    if (reason) {
      fail(`planned existing skill ${skill.name} has changed lock metadata: ${reason}`);
    }
  }
}

async function installSourcePlan(plan, context) {
  const { roots, version, runChild, mode = "install" } = context;
  const operationNames = mode === "update" ? plan.updateNames : plan.installNames;
  await revalidateSourcePlan(plan, { ...context, mode });
  const command = buildAddCommand(plan.sourceUrl, operationNames, version);
  const protectedTargets = await resolveProtectedOpenCodeTargets(roots);
  const beforeProtectedTargets = await snapshotProtectedTargets(protectedTargets);
  const beforeUpstream = await snapshotTree(roots.upstreamRoot);
  const beforeLock = await readLockSnapshot(roots);
  const result = await runProtectedChild(
    runChild,
    command.command,
    command.args,
    roots,
    `${mode} ${plan.source}`,
    {
      protectedTargets,
      beforeProtectedTargets,
      canonicalFailureMessage: "CLI invocation mutated the canonical repository",
    },
  );
  if (result.status !== 0) fail(`skills CLI failed for ${plan.source}`);

  const afterUpstream = await snapshotTree(roots.upstreamRoot);
  await assertAllowedUpstreamChanges(beforeUpstream, afterUpstream, operationNames);
  const afterLock = await readLockSnapshot(roots);
  assertAllowedLockChanges(beforeLock, afterLock, operationNames);

  const source = context.manifest.sources.find((item) => item.source === plan.source);
  for (const skill of source.skills) {
    if (!operationNames.includes(skill.name)) continue;
    const rootState = await inspectSkillRoot(roots.upstreamRoot, skill.name);
    if (rootState.status !== "installed") {
      fail(`skills CLI did not create a safe upstream root for ${skill.name}`);
    }
    const reason = lockEntryReason(getLockEntry(afterLock, skill.name), source, skill);
    if (reason) fail(`skills CLI did not create matching lock metadata for ${skill.name}`);
  }
}

function formatSummary(summary) {
  return [
    `Manifest: ${summary.sources} sources, ${summary.declared} skills`,
    `Summary: declared=${summary.declared} installed=${summary.installed} missing=${summary.missing} extra=${summary.extra} unresolved=${summary.unresolved} lock-extra=${summary.lockExtras}`,
  ];
}

function printVerification(state, log) {
  for (const line of formatSummary(state)) log(line);
  if (state.missingNames.length > 0) log(`Missing: ${state.missingNames.join(", ")}`);
  if (state.extraNames.length > 0) log(`Extra upstream roots: ${state.extraNames.join(", ")}`);
  if (state.lockExtraNames.length > 0) log(`Extra lock records: ${state.lockExtraNames.join(", ")}`);
  if (state.invalid.length > 0) {
    log(`Invalid upstream roots: ${state.invalid.map((item) => `${item.name} (${item.reason})`).join(", ")}`);
  }
  if (state.lockMismatch.length > 0) {
    log(`Lock mismatches: ${state.lockMismatch.map((item) => `${item.name} (${item.reason})`).join(", ")}`);
  }
  if (state.contamination.length > 0) log(`Canonical contamination: ${state.contamination.join(", ")}`);
}

function printDryRun(plan, log) {
  log(`Mode: ${plan.mode === "update" ? "update dry-run" : "dry-run"} (no child process, no mutation)`);
  log("Expected upstream store: ~/.agents/skills");
  log("Protected canonical repository: ~/.config/opencode/skills");
  if (plan.mode === "update") {
    log(`Plan: ${plan.operations} deterministic grouped add operations covering ${plan.operationSkills} declared skills`);
  }
  for (const source of plan.sources) {
    log(`\nSource: ${source.source}`);
    log(`Source URL: ${source.sourceUrl}`);
    log(`Skills: ${source.skills.join(", ")}`);
    log(`Action: ${source.action}`);
    log(`Command: ${source.command ? displayCommand(source.command) : "not run (valid matching lock metadata)"}`);
  }
  for (const line of formatSummary(planSummary(plan))) log(line);
  if (plan.extraNames.length > 0) log(`Extra upstream roots: ${plan.extraNames.join(", ")}`);
  if (plan.lockExtraNames.length > 0) log(`Extra lock records: ${plan.lockExtraNames.join(", ")}`);
}

export function parseArguments(argumentsList) {
  let mode = null;
  let update = false;
  let dryRun = false;
  for (const argument of argumentsList) {
    if (argument === "--help" || argument === "-h") {
      if (mode !== null || update || dryRun) fail("--help cannot be combined with another mode");
      mode = "help";
    } else if (argument === "--dry-run") {
      if (mode !== null || dryRun) fail("choose only one bootstrap mode");
      dryRun = true;
    } else if (argument === "--update") {
      if (mode !== null || update) fail("choose only one bootstrap mode");
      update = true;
    } else if (argument === "--verify") {
      if (mode !== null || update || dryRun) fail("choose only one bootstrap mode");
      mode = "verify";
    } else {
      fail(`unknown option: ${argument}`);
    }
  }
  if (mode !== null) return mode;
  if (update) return dryRun ? "update-dry-run" : "update";
  return dryRun ? "dry-run" : "install";
}

export function helpText() {
  return `Usage: node scripts/bootstrap-upstream-skills.mjs [--update] [--dry-run] | [--verify] | [--help]

Default mode reconstructs missing manifest-declared upstream skills through the exact
skills CLI package resolved for this run. It never writes the canonical repository.

  --dry-run  Validate roots and lock state, print deterministic per-source commands,
             and execute no child process or mutation.
  --update   Re-add every installed manifest-declared skill through deterministic grouped
             skills add commands; never call skills update -g.
  --update --dry-run
             Preview the complete update plan without a child process or mutation.
  --verify   Read-only verification of declared upstream roots, lock metadata,
             extras, symlink separation, and canonical contamination.
  --help     Show this help.

The script must run from ~/.config/opencode/skills. The installer is always:
npm exec --yes --package=skills@<resolved> -- skills add <source-url> --skill <names...> --global --agent opencode --yes --copy
`;
}

export async function executeBootstrap({
  mode = "install",
  manifest = null,
  manifestPath = DEFAULT_MANIFEST_PATH,
  roots = getDefaultRoots(),
  cwd = process.cwd(),
  requireCanonicalCwd = true,
  runChild = spawnCommand,
  resolveVersion = resolveCliVersion,
  runProbes = runSafetyProbes,
  log = console.log,
} = {}) {
  if (mode === "help") {
    log(helpText());
    return { ok: true, mode };
  }
  const loadedManifest = manifest ? validateManifest(manifest) : await loadManifest(manifestPath);
  const safeRoots = await assertSafeRoots(roots, {
    cwd,
    requireCanonicalCwd,
  });

  if (mode === "verify") {
    const state = await verifyState(loadedManifest, safeRoots, { cwd, requireCanonicalCwd: false });
    printVerification(state, log);
    return { ...state, mode };
  }

  if (mode === "dry-run") {
    const plan = await buildPlan(loadedManifest, safeRoots, {
      requireCanonicalCwd: false,
      update: false,
    });
    printDryRun(plan, log);
    return { ...planSummary(plan), plan, ok: true, mode };
  }

  const updateMode = mode === "update" || mode === "update-dry-run";
  if (mode === "update-dry-run") {
    const plan = await buildPlan(loadedManifest, safeRoots, {
      requireCanonicalCwd: false,
      update: true,
    });
    printDryRun(plan, log);
    return { ...planSummary(plan), plan, ok: true, mode };
  }

  if (mode !== "install" && mode !== "update") fail(`unsupported bootstrap mode: ${mode}`);
  const plan = await buildPlan(loadedManifest, safeRoots, {
    requireCanonicalCwd: false,
    update: updateMode,
  });
  if (!updateMode && plan.missing === 0) {
    const state = await verifyState(loadedManifest, safeRoots, { requireCanonicalCwd: false });
    printVerification(state, log);
    return { ...state, mode };
  }

  const version = await resolveVersion(runChild, safeRoots);
  if (!SEMVER_PATTERN.test(version)) fail("resolved skills CLI version is not valid semver");
  await runProbes(version, loadedManifest, runChild);
  for (const sourcePlan of plan.sources) {
    if (sourcePlan.operationNames.length === 0) continue;
    await installSourcePlan(sourcePlan, {
      roots: safeRoots,
      version,
      runChild,
      mode: updateMode ? "update" : "install",
      manifest: loadedManifest,
    });
  }
  const state = await verifyState(loadedManifest, safeRoots, { requireCanonicalCwd: false });
  printVerification(state, log);
  if (!state.ok) fail(`post-${updateMode ? "update" : "install"} verification failed`);
  return { ...state, mode, version, operations: plan.operations };
}

async function main() {
  const mode = parseArguments(process.argv.slice(2));
  if (mode === "help") {
    await executeBootstrap({ mode });
    return;
  }
  const roots = getDefaultRoots();
  const result = await executeBootstrap({
    mode,
    roots,
    cwd: process.cwd(),
    requireCanonicalCwd: true,
  });
  if (result.ok === false) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`bootstrap-upstream-skills: ${message}\n`);
    process.exitCode = 1;
  });
}
