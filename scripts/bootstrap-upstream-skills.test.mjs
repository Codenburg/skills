import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertSafeRoots,
  buildChildEnvironment,
  buildAddCommand,
  buildPlan,
  executeBootstrap,
  getDefaultRoots,
  getGlobalLockPath,
  loadManifest,
  manifestStats,
  parseArguments,
  resolveCliVersion,
  resolveProtectedOpenCodeTargets,
  runSafetyProbes,
  spawnCommand,
  snapshotTree,
  validateManifest,
  verifyState,
} from "./bootstrap-upstream-skills.mjs";

const silent = () => {};

function fixtureManifest(names = ["fixture-skill"]) {
  return validateManifest({
    schemaVersion: 1,
    sources: [
      {
        source: "fixture-owner/fixture-repo",
        sourceUrl: "https://github.com/fixture-owner/fixture-repo.git",
        skills: names.map((name) => ({
          name,
          skillPath: `skills/${name}/SKILL.md`,
        })),
      },
    ],
  });
}

function multiSourceManifest() {
  return validateManifest({
    schemaVersion: 1,
    sources: [
      {
        source: "z-owner/z-repo",
        sourceUrl: "https://github.com/z-owner/z-repo.git",
        skills: [{ name: "z-skill", skillPath: "skills/z-skill/SKILL.md" }],
      },
      {
        source: "a-owner/a-repo",
        sourceUrl: "https://github.com/a-owner/a-repo.git",
        skills: [
          { name: "second-skill", skillPath: "skills/second-skill/SKILL.md" },
          { name: "first-skill", skillPath: "skills/first-skill/SKILL.md" },
        ],
      },
    ],
  });
}

async function createFixture(names = ["fixture-skill"]) {
  const fixtureRoot = await fs.mkdtemp(path.join(tmpdir(), "bootstrap-test-"));
  const home = path.join(fixtureRoot, "home");
  const canonicalRoot = path.join(home, ".config", "opencode", "skills");
  const upstreamRoot = path.join(home, ".agents", "skills");
  const lockPath = path.join(home, ".local", "state", "skills", ".skill-lock.json");
  await fs.mkdir(canonicalRoot, { recursive: true });
  await fs.mkdir(upstreamRoot, { recursive: true });
  return {
    fixtureRoot,
    manifest: fixtureManifest(names),
    roots: { home, canonicalRoot, upstreamRoot, lockPath },
  };
}

async function addXdgConfigRoot(fixture) {
  const xdgConfigHome = path.join(fixture.fixtureRoot, "xdg-config");
  await fs.mkdir(xdgConfigHome, { recursive: true });
  fixture.roots.xdgConfigHome = xdgConfigHome;
  return xdgConfigHome;
}

async function addXdgStateRoot(fixture) {
  const xdgStateHome = path.join(fixture.fixtureRoot, "xdg-state");
  await fs.mkdir(xdgStateHome, { recursive: true });
  fixture.roots.xdgStateHome = xdgStateHome;
  fixture.roots.lockPath = path.join(xdgStateHome, "skills", ".skill-lock.json");
  return xdgStateHome;
}

async function cleanFixture(fixture) {
  await fs.rm(fixture.fixtureRoot, { recursive: true, force: true });
}

async function writeSkill(root, name, content = "# Fixture\n") {
  const directory = path.join(root, name);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "SKILL.md"), content, "utf8");
  return directory;
}

async function writeLockData(roots, data) {
  await fs.mkdir(path.dirname(roots.lockPath), { recursive: true });
  await fs.writeFile(
    roots.lockPath,
    JSON.stringify(data, null, 2),
    "utf8",
  );
}

async function writeLock(roots, entries, version = 3) {
  await writeLockData(roots, { version, skills: entries });
}

function lockEntryFor(source, name, overrides = {}) {
  return {
    source: source.source,
    sourceType: "github",
    sourceUrl: source.sourceUrl,
    skillPath: source.skills.find((skill) => skill.name === name)?.skillPath
      ?? `skills/${name}/SKILL.md`,
    skillFolderHash: "0".repeat(40),
    ...overrides,
  };
}

function lockEntry(name, overrides = {}) {
  return lockEntryFor(fixtureManifest().sources[0], name, overrides);
}

test("the real bootstrap manifest is strict, sorted, and resolved", async () => {
  const manifest = await loadManifest();
  assert.deepEqual(manifestStats(manifest), { sources: 34, skills: 77 });
  assert.equal(new Set(manifest.sources.map((source) => source.source)).size, 34);
  assert.equal(
    new Set(manifest.sources.flatMap((source) => source.skills.map((skill) => skill.name))).size,
    77,
  );
  assert.deepEqual(
    manifest.sources.map((source) => source.source),
    [...manifest.sources].map((source) => source.source).sort(),
  );
});

test("manifest validation rejects duplicate skills, invalid sources, and unknown fields", () => {
  const duplicate = fixtureManifest(["first", "second"]);
  duplicate.sources[0].skills.push({ name: "first", skillPath: "skills/first/SKILL.md" });
  assert.throws(() => validateManifest(duplicate), /duplicate skill names/iu);

  assert.throws(
    () => validateManifest({
      schemaVersion: 1,
      sources: [{
        source: "github.com/fixture-owner/fixture-repo",
        sourceUrl: "https://github.com/fixture-owner/fixture-repo.git",
        skills: [{ name: "fixture-skill", skillPath: "skills/fixture-skill/SKILL.md" }],
      }],
    }),
    /GitHub owner\/repository/iu,
  );

  const unknown = fixtureManifest();
  unknown.extra = true;
  assert.throws(() => validateManifest(unknown), /unknown or missing fields/iu);
});

