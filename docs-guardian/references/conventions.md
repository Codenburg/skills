# Conventions

Detailed reference for `docs-guardian` skill v1.1.

## Severity classification (🔴/🟡/🟢)

For `fix:` commits, classify by impact. **The skill MUST ask the user** before assigning any severity.

- 🔴 **Hotfix** — bug crítico de producción. One of:
  - Data loss in production
  - Security vulnerability
  - Crash that affects user-facing functionality
  - Funcionalidad core caída (a major feature is broken in production — e.g., the admin can't create records at all)

- 🟡 **Media** — bug que afecta funcionalidad pero no es crítico. One of:
  - Validation logic error (form accepts invalid input, server rejects valid input)
  - Lifecycle issue (component state lost on re-mount, race condition)
  - UI partially broken (a section of the page doesn't render correctly)
  - Product logic mistake (formula is wrong, e.g., monthly vs total)

- 🟢 **Baja** — polish, no functional impact. One of:
  - UX polish (button position, color tweak, hover state)
  - Copy fix (typo, Spanish translation)
  - Accessibility improvement (alt text, aria-label)
  - Minor refactor (rename, extract helper)

Default if ambiguous or user says "vos decidí": 🟢 Baja (conservative — least aggressive bump).

## Bump criteria (the patch bump table)

The ROADMAP patch bump table accumulates `fix:` commits. When criteria is MET, a PATCH bump fires and the table clears (entries move to CHANGELOG).

OR logic (any of them):

- 🔴 **1 hotfix** triggers PATCH bump
- 🟡 **2 media** trigger PATCH bump
- 🟢 **3 baja** trigger PATCH bump

The table clears after every bump — it is per-version-cycle, not cumulative.

## §Pendiente keyword matching algorithm (tier-filtered)

1. Read all `- [ ] ...` lines from §Pendiente in `openspec/ROADMAP.md`, organized by subsection:
   - `### Alta Prioridad` — items the project considers critical
   - `### Media Prioridad` — items that matter but aren't critical
   - `### Baja Prioridad` — polish items
2. Extract keywords from the commit subject + body:
   - Split by `:`, `(`, `)`, `-`, `_`, `[`, `]`, `,`
   - Lowercase
   - Remove Spanish/English stopwords (el, la, the, a, an, in, on, de, del, con, para, por, etc.)
   - Remove very short words (≤2 chars)
   - Result: a set of significant words
3. For each §Pendiente item, apply the same keyword extraction.
4. **Tier filter** based on fix severity:
   - 🔴 fix → only match against `### Alta Prioridad` + `### Media Prioridad` items
   - 🟡 fix → match against any tier
   - 🟢 fix → only match against `### Baja Prioridad` items
5. Compute overlap for tier-eligible items:
   - `overlap = |commit_keywords ∩ item_keywords| / |commit_keywords ∪ item_keywords|` (Jaccard)
   - OR: `|commit_keywords ∩ item_keywords| ≥ 2` (count of shared significant words)
6. If `overlap > 0.3` OR `count ≥ 2` → candidate.
7. List candidates (max 5) and ASK the user which (if any) to remove.

The user can always say "ninguno" to skip the removal. The skill does NOT auto-remove.

## Multi-fix commit detection

A single commit can bundle multiple unrelated fixes. Detection algorithm:

1. Parse the commit body (separated from subject by blank line).
2. Look for additional `fix: ...` lines in the body (not the subject).
3. If found, ASK the user:

   ```text
   El commit 'fix(admin): bundle cleanup' incluye N fixes en el body:
     1. fix(forms): add error boundary
     2. fix(cache): verify revalidateTag coverage
     3. fix(tests): isolate test DB cleanup
   ¿Cuántos fixes querés agregar al patch bump table? (1, 2, 3, o N)
   Si N > 1, asigná la severidad de cada uno.
   ```

4. The skill treats each confirmed fix as a separate entry in the patch bump table. Each contributes independently to the bump criteria.
5. The CHANGELOG entry groups all fixes from the same commit under a single version (e.g., "3 fixes accumulated for this release from a single commit").

## Revert detection

If the commit subject starts with `revert:`, the skill treats it specially:

- The commit does NOT enter the patch bump table.
- The CHANGELOG entry includes the reverted commit as a 🔄 line:
  ```markdown
  ### Reverted
  - 🔄 `revert: fix(admin): typo in label` (reverts `36cba3d`) — the original fix was correct, reverting because it caused a regression.
  ```
- The reverted commit's SHA is included for traceability.

ASK prompt:
```text
El commit 'revert: fix(admin): typo in label' es un revert.
¿Documento como 🔄 en CHANGELOG (sin entrar al patch bump table) o querés que entre como fix normal?
```

## Pre-release semantics

When `--pre-release <alpha|beta|rc>` is provided:

- PATCH bump → `1.0.2` → `1.0.2-alpha.1` (or `-beta.1`, `-rc.1`)
- MINOR bump → `1.0.0` → `1.0.0-beta.1`
- MAJOR bump → `2.0.0-alpha.1`

**Subsequent pre-release bumps always reset to `.pre.1` of the same type** (e.g., `1.0.2-alpha.3` → `1.0.2-beta.1`, NOT `1.0.2-beta.4`). This is the chosen convention for simplicity — counter tracking is delegated to git tags. v2.x may add counter tracking if the project needs it.

The "Criterio de bump" version reference in ROADMAP still uses the stable form (e.g., `1.0.2 → 1.0.3`).

## Force-bump audit trail

When the user opts to force-bump despite criteria not MET, the CHANGELOG entry's `### Notes` section includes:

```markdown
### Notes
- This is a **PATCH** bump per semver. **Bump forzado por user override** — criteria 🟡 no cumplido (1 🟡 acumulado, threshold 2). El fix se incluye igual porque el usuario confirmó.
```

This makes the force-bump visible to future readers and the git history of the CHANGELOG.

## CHANGELOG entry format (hybrid 🔴/🟡/🟢/🔄)

Per the project's convention (not strict Keep a Changelog), the entry is detailed for high-severity fixes and grouped for low-severity:

```markdown
## [1.0.3] - 2026-06-21

### Fixed
- 🔴 `76e160f` — `fix(admin): disable save on empty name, prevent double toast on re-mount` — 2 bugs reales (validación + lifecycle)
- 🟡 `412e3a7` — `fix(descuentos): compute Precio final as total upfront cost` — lógica de producto (formula now `base × (1 - pct/100) × meses`, not just monthly)
- 🟢 3 fixes accumulated:
  - `75ec9d1` — `fix(admin): replace floating mobile hamburger with proper fixed header bar`
  - `0628d56` — `chore(lint): remove unused imports and dead code in admin-layout.tsx`
  - `36cba3d` — `fix(admin): minor copy fix in descuento list`

### Reverted
- 🔄 `revert: fix(admin): typo in label` (reverts `36cba3d`) — the original fix caused a regression in dark mode contrast.

### Notes
- This is a **PATCH** bump per semver. The 🔴 criterion was MET by `76e160f` (1 hotfix).
```

`feat:` triggers MINOR — entry has `### Added` section:

```markdown
## [1.1.0-alpha.1] - 2026-07-15

### Added
- **`formatPriceARS` helper** — single source of truth for ARS currency formatting. Used by PlansSection, PriceSection, promocion-form, promocion-card, GymPriceEditor.

### Notes
- This is a **MINOR** bump per semver (1 new feature, no breaking changes). **Pre-release** (alpha.1).
```

`BREAKING CHANGE:` triggers MAJOR — entry has `### Breaking` section.

## "Criterio de bump" version reference

The line in `openspec/ROADMAP.md`:

```
**Criterio de bump** (cualquiera de los 3 gatilla patch bump `1.0.2` → `1.0.3`):
```

Should always reflect the NEXT stable bump, not the current. Update on every sync. Format: `<current_version> → <next_version>`. For pre-release, use the stable form: `1.0.2 → 1.0.3` (not `1.0.2-alpha.1 → 1.0.2-alpha.2`).

## Severity classification ASK prompt

```text
Clasificá este fix:
  Subject: fix(admin): disable save on empty name, prevent double toast on re-mount
  Files: src/components/admin/admin-form.tsx (+12 -3), src/hooks/use-toast.ts (+5 -2)

  A) 🔴 Hotfix (data loss, security, crash, funcionalidad core caída)
  B) 🟡 Media (validación, lifecycle, race condition, UI parcialmente rota, lógica de producto)
  C) 🟢 Baja (polish UX, copy, accesibilidad, refactor menor)
```

Default = C (🟢 Baja, conservative). The skill does NOT auto-classify.

## §Pendiente matching ASK prompt

```text
El commit 'fix(admin): typo in 1 mes label' (severidad 🟡 Baja) parece matchear estos items de §Pendiente:
  A) - [ ] Generación de PDF por rutina (@react-pdf/renderer)  [Media]
  B) - [ ] Migrar MESES_OPTIONS a UI dropdown (post-1.0)  [Media]
¿Cuál completa? (elegí letra, o "ninguno" si no matchea)
```

For 🔴 fixes, the list is filtered to Alta + Media items only.
For 🟢 fixes, the list is filtered to Baja items only.
For 🟡 fixes, the list includes all tiers.

Default = "ninguno" (skip). The skill does NOT auto-remove.

## Force-bump ASK prompt

```text
Acumulados: 1 🟡, criterio necesita 2.
¿Bumpear igual o esperar al próximo fix?
  A) Esperar (recomendado) — solo agrego a la tabla
  B) Bumpear igual — PATCH bump con 1 🟡 acumulado (agrega nota de audit trail al CHANGELOG)
```

Default = A (wait). The skill does NOT force-bump.

## Multi-fix ASK prompt

```text
El commit 'fix(admin): bundle cleanup' tiene 3 'fix:' lines en el body:
  1. fix(forms): add error boundary
  2. fix(cache): verify revalidateTag coverage
  3. fix(tests): isolate test DB cleanup
¿Cuántos fixes querés agregar al patch bump table? (1, 2, o 3)
Para cada uno, asigná la severidad.
```

## Revert ASK prompt

```text
El commit 'revert: fix(admin): typo in label' es un revert (revierte `36cba3d`).
¿Documento como 🔄 en CHANGELOG (sin entrar al patch bump table) o querés que entre como fix normal?
  A) Revert documentado (recomendado) — 🔄 en CHANGELOG, no entra al patch bump table
  B) Fix normal — entra al patch bump table como un fix más
```

## Test verification ASK prompt (only with `--verify-tests`)

```text
Tests fallaron:
  FAIL src/components/admin/admin-form.test.tsx
  ...
¿Continuar con el sync igual o abortar?
  A) Continuar (recomendado solo si los tests fallidos no están relacionados al fix)
  B) Abortar — el fix probablemente rompió algo
```

Default = A (continue). The user is responsible for assessing whether the test failures are related to the fix.

The test command is hardcoded to `pnpm test` (project is pnpm-only per AGENTS.md). No flag for override — if the project switches package managers, this should be updated.

## CHANGELOG validation rules

### Pre-sync validation

Parse the whole `openspec/CHANGELOG.md` to verify it conforms to Keep a Changelog 1.1.0:

1. Top entry must be `## [X.Y.Z] - YYYY-MM-DD` (or `X.Y.Z-pre.N` for pre-releases).
2. Each entry's version must be a valid semver.
3. Each entry's date must be ISO format `YYYY-MM-DD`.
4. Section headers must be one of: `### Added`, `### Changed`, `### Deprecated`, `### Removed`, `### Fixed`, `### Security`, `### Reverted`, `### Notes`.

If any of these fail, ASK the user to fix the malformed entry before proceeding. The skill does NOT auto-fix malformed CHANGELOG entries.

### Post-sync validation

After prepending the new entry, parse it and verify:

1. Heading matches the expected format for the bump type (PATCH → `## [X.Y.Z] - YYYY-MM-DD`, etc.).
2. Version in the heading matches the `package.json` version after the bump.
3. Date is today's date in `YYYY-MM-DD`.
4. At least one section header is present (typically `### Fixed` for PATCH, `### Added` for MINOR, `### Breaking` for MAJOR).
5. If force-bump, the `### Notes` section includes the audit-trail note.

If any of these fail, ASK the user to review the entry before committing.

## Language heuristic ASK prompt (rare)

The language heuristic is normally silent. ASK only if the user explicitly requests the detected language or wants to override it:

```text
El CHANGELOG tiene un mix de español e inglés. Heurística detectó: español (3/5 entries).
¿Usar español para la nueva entry, o querés override?
  A) Usar detectado (recomendado) — español
  B) Override a inglés
```

(Not asked by default — only if the user requests verification.)

## Language convention (heuristic detection)

The project's CHANGELOG mixes Spanish and English (per existing entries). The skill detects the dominant language from the existing entries:

1. Read the last 5 entries from `openspec/CHANGELOG.md`.
2. For each entry's `### Fixed` / `### Added` / etc. bullets, count Spanish vs English:
   - **Spanish signals**: articles (`el`, `la`, `los`, `las`), prepositions (`de`, `del`, `con`, `para`, `por`), common verbs (`es`, `fue`, `ser`, `tener`), accented characters (`á`, `é`, `í`, `ó`, `ú`, `ñ`).
   - **English signals**: articles (`the`, `a`, `an`), prepositions (`in`, `on`, `at`, `with`, `for`), common verbs (`is`, `was`, `adds`, `fixes`).
3. Tally: majority wins.
4. On tie, default to Spanish.
5. Apply the detected language to the new entry.

No ASK prompt for language. The user can edit the entry's text post-sync if the heuristic is wrong. This is documented as a known limitation.

The "### Notes" section is always in English (project convention for technical metadata, independent of the detected language).
