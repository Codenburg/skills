---
name: docs-guardian
description: "Resolve release/versioning and documentation for completed Gymflow work before the final exact-candidate review and final commit. Recommends BUMP, NO_BUMP, or BYPASS; maintains package version, CHANGELOG, README, and pending-only ROADMAP."
license: MIT
metadata:
  author: Codenburg
  version: "1.3"
  supersedes: readme-guardian
---

# Docs Guardian

Keep Gymflow release documentation aligned with completed work without turning documentation into a second task after the commit.

## Activation Contract

Run this skill when implementation is complete, ordinary verification is complete, and the intended conventional commit is known, **before any final receipt-driven/immutable review target is frozen and before the final commit is created**, when any of these apply:

- intended commit starts with `fix:` or `feat:`;
- intended commit body contains `BREAKING CHANGE:`;
- intended commit starts with `revert:`;
- an SDD cycle is about to archive;
- the user explicitly invokes `/docs-guardian sync`.

Post-commit execution is recovery-only: use it only when a qualifying commit already landed without a Docs-Guardian resolution.

When receipt-driven review is enabled, Docs-Guardian must resolve before the final exact candidate is staged/frozen. Any version, README, CHANGELOG, or ROADMAP changes produced here must be included in that final reviewed candidate. Earlier exploratory or implementation review may happen first, but it does not satisfy a gate that requires an owner-issued receipt for the final bytes.

Do not trigger automatically for `docs:`, `chore:`, `refactor:`, `test:`, `style:`, or `perf:` unless the user explicitly invokes the skill or the change materially affects release documentation.

## Core Principle

**Versioning is judgment-based, not threshold-based. Docs-Guardian recommends; the user decides.**

There is no patch bump table, severity quota, accumulated-fix threshold, or automatic release.

## Resolution Actions

Every qualifying task resolves to exactly one action:

### 1. `BUMP`

Use when the change should produce a release/version transition.

- Stable `fix:` normally recommends PATCH.
- Stable `feat:` normally recommends MINOR.
- `BREAKING CHANGE:` normally recommends MAJOR.
- A current pre-release stays on its existing release train unless the user explicitly starts a new train.
- `BUMP` always creates/promotes a versioned CHANGELOG entry.
- Update `package.json`, README version text/badge, CHANGELOG, and ROADMAP version metadata if present.

### 2. `NO_BUMP`

Keep the current package version.

Docs-Guardian recommends one of:

- `NO_BUMP + CHANGELOG` — noteworthy to users/product/history; add it under `## [Unreleased]`.
- `NO_BUMP + SKIP_CHANGELOG` — trivial/internal; do not add it to CHANGELOG.

A confirmed completed ROADMAP pending item may still be removed under either `NO_BUMP` variant.

### 3. `BYPASS`

Skip Docs-Guardian changes for this task.

- Requires explicit user authorization.
- Do not modify package version, CHANGELOG, README, or ROADMAP.
- Do not reinterpret BYPASS as NO_BUMP.
- Downstream workflow may continue once the bypass is recorded in the current task context.

## Hard Rules

1. **Run before the final exact-candidate review and final commit.** Documentation produced by this skill belongs in the same task/commit as the implementation whenever possible and must be present before any receipt that gates commit/push is issued.
2. **Never auto-release.** Recommend an action and let the user authorize it unless the user already supplied the decision.
3. **Ask only for missing decisions.** Never repeat a question already answered in the task context.
4. **Ask at most one question at a time.** Stop after asking.
5. **No patch bump table or severity thresholds.**
6. **ROADMAP is pending-only.** Never add `[x]` markers or completed-history entries. Remove a matched pending item only after user confirmation.
7. **No commit SHA requirement.** Pre-commit documentation must not require a SHA that does not exist yet.
8. **CHANGELOG is selective, not a git log.** Trivial/internal work may skip it.
9. **BUMP always includes release notes.** Existing relevant `Unreleased` content is promoted into the new version entry.
10. **Pre-release train is sticky.** `X.Y.Z-alpha.N`, `beta.N`, or `rc.N` targets stable `X.Y.Z` until the user explicitly starts another base version.
11. Optional `--verify-tests` runs `pnpm test`. If it fails, ask whether to continue or abort.
12. Validate CHANGELOG against the Gymflow convention defined in `references/conventions.md`, which is based on Keep a Changelog and includes project extensions.

## Minimal Decision Flow

### A. Read state

Read only what is needed:

- intended commit subject/body;
- `git status --short`;
- staged diff if present, otherwise relevant working-tree diff;
- `package.json` version;
- top/recent entries of `openspec/CHANGELOG.md`;
- pending items and optional `_Version:_` metadata from `openspec/ROADMAP.md`;
- README version text/badge if present.

Do not scan unrelated project files unless needed to understand the change.

### B. Assess impact

Infer the likely release impact from the actual change and intended commit:

