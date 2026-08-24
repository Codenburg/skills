# New machine upstream skills setup

This is the safe reconstruction path for the external skills used by the canonical repository.
The canonical Git repository remains `~/.config/opencode/skills`; the skills CLI owns the
upstream store at `~/.agents/skills`. The bootstrap adapter never writes canonical skill
content, imports skills automatically, deletes extras, or rebuilds Graphify output.

## Quick path

Clone this repository at the exact canonical path, then run:

```bash
cd ~/.config/opencode/skills
node scripts/bootstrap-upstream-skills.mjs --dry-run
node scripts/bootstrap-upstream-skills.mjs
node scripts/bootstrap-upstream-skills.mjs --verify
```

`--dry-run` is the safe first step: it validates the manifest, roots, current lock metadata,
and plan without spawning a child process or mutating the filesystem. Default mode installs
only missing declared roots. `--verify` is read-only and exits unsuccessfully for missing,
unsafe, unresolved, or contaminated declared state.

For normal maintenance, run the explicit update workflow:

```bash
node scripts/bootstrap-upstream-skills.mjs --update
node scripts/bootstrap-upstream-skills.mjs --verify
```

`--update` re-adds all 77 declared skills in 34 deterministic source-group operations. Preview
that exact plan with `node scripts/bootstrap-upstream-skills.mjs --update --dry-run`; plain
`--dry-run` remains the install-missing-only preview. Both previews, and `--verify`, execute
zero child processes. Update mode fails closed before any child operation if a declared root is
missing, unsafe, or lacks matching schema-v3 lock metadata.

## Current declaration

`upstream-skills.json` is a machine-bootstrap declaration, schema version 1. It is deliberately
independent of `skills-sources.json`, which remains the curation authority. The declaration was
derived from current evidence:

| Evidence | Current count | Meaning |
| --- | ---: | --- |
| Source groups | 34 | Normalized GitHub repositories |
| Declared skills | 77 | Resolved roots selected for reconstruction |
| Unresolved skills | 0 | Every declared root has current source and path evidence |
| Direct upstream skill roots | 79 | 77 declared roots plus protected `skill-improver` and `skill-registry` |
| Global lock records | 112 | 77 declared records plus 35 out-of-scope records |

`skillPath` is persisted because `skills@1.5.23` records it in the global lock and uses it to
check whether a GitHub skill can be updated. The bootstrap verifies the matching `source`,
`sourceUrl`, `skillPath`, GitHub `sourceType`, and update hash in the runtime lock. The
declaration does not hard-pin repository refs or package versions, and does not invent or pin
hashes, verdicts, approvals, or Graphify data. It records `skillPath` solely for lock verification.

## What the adapter protects

- It requires execution from the exact canonical repository path and rejects symlink components,
  overlapping roots, absolute or traversal-shaped manifest paths, malformed skill names, and
  invalid GitHub URLs.
- It resolves the CLI package version once for an install run, validates semver, confirms the
  exact package with `skills --version`, and then reuses that exact `skills@<resolved>` spec.
- Every real install uses structured, `shell:false` arguments equivalent to:

  ```text
  npm exec --yes --package=skills@<resolved> -- skills add <full-source-url> --skill <names...> --global --agent opencode --yes --copy
  ```

- Before real installation, an isolated local fixture probe checks that only
  `~/.agents/skills/<probe>` is created, while a one-skill remote probe checks global lock
  creation and OpenCode isolation. The local fixture is intentionally not expected to create
  lock metadata; the current CLI omits it for local sources.
- Before each real source install it snapshots canonical content and metadata with `lstat`,
  snapshots upstream and the expected lock entries, and stops immediately on an unexpected
  mutation. It never repairs or rolls back a mutation.
- A valid existing declared root with matching lock metadata is skipped. An existing root with
  absent or mismatched metadata fails closed. A missing root may be installed; a stale lock for
  a missing root is accepted only when the CLI add and post-install verification repair it safely.
- Existing upstream extras are reported only. They are never deleted or garbage-collected;
  protected Gentle AI roots remain extras rather than errors.

## Global lock location

The skills CLI global lock is not the repository's `skills-lock.json`. The adapter follows the
CLI's current resolution order:

1. `$XDG_STATE_HOME/skills/.skill-lock.json` when `XDG_STATE_HOME` is set.
2. `~/.agents/.skill-lock.json` otherwise.

The upstream `skills-lock.json` can be source evidence for the curator, but it is not used as
the global install lock for this bootstrap.

## Update boundaries

The upstream CLI exposes `npx skills update -g`, but this adapter intentionally does not call
it: current `skills@1.5.23` cannot preserve the explicit `--agent opencode --copy` semantics
through that update path. The adapter uses only the validated, exact-version `skills add`
argv shown above, and never imports into canonical, changes the manifest, deletes extras, or
invokes curator, registry, or Graphify maintenance automatically.

## Graphify

Graphify is a separate environment tool, not an upstream skill installer. Install it once using
the current proven environment guidance, then verify the executable:

```bash
uv tool install --upgrade graphifyy
graphify --version
```

The repository has tested Graphify `0.9.48`; that is a tested environment reference, not an
equality pin. If the project `.opencode` integration is already tracked, do not reinstall it.
Graph generation remains optional and manual. The bootstrap never extracts, merges, clusters,
or refreshes a graph; see the [Graphify integration boundary](../skills-auditor/references/graphify-integration.md)
for the authority and maintenance rules.

## Troubleshooting

| Symptom | Safe response |
| --- | --- |
| Wrong working directory | Return to `~/.config/opencode/skills`; the adapter refuses other paths. |
| Existing skill has no matching lock | Keep the skill untouched, inspect the source and lock, then reconcile through the supported CLI workflow before retrying. |
| Missing skill | Review the dry-run command. Default mode installs only that missing root after the isolated probes. |
| Extra root or lock record | Review it; the adapter reports it and never deletes it. |
| Probe or post-install verification fails | Stop. Inspect the isolated probe result or current filesystem, and do not manually repair canonical content. |
| Graphify is unavailable | Continue without Graphify; `/skills-auditor nuevas` has a bounded real-file fallback. |

## Validation

Run from the canonical repository:

```bash
node --test scripts/bootstrap-upstream-skills.test.mjs
node --check scripts/bootstrap-upstream-skills.mjs
node --check scripts/bootstrap-upstream-skills.test.mjs
node scripts/bootstrap-upstream-skills.mjs --dry-run
node scripts/bootstrap-upstream-skills.mjs --update --dry-run
node scripts/bootstrap-upstream-skills.mjs --verify
```

The bootstrap tests use temporary homes and fixtures with an injected child-process boundary.
They never install or update against the real home, network, canonical repository, or upstream
skill store.