test("manifest validation rejects absolute, Windows, traversal, and shell-shaped paths", () => {
  for (const skillPath of [
    "/tmp/SKILL.md",
    "C:\\temp\\SKILL.md",
    "\\\\server\\share\\SKILL.md",
    "skills/../fixture-skill/SKILL.md",
    "skills/fixture skill/SKILL.md",
    "skills/fixture-skill/$HOME/SKILL.md",
  ]) {
    assert.throws(
      () => validateManifest({
        schemaVersion: 1,
        sources: [{
          source: "fixture-owner/fixture-repo",
          sourceUrl: "https://github.com/fixture-owner/fixture-repo.git",
          skills: [{ name: "fixture-skill", skillPath }],
        }],
      }),
      /relative|normalized|path/iu,
    );
  }
});

test("missing manifest errors keep ENOENT without exposing the absolute path", async () => {
  const fixture = await createFixture();
  try {
    const manifestPath = path.join(fixture.fixtureRoot, "missing", "manifest.json");
    await assert.rejects(
      () => loadManifest(manifestPath),
      (error) => {
        assert.match(error.message, /^manifest read failed: ENOENT$/u);
        assert.doesNotMatch(error.message, new RegExp(fixture.fixtureRoot, "u"));
        return true;
      },
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("inaccessible manifest errors keep EACCES without exposing the raw path", async () => {
  const fixture = await createFixture();
  try {
    const manifestPath = path.join(fixture.fixtureRoot, "protected", "manifest.json");
    await assert.rejects(
      () => loadManifest(manifestPath, {
        readFile: async () => {
          const error = new Error(`open ${manifestPath}: permission denied`);
          error.code = "EACCES";
          throw error;
        },
      }),
      (error) => {
        assert.match(error.message, /^manifest inaccessible: EACCES$/u);
        assert.doesNotMatch(error.message, new RegExp(fixture.fixtureRoot, "u"));
        assert.doesNotMatch(error.message, /permission denied/iu);
        return true;
      },
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("malformed manifest JSON reports a sanitized parse failure", async () => {
  const fixture = await createFixture();
  try {
    const manifestPath = path.join(fixture.fixtureRoot, "manifest.json");
    await fs.writeFile(manifestPath, "{\n", "utf8");
    await assert.rejects(
      () => loadManifest(manifestPath),
      (error) => {
        assert.equal(error.message, "manifest parse failed");
        assert.doesNotMatch(error.message, new RegExp(fixture.fixtureRoot, "u"));
        return true;
      },
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("HOME canonical OpenCode target is protected when XDG_CONFIG_HOME is absent", async () => {
  const fixture = await createFixture();
  try {
    assert.deepEqual(
      await resolveProtectedOpenCodeTargets(fixture.roots),
      [fixture.roots.canonicalRoot],
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("XDG_CONFIG_HOME canonical OpenCode target is protected alongside HOME", async () => {
  const fixture = await createFixture();
  try {
    const xdgConfigHome = await addXdgConfigRoot(fixture);
    assert.deepEqual(
      await resolveProtectedOpenCodeTargets(fixture.roots),
      [
        fixture.roots.canonicalRoot,
        path.join(xdgConfigHome, "opencode", "skills"),
      ],
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("identical HOME and XDG_CONFIG_HOME targets are deduplicated", async () => {
  const fixture = await createFixture();
  try {
    fixture.roots.xdgConfigHome = path.join(fixture.roots.home, ".config");
    assert.deepEqual(
      await resolveProtectedOpenCodeTargets(fixture.roots),
      [fixture.roots.canonicalRoot],
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("absent XDG_CONFIG_HOME preserves the HOME-only safe behavior", async () => {
  const fixture = await createFixture();
  try {
    const defaults = getDefaultRoots({}, fixture.roots.home);
    assert.equal(defaults.canonicalRoot, fixture.roots.canonicalRoot);
    assert.equal(defaults.xdgConfigHome, undefined);
    assert.equal("XDG_CONFIG_HOME" in buildChildEnvironment(
      fixture.roots,
      {},
      { PATH: "/controlled/bin", XDG_CONFIG_HOME: "/uncontrolled/config" },
    ), false);
    assert.deepEqual(
      await resolveProtectedOpenCodeTargets(fixture.roots),
      [fixture.roots.canonicalRoot],
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("unsafe XDG_CONFIG_HOME paths fail closed before child execution", async () => {
  const fixture = await createFixture();
  try {
    assert.throws(
      () => getDefaultRoots({ XDG_CONFIG_HOME: "relative/config" }, fixture.roots.home),
      /absolute runtime path/iu,
    );

    const xdgSymlink = path.join(fixture.fixtureRoot, "xdg-config-link");
    await fs.symlink(path.join(fixture.fixtureRoot, "missing-config"), xdgSymlink);
    await assert.rejects(
      () => resolveProtectedOpenCodeTargets({
        ...fixture.roots,
        xdgConfigHome: xdgSymlink,
      }),
      /symlink component/iu,
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("child environment keeps only controlled platform and runtime variables", async () => {
  const fixture = await createFixture();
  try {
    const xdgConfigHome = await addXdgConfigRoot(fixture);
    const xdgStateHome = await addXdgStateRoot(fixture);
    const tempHome = path.join(fixture.fixtureRoot, "controlled-temp");
    const cacheHome = path.join(fixture.fixtureRoot, "controlled-cache");
    const childEnvironment = buildChildEnvironment(
      fixture.roots,
      {
        XDG_CACHE_HOME: cacheHome,
        TMPDIR: tempHome,
        TEMP: tempHome,
        TMP: tempHome,
      },
      {
        PATH: "/controlled/bin",
        NODE_OPTIONS: "--require=/untrusted/hook.js",
        npm_config_registry: "https://untrusted.example/",
        NPM_CONFIG_REGISTRY: "https://untrusted.example/",
        npm_config_userconfig: "/untrusted/npmrc",
        NPM_CONFIG_USERCONFIG: "/untrusted/npmrc",
        HTTP_PROXY: "http://untrusted.example:8080",
        HTTPS_PROXY: "http://untrusted.example:8080",
        ALL_PROXY: "http://untrusted.example:8080",
        http_proxy: "http://untrusted.example:8080",
        https_proxy: "http://untrusted.example:8080",
        all_proxy: "http://untrusted.example:8080",
      },
    );

    assert.equal(childEnvironment.PATH, "/controlled/bin");
    assert.equal(childEnvironment.HOME, fixture.roots.home);
    assert.equal(childEnvironment.XDG_CONFIG_HOME, xdgConfigHome);
    assert.equal(childEnvironment.XDG_STATE_HOME, xdgStateHome);
    assert.equal(childEnvironment.XDG_CACHE_HOME, cacheHome);
    assert.equal(childEnvironment.TMPDIR, tempHome);
    assert.equal(childEnvironment.TEMP, tempHome);
    assert.equal(childEnvironment.TMP, tempHome);
    assert.equal(childEnvironment.DISABLE_TELEMETRY, "1");
    assert.equal(childEnvironment.DO_NOT_TRACK, "1");
    assert.equal(childEnvironment.NODE_OPTIONS, undefined);
    for (const key of [
      "npm_config_registry",
      "NPM_CONFIG_REGISTRY",
      "npm_config_userconfig",
      "NPM_CONFIG_USERCONFIG",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "ALL_PROXY",
      "http_proxy",
      "https_proxy",
      "all_proxy",
    ]) {
      assert.equal(childEnvironment[key], undefined, `${key} must not be inherited`);
    }
  } finally {
    await cleanFixture(fixture);
  }
});

test("child environment rejects arbitrary and controlled-root override keys", async () => {
  const fixture = await createFixture();
  try {
    assert.equal(
      buildChildEnvironment(fixture.roots, { HOME: fixture.roots.home }).HOME,
      fixture.roots.home,
    );
    for (const overrides of [
      { NODE_OPTIONS: "--require=/untrusted/hook.js" },
      { npm_config_registry: "https://untrusted.example/" },
      { HOME: path.join(fixture.fixtureRoot, "uncontrolled-home") },
    ]) {
      assert.throws(
        () => buildChildEnvironment(fixture.roots, overrides),
        /child environment override/iu,
      );
    }
  } finally {
    await cleanFixture(fixture);
  }
});

test("dry-run is deterministic and executes no child process or mutation", async () => {
  const fixture = await createFixture();
  try {
    const beforeCanonical = await snapshotTree(fixture.roots.canonicalRoot);
    const beforeUpstream = await snapshotTree(fixture.roots.upstreamRoot);
    let childCalls = 0;
    const first = await executeBootstrap({
      mode: "dry-run",
      manifest: fixture.manifest,
      roots: fixture.roots,
      cwd: fixture.roots.canonicalRoot,
      requireCanonicalCwd: false,
      runChild: async () => {
        childCalls += 1;
        throw new Error("dry-run must not spawn");
      },
      log: silent,
    });
    const second = await executeBootstrap({
      mode: "dry-run",
      manifest: fixture.manifest,
      roots: fixture.roots,
      cwd: fixture.roots.canonicalRoot,
      requireCanonicalCwd: false,
      runChild: async () => {
        childCalls += 1;
        throw new Error("dry-run must not spawn");
      },
      log: silent,
    });
    assert.equal(childCalls, 0);
    assert.equal(first.missing, 1);
    assert.deepEqual(first.plan.sources, second.plan.sources);
    assert.deepEqual(beforeCanonical, await snapshotTree(fixture.roots.canonicalRoot));
    assert.deepEqual(beforeUpstream, await snapshotTree(fixture.roots.upstreamRoot));
  } finally {
    await cleanFixture(fixture);
  }
});

test("update re-adds installed declared skills with the exact grouped add argv", async () => {
  const fixture = await createFixture(["second-skill", "first-skill"]);
  try {
    await writeSkill(fixture.roots.upstreamRoot, "first-skill", "# first\n");
    await writeSkill(fixture.roots.upstreamRoot, "second-skill", "# second\n");
    await writeLock(fixture.roots, {
      "first-skill": lockEntry("first-skill"),
      "second-skill": lockEntry("second-skill"),
    });

    const calls = [];
    let probes = 0;
    const result = await executeBootstrap({
      mode: "update",
      manifest: fixture.manifest,
      roots: fixture.roots,
      cwd: fixture.roots.canonicalRoot,
      requireCanonicalCwd: false,
      resolveVersion: async () => "1.5.23",
      runProbes: async () => {
        probes += 1;
      },
      runChild: async (command, args, options) => {
        calls.push({ command, args, options });
        return { status: 0, stdout: "", stderr: "" };
      },
      log: silent,
    });

    assert.equal(probes, 1);
    assert.equal(result.installed, 2);
    assert.equal(result.operations, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "npm");
    assert.deepEqual(calls[0].args, [
      "exec",
      "--yes",
      "--package=skills@1.5.23",
      "--",
      "skills",
      "add",
      "https://github.com/fixture-owner/fixture-repo.git",
      "--skill",
      "first-skill",
      "second-skill",
      "--global",
      "--agent",
      "opencode",
      "--yes",
      "--copy",
    ]);
    assert.equal(calls[0].options.meta, "update fixture-owner/fixture-repo");
  } finally {
    await cleanFixture(fixture);
  }
});

test("update plans deterministic source groups and covers every declared skill", async () => {
  const fixture = await createFixture();
  const manifest = multiSourceManifest();
  try {
    const entries = {};
    for (const source of manifest.sources) {
      for (const skill of source.skills) {
        await writeSkill(fixture.roots.upstreamRoot, skill.name);
        entries[skill.name] = lockEntryFor(source, skill.name);
      }
    }
    await writeLock(fixture.roots, entries);

    const plan = await buildPlan(manifest, fixture.roots, {
      requireCanonicalCwd: false,
      update: true,
    });

    assert.equal(plan.mode, "update");
    assert.equal(plan.operations, 2);
    assert.equal(plan.operationSkills, 3);
    assert.deepEqual(plan.sources.map((source) => source.source), [
      "a-owner/a-repo",
      "z-owner/z-repo",
    ]);
    assert.deepEqual(plan.sources[0].operationNames, ["first-skill", "second-skill"]);
    assert.deepEqual(plan.sources[1].operationNames, ["z-skill"]);
    assert.equal(plan.sources.every((source) => source.action.startsWith("update:")), true);
  } finally {
    await cleanFixture(fixture);
  }
});

test("update dry-run and verify execute no child processes", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, { "fixture-skill": lockEntry("fixture-skill") });
    let childCalls = 0;
    const runChild = async () => {
      childCalls += 1;
      throw new Error("read-only mode must not spawn");
    };

    const plainDryRun = await executeBootstrap({
      mode: "dry-run",
      manifest: fixture.manifest,
      roots: fixture.roots,
      cwd: fixture.roots.canonicalRoot,
      requireCanonicalCwd: false,
      runChild,
      log: silent,
    });
    const updateDryRun = await executeBootstrap({
      mode: "update-dry-run",
      manifest: fixture.manifest,
      roots: fixture.roots,
      cwd: fixture.roots.canonicalRoot,
      requireCanonicalCwd: false,
      runChild,
      log: silent,
    });
    const verify = await executeBootstrap({
      mode: "verify",
      manifest: fixture.manifest,
      roots: fixture.roots,
      cwd: fixture.roots.canonicalRoot,
      requireCanonicalCwd: false,
      runChild,
      log: silent,
    });

    assert.equal(childCalls, 0);
    assert.equal(plainDryRun.operations, 0);
    assert.equal(updateDryRun.operations, 1);
    assert.equal(updateDryRun.operationSkills, 1);
    assert.equal(verify.ok, true);
  } finally {
    await cleanFixture(fixture);
  }
});

test("update stops before real commands when the isolated capability probe fails", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, { "fixture-skill": lockEntry("fixture-skill") });
    let childCalls = 0;
    await assert.rejects(
      () => executeBootstrap({
        mode: "update",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => "1.5.23",
        runProbes: async () => {
          throw new Error("isolated probe failed");
        },
        runChild: async () => {
          childCalls += 1;
          return { status: 0, stdout: "", stderr: "" };
        },
        log: silent,
      }),
      /isolated probe failed/iu,
    );
    assert.equal(childCalls, 0);
  } finally {
    await cleanFixture(fixture);
  }
});

test("a failing isolated OpenCode target probe prevents the real update command", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, { "fixture-skill": lockEntry("fixture-skill") });
    let realUpdateCalls = 0;
    await assert.rejects(
      () => executeBootstrap({
        mode: "update",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => "1.5.23",
        runProbes: async (version, manifest) => runSafetyProbes(
          version,
          manifest,
          async (command, args, options) => {
            const skillName = args[args.indexOf("--skill") + 1];
            await writeSkill(path.join(options.env.HOME, ".agents", "skills"), skillName);
            const target = path.join(options.env.XDG_CONFIG_HOME, "opencode", "skills");
            await fs.mkdir(target, { recursive: true });
            return { status: 0, stdout: "", stderr: "" };
          },
        ),
        runChild: async () => {
          realUpdateCalls += 1;
          return { status: 0, stdout: "", stderr: "" };
        },
        log: silent,
      }),
      /OpenCode skills target/iu,
    );
    assert.equal(realUpdateCalls, 0);
  } finally {
    await cleanFixture(fixture);
  }
});

test("update detects canonical mutation and leaves the mutation unrepaired", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, { "fixture-skill": lockEntry("fixture-skill") });
    await assert.rejects(
      () => executeBootstrap({
        mode: "update",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => "1.5.23",
        runProbes: async () => {},
        runChild: async () => {
          await fs.writeFile(path.join(fixture.roots.canonicalRoot, "unexpected"), "mutation", "utf8");
          return { status: 0, stdout: "", stderr: "" };
        },
        log: silent,
      }),
      /mutated the canonical repository/iu,
    );
    assert.equal(
      await fs.readFile(path.join(fixture.roots.canonicalRoot, "unexpected"), "utf8"),
      "mutation",
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("update detects mutation of the alternate XDG_CONFIG_HOME target", async () => {
  const fixture = await createFixture();
  try {
    const xdgConfigHome = await addXdgConfigRoot(fixture);
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, { "fixture-skill": lockEntry("fixture-skill") });
    await assert.rejects(
      () => executeBootstrap({
        mode: "update",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => "1.5.23",
        runProbes: async () => {},
        runChild: async (command, args, options) => {
          const target = path.join(options.env.XDG_CONFIG_HOME, "opencode", "skills");
          await fs.mkdir(target, { recursive: true });
          await fs.writeFile(path.join(target, "unexpected"), "mutation", "utf8");
          assert.equal(options.env.XDG_CONFIG_HOME, xdgConfigHome);
          return { status: 0, stdout: "", stderr: "" };
        },
        log: silent,
      }),
      /protected OpenCode skills target changed unexpectedly/iu,
    );
    assert.equal(
      await fs.readFile(
        path.join(xdgConfigHome, "opencode", "skills", "unexpected"),
        "utf8",
      ),
      "mutation",
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("update revalidates existing roots immediately before spawning", async () => {
  const fixture = await createFixture();
  try {
    const racedRoot = path.join(fixture.roots.upstreamRoot, "fixture-skill");
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, { "fixture-skill": lockEntry("fixture-skill") });
    let updateCalls = 0;
    await assert.rejects(
      () => executeBootstrap({
        mode: "update",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => {
          await fs.rm(racedRoot, { recursive: true, force: true });
          return "1.5.23";
        },
        runProbes: async () => {},
        runChild: async () => {
          updateCalls += 1;
          return { status: 0, stdout: "", stderr: "" };
        },
        log: silent,
      }),
      /planned existing.*changed before update|root is missing/iu,
    );
    assert.equal(updateCalls, 0);
  } finally {
    await cleanFixture(fixture);
  }
});

test("update reports extras without deleting or operating on them", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeSkill(fixture.roots.upstreamRoot, "skill-improver", "# protected\n");
    const lock = {
      "fixture-skill": lockEntry("fixture-skill"),
      "stale-extra": lockEntry("stale-extra"),
    };
    await writeLock(fixture.roots, lock);
    const beforeLock = JSON.parse(await fs.readFile(fixture.roots.lockPath, "utf8"));
    const calls = [];

    const result = await executeBootstrap({
      mode: "update",
      manifest: fixture.manifest,
      roots: fixture.roots,
      cwd: fixture.roots.canonicalRoot,
      requireCanonicalCwd: false,
      resolveVersion: async () => "1.5.23",
      runProbes: async () => {},
      runChild: async (command, args) => {
        calls.push({ command, args });
        return { status: 0, stdout: "", stderr: "" };
      },
      log: silent,
    });

    assert.equal(result.extra, 1);
    assert.equal(result.lockExtras, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].args.includes("skill-improver"), false);
    assert.equal(calls[0].args.includes("stale-extra"), false);
    assert.equal(await fs.readFile(path.join(fixture.roots.upstreamRoot, "skill-improver", "SKILL.md"), "utf8"), "# protected\n");
    assert.deepEqual(
      JSON.parse(await fs.readFile(fixture.roots.lockPath, "utf8")),
      beforeLock,
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("default bootstrap remains install-missing-only", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, { "fixture-skill": lockEntry("fixture-skill") });
    let childCalls = 0;
    const result = await executeBootstrap({
      mode: "install",
      manifest: fixture.manifest,
      roots: fixture.roots,
      cwd: fixture.roots.canonicalRoot,
      requireCanonicalCwd: false,
      resolveVersion: async () => {
        throw new Error("default mode must not resolve a version when nothing is missing");
      },
      runProbes: async () => {
        throw new Error("default mode must not probe when nothing is missing");
      },
      runChild: async () => {
        childCalls += 1;
        throw new Error("default mode must not spawn for installed skills");
      },
      log: silent,
    });
    assert.equal(result.missing, 0);
    assert.equal(result.installed, 1);
    assert.equal(childCalls, 0);
  } finally {
    await cleanFixture(fixture);
  }
});

test("argument parsing keeps update composable while verify stays standalone", () => {
  assert.equal(parseArguments(["--update"]), "update");
  assert.equal(parseArguments(["--update", "--dry-run"]), "update-dry-run");
  assert.equal(parseArguments(["--dry-run", "--update"]), "update-dry-run");
  assert.equal(parseArguments([]), "install");
  assert.throws(() => parseArguments(["--verify", "--update"]), /only one bootstrap mode/iu);
  assert.throws(() => parseArguments(["--update", "--verify"]), /only one bootstrap mode/iu);
});

test("the child boundary never evaluates shell-shaped command input", async () => {
  const fixture = await createFixture();
  try {
    const marker = path.join(fixture.fixtureRoot, "shell-marker");
    const shellShapedCommand = `${process.execPath} -e "require('node:fs').writeFileSync('${marker}', 'mutated')"`;
    await assert.rejects(
      () => spawnCommand(shellShapedCommand, [], { cwd: fixture.fixtureRoot }),
    );
    await assert.rejects(() => fs.access(marker));
  } finally {
    await cleanFixture(fixture);
  }
});

test("dangerous canonical and upstream roots fail closed", async () => {
  const fixture = await createFixture();
  try {
    await assert.rejects(
      () => assertSafeRoots({
        ...fixture.roots,
        canonicalRoot: fixture.roots.upstreamRoot,
      }),
      /overlap/iu,
    );

    const symlinkParent = path.join(fixture.fixtureRoot, "canonical-link");
    await fs.symlink(fixture.roots.canonicalRoot, symlinkParent);
    await assert.rejects(
      () => assertSafeRoots({
        ...fixture.roots,
        canonicalRoot: path.join(symlinkParent, "nested"),
      }),
      /symlink component/iu,
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("protected targets reject external and dangling nested symlinks", async () => {
  const fixture = await createFixture();
  try {
    const nestedDirectory = path.join(fixture.roots.canonicalRoot, "node_modules");
    await fs.mkdir(nestedDirectory, { recursive: true });
    for (const target of [
      path.join(fixture.fixtureRoot, "external-target"),
      path.join(fixture.fixtureRoot, "missing-target"),
    ]) {
      const link = path.join(nestedDirectory, path.basename(target));
      if (target.endsWith("external-target")) {
        await fs.mkdir(target, { recursive: true });
      }
      await fs.symlink(target, link);
      await assert.rejects(
        () => assertSafeRoots(fixture.roots),
        /nested symlink/iu,
      );
      await fs.rm(link, { force: true });
    }
  } finally {
    await cleanFixture(fixture);
  }
});

test("safe internal nested symlinks are snapshotted and write-through is detected", async () => {
  const fixture = await createFixture();
  try {
    const internalTarget = path.join(
      fixture.roots.canonicalRoot,
      "node_modules",
      "internal-target",
    );
    const internalLink = path.join(
      fixture.roots.canonicalRoot,
      "node_modules",
      "internal-link",
    );
    await fs.mkdir(internalTarget, { recursive: true });
    await fs.writeFile(path.join(internalTarget, "SKILL.md"), "# safe\n", "utf8");
    await fs.symlink("internal-target", internalLink);

    assert.deepEqual(
      await resolveProtectedOpenCodeTargets(fixture.roots),
      [fixture.roots.canonicalRoot],
    );
    const snapshot = await snapshotTree(fixture.roots.canonicalRoot);
    assert.equal(
      snapshot.entries.find((entry) => entry.relativePath === "node_modules/internal-link")?.type,
      "symlink",
    );
    assert.equal(
      snapshot.entries.find((entry) => entry.relativePath === "node_modules/internal-target/SKILL.md")?.type,
      "file",
    );

    await assert.rejects(
      () => executeBootstrap({
        mode: "install",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => "1.5.23",
        runProbes: async () => {},
        runChild: async () => {
          await fs.writeFile(path.join(internalLink, "written-through-link"), "mutation", "utf8");
          return { status: 0 };
        },
        log: silent,
      }),
      /mutated the canonical repository/iu,
    );
    assert.equal(
      await fs.readFile(path.join(internalTarget, "written-through-link"), "utf8"),
      "mutation",
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("a simulated CLI canonical write stops the install without repair", async () => {
  const fixture = await createFixture();
  try {
    let addCalls = 0;
    await assert.rejects(
      () => executeBootstrap({
        mode: "install",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => "1.5.23",
        runProbes: async () => {},
        runChild: async (command, args) => {
          addCalls += 1;
          assert.equal(command, "npm");
          assert.deepEqual(args.slice(0, 7), [
            "exec",
            "--yes",
            "--package=skills@1.5.23",
            "--",
            "skills",
            "add",
            "https://github.com/fixture-owner/fixture-repo.git",
          ]);
          await fs.writeFile(path.join(fixture.roots.canonicalRoot, "unexpected"), "mutation", "utf8");
          return { status: 0 };
        },
        log: silent,
      }),
      /mutated the canonical repository/iu,
    );
    assert.equal(addCalls, 1);
    assert.equal(await fs.readFile(path.join(fixture.roots.canonicalRoot, "unexpected"), "utf8"), "mutation");
  } finally {
    await cleanFixture(fixture);
  }
});

test("default install detects XDG canonical mutation during the add child without repair", async () => {
  const fixture = await createFixture();
  try {
    await addXdgConfigRoot(fixture);
    let addCalls = 0;
    await assert.rejects(
      () => executeBootstrap({
        mode: "install",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => "1.5.23",
        runProbes: async () => {},
        runChild: async (command, args, options) => {
          addCalls += 1;
          assert.equal(command, "npm");
          assert.equal(args.includes("add"), true);
          const target = path.join(options.env.XDG_CONFIG_HOME, "opencode", "skills");
          await fs.mkdir(target, { recursive: true });
          await fs.writeFile(path.join(target, "unexpected"), "mutation", "utf8");
          return { status: 0 };
        },
        log: silent,
      }),
      /protected OpenCode skills target changed unexpectedly/iu,
    );
    assert.equal(addCalls, 1);
    assert.equal(
      await fs.readFile(
        path.join(fixture.roots.xdgConfigHome, "opencode", "skills", "unexpected"),
        "utf8",
      ),
      "mutation",
    );
  } finally {
    await cleanFixture(fixture);
  }
});

test("a simulated CLI canonical symlink stops the install without repair", async () => {
  const fixture = await createFixture();
  try {
    await assert.rejects(
      () => executeBootstrap({
        mode: "install",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => "1.5.23",
        runProbes: async () => {},
        runChild: async () => {
          await fs.symlink(
            fixture.roots.upstreamRoot,
            path.join(fixture.roots.canonicalRoot, "unexpected-link"),
          );
          return { status: 0 };
        },
        log: silent,
      }),
      /mutated the canonical repository/iu,
    );
    const link = await fs.lstat(path.join(fixture.roots.canonicalRoot, "unexpected-link"));
    assert.equal(link.isSymbolicLink(), true);
  } finally {
    await cleanFixture(fixture);
  }
});

test("revalidates planned missing roots before spawning and never replaces a raced root", async () => {
  const fixture = await createFixture();
  try {
    const racedRoot = path.join(fixture.roots.upstreamRoot, "fixture-skill");
    let installCalls = 0;
    await assert.rejects(
      () => executeBootstrap({
        mode: "install",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        resolveVersion: async () => {
          await writeSkill(fixture.roots.upstreamRoot, "fixture-skill", "# raced\n");
          return "1.5.23";
        },
        runProbes: async () => {},
        runChild: async () => {
          installCalls += 1;
          await fs.writeFile(path.join(racedRoot, "SKILL.md"), "# replacement\n", "utf8");
          return { status: 0, stdout: "", stderr: "" };
        },
        log: silent,
      }),
      /planned missing.*fixture-skill|no longer missing/iu,
    );
    assert.equal(installCalls, 0);
    assert.equal(await fs.readFile(path.join(racedRoot, "SKILL.md"), "utf8"), "# raced\n");
  } finally {
    await cleanFixture(fixture);
  }
});

test("command generation is deterministic and uses structured exact CLI arguments", () => {
  const first = buildAddCommand(
    "https://github.com/fixture-owner/fixture-repo.git",
    ["second", "first"],
    "1.5.23",
  );
  const second = buildAddCommand(
    "https://github.com/fixture-owner/fixture-repo.git",
    ["first", "second"],
    "1.5.23",
  );
  assert.deepEqual(first, second);
  assert.deepEqual(first.args, [
    "exec",
    "--yes",
    "--package=skills@1.5.23",
    "--",
    "skills",
    "add",
    "https://github.com/fixture-owner/fixture-repo.git",
    "--skill",
    "first",
    "second",
    "--global",
    "--agent",
    "opencode",
    "--yes",
    "--copy",
  ]);
});

test("verify reports missing installed skills and unresolved lock metadata", async () => {
  const fixture = await createFixture();
  try {
    const state = await verifyState(fixture.manifest, fixture.roots, {
      requireCanonicalCwd: false,
    });
    assert.equal(state.ok, false);
    assert.equal(state.installed, 0);
    assert.equal(state.missing, 1);
    assert.equal(state.unresolved, 1);
    assert.deepEqual(state.missingNames, ["fixture-skill"]);
  } finally {
    await cleanFixture(fixture);
  }
});

test("verify detects an unexpected canonical mutation against a supplied baseline", async () => {
  const fixture = await createFixture();
  try {
    const baseline = await snapshotTree(fixture.roots.canonicalRoot);
    await fs.writeFile(path.join(fixture.roots.canonicalRoot, "changed"), "changed", "utf8");
    const state = await verifyState(fixture.manifest, fixture.roots, {
      requireCanonicalCwd: false,
      expectedCanonicalSnapshot: baseline,
    });
    assert.equal(state.contamination.includes("canonical snapshot changed unexpectedly"), true);
  } finally {
    await cleanFixture(fixture);
  }
});

test("repeated bootstrap plans are stable and valid entries are idempotently skipped", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, { "fixture-skill": lockEntry("fixture-skill") });
    const first = await buildPlan(fixture.manifest, fixture.roots, { requireCanonicalCwd: false });
    const second = await buildPlan(fixture.manifest, fixture.roots, { requireCanonicalCwd: false });
    assert.deepEqual(first, second);
    assert.equal(first.missing, 0);
    assert.equal(first.installed, 1);
    assert.equal(first.sources[0].command, null);
  } finally {
    await cleanFixture(fixture);
  }
});

test("existing skill with mismatched lock metadata fails closed", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeLock(fixture.roots, {
      "fixture-skill": lockEntry("fixture-skill", {
        sourceUrl: "https://github.com/other-owner/other-repo.git",
      }),
    });
    await assert.rejects(
      () => buildPlan(fixture.manifest, fixture.roots, { requireCanonicalCwd: false }),
      /inconsistent lock metadata/iu,
    );
    const state = await verifyState(fixture.manifest, fixture.roots, {
      requireCanonicalCwd: false,
    });
    assert.deepEqual(state.lockMismatch.map((item) => item.name), ["fixture-skill"]);
  } finally {
    await cleanFixture(fixture);
  }
});

test("global lock metadata requires exactly the supported integer version", async () => {
  const fixture = await createFixture();
  try {
    for (const data of [
      { version: 2, skills: {} },
      { version: 4, skills: {} },
      { version: 3.5, skills: {} },
      { skills: {} },
    ]) {
      await writeLockData(fixture.roots, data);
      await assert.rejects(
        () => verifyState(fixture.manifest, fixture.roots, { requireCanonicalCwd: false }),
        /global lock version must be exactly 3/iu,
      );
    }
  } finally {
    await cleanFixture(fixture);
  }
});

test("extras are reported and never deleted", async () => {
  const fixture = await createFixture();
  try {
    await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await writeSkill(fixture.roots.upstreamRoot, "protected-extra");
    await writeLock(fixture.roots, {
      "fixture-skill": lockEntry("fixture-skill"),
      "stale-extra": lockEntry("stale-extra"),
    });
    const state = await verifyState(fixture.manifest, fixture.roots, {
      requireCanonicalCwd: false,
    });
    assert.equal(state.ok, true);
    assert.deepEqual(state.extraNames, ["protected-extra"]);
    assert.deepEqual(state.lockExtraNames, ["stale-extra"]);
    await fs.access(path.join(fixture.roots.upstreamRoot, "protected-extra", "SKILL.md"));
    await fs.access(fixture.roots.lockPath);
  } finally {
    await cleanFixture(fixture);
  }
});

test("declared upstream roots reject root and nested symlinks", async () => {
  const fixture = await createFixture();
  try {
    const real = await writeSkill(fixture.roots.upstreamRoot, "real-skill");
    await fs.symlink(real, path.join(fixture.roots.upstreamRoot, "fixture-skill"));
    let state = await verifyState(fixture.manifest, fixture.roots, {
      requireCanonicalCwd: false,
    });
    assert.equal(state.invalid[0].reason, "root is a symlink");

    await fs.rm(path.join(fixture.roots.upstreamRoot, "fixture-skill"), { recursive: true, force: true });
    const root = await writeSkill(fixture.roots.upstreamRoot, "fixture-skill");
    await fs.symlink(real, path.join(root, "nested-link"));
    state = await verifyState(fixture.manifest, fixture.roots, {
      requireCanonicalCwd: false,
    });
    assert.equal(state.invalid[0].reason, "root contains a symlink");
  } finally {
    await cleanFixture(fixture);
  }
});

test("CLI version resolution is frozen and confirmed once", async () => {
  const fixture = await createFixture();
  try {
    const calls = [];
    const version = await resolveCliVersion(async (command, args, options) => {
      calls.push({ command, args, options });
      return args[0] === "view"
        ? { status: 0, stdout: '"1.5.23"', stderr: "" }
        : { status: 0, stdout: "1.5.23\n", stderr: "" };
    }, fixture.roots);
    assert.equal(version, "1.5.23");
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].args.slice(0, 5), [
      "exec",
      "--yes",
      "--package=skills@1.5.23",
      "--",
      "skills",
    ]);
  } finally {
    await cleanFixture(fixture);
  }
});

test("default install stops on XDG mutation during the first version child", async () => {
  const fixture = await createFixture();
  try {
    await addXdgConfigRoot(fixture);
    const calls = [];
    let probes = 0;
    await assert.rejects(
      () => executeBootstrap({
        mode: "install",
        manifest: fixture.manifest,
        roots: fixture.roots,
        cwd: fixture.roots.canonicalRoot,
        requireCanonicalCwd: false,
        runProbes: async () => {
          probes += 1;
        },
        runChild: async (command, args, options) => {
          calls.push({ command, args, options });
          if (calls.length === 1) {
            const target = path.join(options.env.XDG_CONFIG_HOME, "opencode", "skills");
            await fs.mkdir(target, { recursive: true });
            await fs.writeFile(path.join(target, "unexpected"), "mutation", "utf8");
            return { status: 0, stdout: '"1.5.23"', stderr: "" };
          }
          return args[0] === "view"
            ? { status: 0, stdout: '"1.5.23"', stderr: "" }
            : { status: 0, stdout: "1.5.23\n", stderr: "" };
        },
        log: silent,
      }),
      /protected OpenCode skills target changed unexpectedly/iu,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].args[0], "view");
    assert.equal(calls.some((call) => call.args.includes("add")), false);
    assert.equal(probes, 0);
  } finally {
    await cleanFixture(fixture);
  }
});

test("capability probes use isolated temporary roots and verify local/remote semantics", async () => {
  const fixture = await createFixture();
  try {
    const calls = [];
    await runSafetyProbes("1.5.23", fixture.manifest, async (command, args, options) => {
      calls.push({ command, args, options });
      const home = options.env.HOME;
      const upstreamRoot = path.join(home, ".agents", "skills");
      const skillName = args[args.indexOf("--skill") + 1];
      await writeSkill(upstreamRoot, skillName);
      if (options.meta === "remote CLI capability probe") {
        const source = fixture.manifest.sources[0];
        const skill = source.skills[0];
        const lockPath = path.join(options.env.XDG_STATE_HOME, "skills", ".skill-lock.json");
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        await fs.writeFile(lockPath, JSON.stringify({
          version: 3,
          skills: {
            [skill.name]: lockEntry(skill.name),
          },
        }), "utf8");
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.equal(call.command, "npm");
      assert.equal(call.args.includes("--global"), true);
      assert.equal(call.args.includes("--agent"), true);
      assert.equal(call.args.includes("opencode"), true);
      assert.equal(call.args.includes("--copy"), true);
      assert.equal(call.options.env.DISABLE_TELEMETRY, "1");
      assert.equal(call.options.env.DO_NOT_TRACK, "1");
      const probeRoot = path.dirname(call.options.env.HOME);
      assert.equal(call.options.env.XDG_CONFIG_HOME, path.join(probeRoot, "config"));
      assert.equal(call.options.env.XDG_STATE_HOME, path.join(probeRoot, "state"));
      assert.equal(call.options.env.XDG_CACHE_HOME, path.join(probeRoot, "cache"));
      assert.equal(call.options.env.npm_config_cache, path.join(probeRoot, "cache"));
      assert.equal(call.options.env.npm_config_userconfig, undefined);
      assert.equal(call.options.env.NPM_CONFIG_USERCONFIG, undefined);
      assert.equal(call.options.env.TMPDIR, path.join(probeRoot, "tmp"));
      assert.equal(call.options.env.TEMP, path.join(probeRoot, "tmp"));
      assert.equal(call.options.env.TMP, path.join(probeRoot, "tmp"));
    }
  } finally {
    await cleanFixture(fixture);
  }
});

test("capability probes reject configured and fallback OpenCode target changes", async () => {
  for (const targetKind of ["xdg", "home"]) {
    const fixture = await createFixture();
    try {
      await assert.rejects(
        () => runSafetyProbes("1.5.23", fixture.manifest, async (command, args, options) => {
          const home = options.env.HOME;
          const skillName = args[args.indexOf("--skill") + 1];
          await writeSkill(path.join(home, ".agents", "skills"), skillName);
          const target = targetKind === "xdg"
            ? path.join(options.env.XDG_CONFIG_HOME, "opencode", "skills")
            : path.join(home, ".config", "opencode", "skills");
          await fs.mkdir(path.dirname(target), { recursive: true });
          if (targetKind === "xdg") {
            await fs.mkdir(target, { recursive: true });
            await fs.writeFile(path.join(target, "unexpected"), "mutation", "utf8");
          } else {
            await fs.symlink(path.join(home, ".agents", "skills"), target);
          }
          return { status: 0, stdout: "", stderr: "" };
        }),
        /OpenCode skills target/iu,
      );
    } finally {
      await cleanFixture(fixture);
    }
  }
});

test("failing or rejecting probes detect protected mutations and do not continue", async () => {
  for (const [targetKind, failureKind] of [["xdg", "status"], ["home", "reject"]]) {
    const fixture = await createFixture();
    try {
      const calls = [];
      await assert.rejects(
        () => executeBootstrap({
          mode: "install",
          manifest: fixture.manifest,
          roots: fixture.roots,
          cwd: fixture.roots.canonicalRoot,
          requireCanonicalCwd: false,
          resolveVersion: async () => "1.5.23",
          runProbes: runSafetyProbes,
          runChild: async (command, args, options) => {
            calls.push({ command, args, options });
            const target = targetKind === "xdg"
              ? path.join(options.env.XDG_CONFIG_HOME, "opencode", "skills")
              : path.join(options.env.HOME, ".config", "opencode", "skills");
            await fs.mkdir(target, { recursive: true });
            await fs.writeFile(path.join(target, "unexpected"), "mutation", "utf8");
            if (failureKind === "reject") throw new Error("probe child rejected");
            return { status: 7, stdout: "", stderr: "probe failed" };
          },
          log: silent,
        }),
        /protected OpenCode skills target changed unexpectedly/iu,
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0].options.meta, "local CLI capability probe");
      assert.equal(calls.some((call) => call.options.meta.includes("remote")), false);
      assert.equal(calls.some((call) => call.options.meta.startsWith("install")), false);
    } finally {
      await cleanFixture(fixture);
    }
  }
});

test("global lock resolution prefers XDG state and falls back to .agents", () => {
  const home = "/tmp/bootstrap-home";
  assert.equal(
    getGlobalLockPath({ XDG_STATE_HOME: "/tmp/bootstrap-state" }, home),
    "/tmp/bootstrap-state/skills/.skill-lock.json",
  );
  assert.equal(getGlobalLockPath({}, home), "/tmp/bootstrap-home/.agents/.skill-lock.json");
});