- `fix:` → usually PATCH-worthy if behavior, correctness, security, data integrity, or user-visible functionality materially changed.
- `feat:` → usually MINOR-worthy on a stable version.
- `BREAKING CHANGE:` → usually MAJOR-worthy on a stable version.
- `revert:` → evaluate the effect organically; it may be BUMP, Unreleased-only, or trivial.

For small fixes, distinguish:

- **release-worthy** → recommend `BUMP`;
- **noteworthy but not release-worthy** → recommend `NO_BUMP + CHANGELOG`;
- **trivial/internal** → recommend `NO_BUMP + SKIP_CHANGELOG`.

Give the recommendation in one short sentence.

### C. Ask for authorization

If the user has not already decided, ask one question only.

Example:

```text
Recomendación: NO_BUMP + CHANGELOG — corrige una conducta visible, pero no justifica publicar una versión nueva.
¿Lo dejamos así?
```

If the user chooses `BUMP` and a version/pre-release transition is still unresolved, ask that as the next single question.

### D. Resolve pre-release transition

Follow `references/conventions.md`.

Key behavior:

- `1.2.0-alpha.3` + continue alpha → `1.2.0-alpha.4`
- `1.2.0-alpha.3` + promote to beta → `1.2.0-beta.1`
- `1.2.0-alpha.3` + promote to rc → `1.2.0-rc.1`
- `1.2.0-rc.2` + stable → `1.2.0`
- A `fix:` while on `1.2.0-beta.2` does **not** automatically become `1.2.1-*`.
- A `feat:` while on `1.2.0-alpha.3` does **not** automatically become `1.3.0-*`.
- Start a new base version only when the user explicitly chooses a new release train.

### E. Apply documentation

#### `BUMP`

1. `package.json`
   - Apply the authorized stable or pre-release transition.

2. `README.md`
   - Update existing version text/badge if the project has one.
   - Do not invent a new badge solely for Docs-Guardian.

3. `openspec/CHANGELOG.md`
   - Promote relevant `## [Unreleased]` content into the new release entry.
   - Include the current release-worthy change.
   - Keep an empty `## [Unreleased]` heading at the top for future noteworthy no-bump work.
   - Use templates from `assets/changelog-template.md`.

4. `openspec/ROADMAP.md`
   - If `_Version:_` metadata exists, update it to the new package version.
   - Remove a completed pending item only after user confirmation.
   - Never add §Completado history, patch tables, bump criteria, or `[x]` markers.

#### `NO_BUMP + CHANGELOG`

1. Keep `package.json` unchanged.
2. Keep README version unchanged.
3. Add the noteworthy change under the appropriate section of `## [Unreleased]`.
4. Remove a confirmed completed ROADMAP pending item if applicable.
5. Do not create a fake versioned release entry.

#### `NO_BUMP + SKIP_CHANGELOG`

1. Keep package version, README, and CHANGELOG unchanged.
2. Remove a confirmed completed ROADMAP pending item if applicable.
3. Make no other release-documentation changes.

#### `BYPASS`

Make no changes.

### F. Verify

Check only the files touched by the selected action:

- package and README versions agree when a bump occurred;
- CHANGELOG version agrees with package version for a release;
- `## [Unreleased]` remains available for future no-bump notes;
- no SHA placeholder exists;
- ROADMAP contains pending work only;
- no patch bump table/threshold bookkeeping was introduced;
- no user decision was silently overridden.

## CHANGELOG Language

Match the established language of recent CHANGELOG entries.

- Prefer the language of the most recent comparable entry.
- If recent entries clearly have a majority language, use it.
- On a true tie, keep the language of the most recent entry.
- If the CHANGELOG has no meaningful precedent, default to English.
- Section headings remain in English.

Do not ask about language unless the user explicitly requests an override.

## Output Contract

Keep the final output short:

```text
docs-guardian — resolved
Action: BUMP | NO_BUMP + CHANGELOG | NO_BUMP + SKIP_CHANGELOG | BYPASS
Recommendation: <one sentence>
Version: <old> → <new> | unchanged
CHANGELOG: release <version> | Unreleased | skipped
ROADMAP: <item removed> | unchanged
Files: <changed files or none>
Ready for final review/commit: yes
```

For recovery after an already-landed commit, replace the last line with:

```text
Recovery sync: completed; documentation still needs to be committed.
```

Do not automatically amend, reset, rebase, or rewrite git history.

## References

- `references/conventions.md` — organic release decisions, pre-release trains, Unreleased behavior, ROADMAP matching, validation, prompts.
- `assets/changelog-template.md` — versioned and Unreleased CHANGELOG templates.

## Supersedes

`readme-guardian` (deprecated 2026-06-21).

- v1.0–v1.2 used severity thresholds, a patch bump table, post-commit sync, SHA-oriented release notes, and pre-release reset behavior.
- v1.3 replaces that model with pre-commit resolution, user-authorized organic versioning, `BUMP` / `NO_BUMP` / `BYPASS`, selective `Unreleased` notes, and release-train-aware pre-release semantics.
