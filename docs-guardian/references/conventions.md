# Conventions

Detailed reference for `docs-guardian` skill v1.3.

## Organic release judgment

Docs-Guardian does not count fixes and does not use severity quotas.

| Outcome | Use when |
|---|---|
| `BUMP` | The change justifies publishing or advancing a release. |
| `NO_BUMP + CHANGELOG` | Worth preserving in release notes, but not worth changing the version now. |
| `NO_BUMP + SKIP_CHANGELOG` | Trivial/internal and would only add CHANGELOG noise. |
| `BYPASS` | The user explicitly decides Docs-Guardian is unnecessary for this task. |

The user has final authority.

Recommend `BUMP` for materially important security, tenant isolation, data integrity, core/user-visible fixes, meaningful new capabilities, or intentional breaking contracts.

Recommend `NO_BUMP + CHANGELOG` for visible/noteworthy work that belongs in future release notes but does not justify publishing a release now.

Recommend `NO_BUMP + SKIP_CHANGELOG` for tiny copy/spacing/polish, internal refactors, test/tooling-only adjustments, and other changes that do not help a future reader understand a release.

These are recommendations, not automatic gates.

## Commit timing

Preferred sequence:

```text
implementation
→ verification/review
→ intended conventional commit known
→ docs-guardian resolution
→ docs changes
→ one final commit containing task + docs
→ archive/next task
```

Post-commit sync exists only as recovery.

Docs-Guardian must not require the future commit SHA.

## Stable version transitions

When current version is stable and the user chooses `BUMP`:

- `fix:` normally recommends PATCH: `1.2.0` → `1.2.1`
- `feat:` normally recommends MINOR: `1.2.0` → `1.3.0`
- `BREAKING CHANGE:` normally recommends MAJOR: `1.2.0` → `2.0.0`

The user may choose a different outcome when project intent justifies it.

### Starting a pre-release from stable

Compute the target stable base first, then append the selected stage at `.1`:

- PATCH train: `1.2.0` → `1.2.1-alpha.1`
- MINOR train: `1.2.0` → `1.3.0-beta.1`
- MAJOR train: `1.2.0` → `2.0.0-rc.1`

## Pre-release trains

`1.3.0-alpha.4` means the active release train targets stable `1.3.0`.

The base is sticky until the user explicitly starts another release train.

### Same stage

Increment the counter:

```text
1.3.0-alpha.4 → 1.3.0-alpha.5
1.3.0-beta.2  → 1.3.0-beta.3
1.3.0-rc.1    → 1.3.0-rc.2
```

### Promote stage

Promotion order:

```text
alpha → beta → rc → stable
```

Moving to a later pre-release stage resets that stage to `.1`:

```text
1.3.0-alpha.4 → 1.3.0-beta.1
1.3.0-beta.3  → 1.3.0-rc.1
```

Promoting to stable removes the suffix:

```text
1.3.0-rc.2 → 1.3.0
```

### Do not infer a new base from commit type inside a train

Wrong unless explicitly authorized:

```text
1.2.0-alpha.3 + feat: → 1.3.0-*
1.2.0-beta.2  + fix:  → 1.2.1-*
```

Normal behavior keeps the train:

```text
1.2.0-alpha.3 + continue alpha → 1.2.0-alpha.4
1.2.0-alpha.3 + rc             → 1.2.0-rc.1
1.2.0-beta.2  + continue beta  → 1.2.0-beta.3
```

The commit type informs the recommendation; it does not silently rewrite the active base version.

### Starting a new train from a pre-release

Only after explicit user authorization.

```text
current: 1.2.0-alpha.3
explicit new MINOR train + alpha
result: 1.3.0-alpha.1
```

### Stage regression

Do not silently move backward (`rc` → `beta`, `beta` → `alpha`).

If explicitly requested, allow it as an override and reset the selected stage to `.1`.

## Unreleased semantics

Use:

```markdown
## [Unreleased]
```

for noteworthy changes that do not bump the package version yet.

### NO_BUMP + CHANGELOG

Add the change under the appropriate section:

- `### Added`
- `### Changed`
- `### Deprecated`
- `### Removed`
- `### Fixed`
- `### Security`
- `### Reverted`
- `### Notes`

