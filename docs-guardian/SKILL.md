---
name: docs-guardian
description: "Trigger: fix: or feat: commit lands, SDD cycle closes, or /docs-guardian sync. Maintain ROADMAP (pending only) + CHANGELOG + package.json + README with semantic versioning."
license: MIT
metadata:
  author: Codenburg
  version: "1.1"
  supersedes: readme-guardian
---

## Activation Contract

Use this skill when: `fix:` / `feat:` commit lands, `BREAKING CHANGE:` in body, SDD cycle closes (sdd-archive), or user invokes `/docs-guardian sync` explicitly.

## Hard Rules

1. **ROADMAP is pending only** — never add `[x]` markers. §Pendiente removals need user confirmation.
2. **Severity needs user confirmation** — never auto-classify 🔴/🟡/🟢. Default 🟢 Baja if unsure.
3. **Force-bumps need user opt-in + audit note** in CHANGELOG.
4. **Patch bump table clears per cycle** — entries move to CHANGELOG on bump, table restarts empty.
5. **One bump per sync cycle**. Multi-fix decomposes into N entries. Reverts document as 🔄. Pre-release via `--pre-release <alpha|beta|rc>` (resets to `.pre.1`, no counter). Optional `--verify-tests` runs `pnpm test` (pnpm-only).
6. **§Pendiente matching respects tier** — 🔴 matches Alta/Media, 🟡 any, 🟢 only Baja.
7. **CHANGELOG language is heuristic** — auto-detected from last 5 entries (majority `es` vs `en`, default `es`). User can edit post-sync.
8. **CHANGELOG validation** — pre-sync checks whole file per Keep a Changelog 1.1.0. Post-sync checks new entry format. ASK if either fails.
9. **Out of scope for v1.x**: race conditions between parallel cycles, monorepo, auto-detect of completed §Pendiente without keyword match, multi-package-manager test commands, pre-release counter, language override flag.

## Decision Gates

| Condition | Action |
|---|---|
| `feat:` / `BREAKING CHANGE:` | ASK: MINOR puro or MAJOR? If MINOR/MAJOR, ASK: pre-release? |
| `fix:`, criteria not MET | Add to table; ASK: force-bump with audit, or wait? |
| `fix:`, criteria MET | PATCH bump (4-file sync) |
| `fix:` with multi-`fix:` body | ASK: count + per-line severity |
| `revert: ...` | ASK: 🔄 in CHANGELOG? (no patch bump table) |
| Match to §Pendiente item (tier-filtered) | ASK before removing |
| `docs:`, `chore:`, `refactor:`, `test:`, `style:`, `perf:` | No sync |
| `--verify-tests` + tests fail | ASK: continue anyway or abort? |

## Execution Steps

### 1. Read state

`package.json` version, latest `git log -1` + `--stat`, top of `openspec/CHANGELOG.md`, header + `## 🐛 Pending fixes` table + `## ⏳ Pendiente` items (Alta/Media/Baja) + `_Version:_` line from `openspec/ROADMAP.md`, version badge from `README.md`.

**Pre-sync validation**: parse `openspec/CHANGELOG.md` for Keep a Changelog 1.1.0 format. If malformed, ASK.

### 2. Detect & classify

- `revert: ...` → ASK: 🔄 in CHANGELOG? (Step 5D, no bump)
- `fix:` → scan body for additional `fix:` lines. If 1 → ASK severity. If N → ASK count + per-line.
- `feat:` → ASK: MINOR puro or includes `BREAKING CHANGE:`? If MINOR, ASK: pre-release?
- `BREAKING CHANGE:` → MAJOR (ASK: pre-release?)

### 3. §Pendiente matching

Match subject + body against `- [ ] ...` lines, tier-filtered per Rule 6. Jaccard + keyword count. ASK before removing. See `references/conventions.md`.

### 4. Patch bump table (fix: only)

Add entries. Count accumulated: 🔴≥1 OR 🟡≥2 OR 🟢≥3 → PATCH bump. Otherwise ASK: force-bump with audit, or wait?

### 5. 4-file sync (PATCH/MINOR/MAJOR)

**Pre-sync** (if `--verify-tests`): `pnpm test` (hardcoded — project is pnpm-only). If fail, ASK.

**A. `package.json`** — bump per semver. Pre-release: edit manually (`X.Y.Z-alpha.N`).

**B. `README.md`** — update version badge.

**C. `openspec/CHANGELOG.md`** — prepend new entry (hybrid: 🔴/🟡 detailed, 🟢 grouped, 🔄 for reverts, force-bump audit). See `assets/changelog-template.md`. Pre-release: `X.Y.Z-pre.1` (always reset).

**Post-sync validation**: parse the new entry for format (heading, version `X.Y.Z[-pre.N]`, date, sections). If malformed, ASK.

**D. `openspec/ROADMAP.md`**:
1. Update header `_Version: X.Y.Z_` (or `X.Y.Z-pre.N`).
2. Add entry to §Completado.
3. Clear patch bump table → placeholder row.
4. Update "Criterio de bump" version reference.
5. Update "Estado actual" to "Tabla vacía. Esperando el primer `fix:` del próximo ciclo."

### 6. Verify

All 4 files updated. No `[x]` added. ROADMAP table empty. Criteria version updated.

## Output Contract

```
docs-guardian — sync completado
Versión: 1.0.2 → 1.0.3 (PATCH)
Trigger: 🔴 1 hotfix (criterio MET) [or: forzado]
Multi-fix: N parsed [or: 1] | Reverts: 0 [or: M 🔄] | Pre-release: no [or: alpha.1]
§Pendiente: 1 removido / 0 matcheados | Test verification: skipped [or: passed | failed]
Archivos: package.json, openspec/CHANGELOG.md, openspec/ROADMAP.md, README.md
```

## References

- `assets/changelog-template.md` — hybrid 🔴/🟡/🟢/🔄 entry format
- `references/conventions.md` — severity, bump criteria, tier-filtered §Pendiente matching, multi-fix parsing, revert detection, pre-release, force-bump audit, ASK prompts

## Supersedes

`readme-guardian` (deprecated 2026-06-21). v1.0: reads patch bump table, removes items instead of `[x]`, clears table per cycle, explicit severity, matches §Pendiente, asks before non-trivial decisions. v1.1: multi-fix, reverts, pre-release, optional tests, tier filtering, force-bump audit. v1.2: heuristic language, pre+post CHANGELOG validation, hardcoded pnpm, pre-release reset.
