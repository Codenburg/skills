---
name: readme-guardian
description: >
  Maintain README as single source of truth with automatic versioning and changelog.
  Trigger: After commits affecting features, config, structure, or when /readme-guardian sync is invoked.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- After any commit that modifies features, configuration, or structure
- When `/readme-guardian sync` is invoked manually
- As part of CI/CD post-commit hooks
- When release workflow is triggered

## Critical Patterns

### Versioning (Semver Strict)

| Change Type | Version Bump |
|-------------|--------------|
| Breaking changes | MAJOR |
| New compatible features | MINOR |
| Bug fixes, docs, refactors without external impact | PATCH |

### README Structure (Enforced)

1. Project name
2. Clear description (1-3 lines)
3. Main features
4. Tech stack
5. Installation
6. Configuration (env)
7. Usage
8. Available scripts
9. Project structure
10. API / endpoints (if applicable)
11. Roadmap / next steps

**Note**: Changelog lives in `openspec/CHANGELOG.md`, NOT in README.

### Changelog Format

```markdown
## [x.y.z] - YYYY-MM-DD
### Added
-
### Changed
-
### Fixed
-
### Removed
-
```

## Behavior

1. **Analyze diff** — Read commit diff, commit message, and changed files
2. **Classify change** — Determine if MAJOR, MINOR, or PATCH
3. **Decide impact** — Check if README sections are affected
4. **Update only affected sections** — Never rewrite entire README unless necessary
5. **Increment version** — Update `package.json` version following semver
6. **Add changelog entry** — Prepend new entry to `openspec/CHANGELOG.md` (NOT README)
7. **Maintain consistency** — Eliminate duplication, keep technical language

## Update Heuristics

| Change Detected | README Section to Update |
|-----------------|--------------------------|
| New file in `/features` | Features |
| Script changes | Scripts |
| New env variable | Configuration |
| Route changes | Usage / API |
| Structural refactor | Project Structure |
| Dependency changes | Tech Stack |
| New feature | Features + Changelog (openspec/CHANGELOG.md) |
| Bug fix | Changelog (openspec/CHANGELOG.md) |

## Policies

- **NEVER** rewrite entire README if only specific sections changed
- **DON'T** invent features — only document what exists
- **DO** maintain technical language, no marketing fluff
- **DO** prioritize clarity over length
- **DO** detect and remove obsolete sections
- **Changelog lives in `openspec/CHANGELOG.md`**, NOT in README

## Commands

```bash
# Manual sync mode
/readme-guardian sync

# Expected output: diff of README, new version, change summary
```

## Inputs (from context)

- Commit diff
- Commit message
- Current README state
- package.json
- config files (env, scripts, build)

## Outputs

- Updated README.md (only affected sections)
- Version incremented in package.json
- Changelog entry prepended to `openspec/CHANGELOG.md`

## Resources

- **Template**: See [assets/changelog-template.md](assets/changelog-template.md)
- **Example**: See [assets/readme-structure-example.md](assets/readme-structure-example.md)