Do not add empty subsections.

### On BUMP

Promote relevant `Unreleased` bullets into the new versioned entry, add the current release-worthy change, and leave `## [Unreleased]` available at the top.

Do not duplicate bullets between `Unreleased` and the released version.

### Selectivity

`Unreleased` is not a queue of every commit. Skip trivial/internal work that would not help a future reader understand the release.

## CHANGELOG content

Commit SHA is optional and normally omitted because Docs-Guardian runs before the final commit.

Prefer product-oriented bullets:

```markdown
### Fixed
- Prevented cross-tenant member lookups from returning records outside the active organization.
```

Avoid implementation diary language.

## Reverts

Evaluate reverts organically. If noteworthy, use:

```markdown
### Reverted
- Reverted the pricing-card interaction change after it caused a mobile regression.
```

A revert can resolve to any action; it does not force a special version path.

## Multi-fix work

Do not decompose multi-fix work into counters.

Treat the completed task/diff as one release decision. Use multiple CHANGELOG bullets only when several outcomes are independently meaningful.

## ROADMAP behavior

ROADMAP is pending-only.

Allowed:
- inspect pending items for likely completed matches;
- present at most three plausible candidates;
- remove only after user confirmation;
- update existing `_Version:_` metadata on `BUMP`.

Forbidden:
- `[x]` markers;
- §Completado/history entries;
- patch bump tables;
- severity counters;
- bump criteria bookkeeping.

Use lightweight semantic/keyword matching across all pending tiers. Do not severity-filter.

Only ask about removal when there is a plausible match.

## Asking rules

Ask only for information that is still missing and ask at most one question at a time.

Examples:

```text
Recomendación: BUMP PATCH — corrige aislamiento entre tenants y merece una release.
¿Hacemos el bump?
```

```text
Recomendación: NO_BUMP + CHANGELOG — es visible y conviene conservarlo para la próxima release, pero no justifica publicar una versión nueva.
¿Lo dejamos así?
```

```text
Recomendación: NO_BUMP + SKIP_CHANGELOG — es un ajuste menor sin valor real para las release notes.
¿Lo dejamos sin bump ni CHANGELOG?
```

```text
Docs-Guardian aplicaría normalmente a esta tarea.
¿Querés autorizar BYPASS y continuar sin cambios documentales?
```

If `BUMP` is authorized but the pre-release transition is unresolved:

```text
Estamos en 1.2.0-alpha.3 y el release train sigue apuntando a 1.2.0.
¿Continuamos alpha, promovemos a beta/rc o publicamos 1.2.0 estable?
```

## Optional test verification

Only with `--verify-tests`:

```bash
pnpm test
```

If it fails, ask whether to abort. Do not run broader validation solely from this skill.

## CHANGELOG validation

Validate the **Gymflow convention based on Keep a Changelog**, not strict upstream Keep a Changelog.

Accepted top-level entries:

```markdown
## [Unreleased]
## [X.Y.Z] - YYYY-MM-DD
## [X.Y.Z-alpha.N] - YYYY-MM-DD
## [X.Y.Z-beta.N] - YYYY-MM-DD
## [X.Y.Z-rc.N] - YYYY-MM-DD
```

Accepted subsection headers:

- `### Added`
- `### Changed`
- `### Deprecated`
- `### Removed`
- `### Fixed`
- `### Security`
- `### Breaking`
- `### Reverted`
- `### Notes`

Check:
1. versioned headings contain valid SemVer;
2. release dates are ISO `YYYY-MM-DD`;
3. a BUMP release matches `package.json`;
4. `Unreleased` has no date/version number;
5. no identical bullet remains in both `Unreleased` and the new release;
6. no unresolved placeholder remains;
7. headers use the accepted set.

If unrelated historical content is malformed, report it rather than rewriting history unless asked.

## Language convention

Follow recent CHANGELOG precedent.

1. Prefer the most recent comparable entry.
2. Otherwise use the clear majority of recent entries.
3. On tie, use the language of the most recent entry.
4. With no precedent, default to English.
5. Section headings remain English.

Do not ask about language unless the user requests an override.
