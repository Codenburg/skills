# CHANGELOG entry templates

Use these templates as the literal shape for new entries. The hybrid format is the project's convention (not strict Keep a Changelog).

## PATCH bump (typical `fix:` cycle)

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Fixed
- 🔴 `<sha>` — `<commit subject>` — `<brief rationale>`
- 🟡 `<sha>` — `<commit subject>` — `<brief rationale>`
- 🟢 N fixes accumulated:
  - `<sha>` — `<commit subject>`
  - `<sha>` — `<commit subject>`
  - `<sha>` — `<commit subject>`

### Notes
- This is a **PATCH** bump per semver. The X criterion was MET by `<sha>` (N fixes accumulated).
```

## MINOR bump (`feat:` cycle)

```markdown
## [X.Y.0] - YYYY-MM-DD

### Added
- **`<feature name>`** — `<one-line summary>`. `<brief rationale>`.

### Changed
- **`<change>`** — `<one-line summary>` (if applicable).

### Notes
- This is a **MINOR** bump per semver (1 new feature, no breaking changes).
```

## MAJOR bump (`BREAKING CHANGE:`)

```markdown
## [X.0.0] - YYYY-MM-DD

### Breaking
- **`<change>`** — `<what breaks>` — `<migration path>`.

### Added / Changed / Fixed
- `<standard entries>`

### Notes
- This is a **MAJOR** bump per semver (breaking change). `<migration guide link if any>`.
```

## Section order (per Keep a Changelog 1.1.0)

For any new entry, use the sections in this order (only include sections that apply):
1. `### Added` — new features
2. `### Changed` — changes in existing functionality
3. `### Deprecated` — soon-to-be removed features
4. `### Removed` — removed features
5. `### Fixed` — bug fixes
6. `### Security` — vulnerability fixes (if applicable)
7. `### Notes` — version metadata, criterion trigger, links

## Style rules

- One bullet per `🔴` or `🟡` fix (detailed).
- Grouped sub-list for `🟢` (concise).
- Each bullet includes the SHA (7 chars) + commit subject + brief rationale.
- Date in ISO format (`YYYY-MM-DD`).
- Section headers in English; bullet text can be Spanish (project convention).
- The "Notes" section should mention the bump type (PATCH/MINOR/MAJOR) and the criterion that triggered it.