# CHANGELOG entry templates

Templates for `docs-guardian` v1.3.

The project convention is based on Keep a Changelog, with optional `Breaking`, `Reverted`, and `Notes` extensions.

Commit SHAs are not required because Docs-Guardian normally runs before the final commit. When receipt-driven review is enabled, CHANGELOG changes produced from these templates must be included before the final exact candidate is frozen and reviewed.

## Persistent Unreleased heading

```markdown
## [Unreleased]
```

Add subsections only when they contain entries.

## NO_BUMP + CHANGELOG

```markdown
## [Unreleased]

### Fixed
- Corrected the empty state shown when a plan has no published price.
```

Mixed example:

```markdown
## [Unreleased]

### Added
- Added an admin filter for active memberships.

### Fixed
- Prevented stale validation errors from remaining after cancelling an edit.
```

## PATCH release

```markdown
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Fixed
- <meaningful user/product outcome>

### Notes
- PATCH release.
```

## MINOR release

```markdown
## [Unreleased]

## [X.Y.0] - YYYY-MM-DD

### Added
- <new capability and its user/product value>

### Changed
- <meaningful change to existing behavior, if applicable>

### Notes
- MINOR release.
```

## MAJOR release

```markdown
## [Unreleased]

## [X.0.0] - YYYY-MM-DD

### Breaking
- <what changed incompatibly and what consumers/operators must do>

### Changed
- <other meaningful behavior changes, if applicable>

### Notes
- MAJOR release.
```

## Pre-release

Use the actual authorized release-train version:

```markdown
## [Unreleased]

## [1.3.0-alpha.4] - YYYY-MM-DD

### Added
- <change included in this pre-release>

### Notes
- Pre-release for the 1.3.0 release train (alpha.4).
```

For stage promotion:

```markdown
## [Unreleased]

## [1.3.0-rc.1] - YYYY-MM-DD

### Changed
- Promoted the 1.3.0 release train to release-candidate status after the latest validated changes.

### Notes
- Pre-release for the 1.3.0 release train (rc.1).
```

Do not invent a new base version merely because the current task is `fix:` or `feat:` while already inside a pre-release train.

## Revert

```markdown
### Reverted
- Reverted <change> after <brief product-facing reason>.
```

## Promotion of Unreleased content

Before:

```markdown
## [Unreleased]

### Fixed
- Corrected the no-price empty state.
- Prevented duplicate form submissions.
```

After an authorized `1.3.1` PATCH release:

```markdown
## [Unreleased]

## [1.3.1] - YYYY-MM-DD

### Fixed
- Corrected the no-price empty state.
- Prevented duplicate form submissions.

### Notes
- PATCH release.
```

Do not leave the same bullets under both headings.

## Section order

Include only sections that apply:

1. `### Added`
2. `### Changed`
3. `### Deprecated`
4. `### Removed`
5. `### Fixed`
6. `### Security`
7. `### Breaking`
8. `### Reverted`
9. `### Notes`

## Style rules

- Describe outcomes, not file edits.
- Keep bullets concise.
- Do not require commit SHAs.
- Use ISO release dates (`YYYY-MM-DD`).
- Section headings are English.
- Bullet language follows recent CHANGELOG precedent.
- Do not create release entries for `NO_BUMP`.
- Do not put trivial/internal changes in `Unreleased`.
- `BUMP` promotes relevant `Unreleased` content into the new versioned entry.
