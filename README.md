<div align="center">

# Canonical Agent Skills

**30 named root-level skill contracts in the current worktree**

OpenCode-compatible Markdown skill contracts · On-demand loading · Optional dependency-free Node.js maintenance tooling

[Understand](#what-this-repository-is) · [Use](#quick-start) · [Maintain](#maintain-the-canonical-collection) · [Discover](#catalog-and-discovery) · [Contribute](#contributing)

![Skills](https://img.shields.io/badge/skills-30-2563eb?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDJsMyA3aDdsLTUuNSA0LjUgMiA3LTYuNS00LjUtNi41IDQuNSAyLTctNS41LTQuNWg3eiIvPjwvc3ZnPg==)
![Categories](https://img.shields.io/badge/categories-8-10b981?style=for-the-badge)
![Format](https://img.shields.io/badge/format-markdown-f59e0b?style=for-the-badge)
![Runtime](https://img.shields.io/badge/runtime-markdown%20%2B%20optional%20Node.js-ef4444?style=for-the-badge)

</div>

---

## What this repository is

This is the canonical, curated Agent Skills repository used by Codenburg/OpenCode. It keeps reusable task guidance versioned and reviewable as Markdown contracts so agents can load only the relevant `SKILL.md` at activation time. It is a source-controlled catalog and curation boundary, not a deployable application or package manager.

External and [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai) skill trees may exist beside this repository as upstream inputs or installed integrations. They are not automatically part of this catalog or writable canonical content.

## Quick start

### Consume the collection

Use a generic clone path when a project only needs a source checkout of the collection:

```bash
git clone https://github.com/Codenburg/skills ~/skills
```

This checkout is source-only: OpenCode does not automatically discover an arbitrary `~/skills` path. The consuming runtime or agent must configure the checkout through one of OpenCode's supported skill-discovery mechanisms, such as a recognized skill directory or `skills.paths` in the OpenCode configuration. Skill discovery is independent from `AGENTS.md`, which is reserved for project context, invariants, routing, and mandatory workflows. `~/skills` remains distinct from the canonical maintainer installation below.

### Maintain the canonical installation

The canonical maintainer path is `~/.config/opencode/skills`. Clone there and follow [`setup/README.md`](setup/README.md) for reproducible upstream reconstruction:

```bash
git clone https://github.com/Codenburg/skills ~/.config/opencode/skills
cd ~/.config/opencode/skills
node scripts/bootstrap-upstream-skills.mjs --dry-run
```

The dry run is the safe first step. After reviewing it, use the default bootstrap mode for an initial reconstruction and `--verify`; for normal maintenance, use the explicit update flow:

```bash
node scripts/bootstrap-upstream-skills.mjs --update
node scripts/bootstrap-upstream-skills.mjs --verify
```

## Maintain the canonical collection

### Flow and trust boundary

| Stage | Responsibility and boundary |
| --- | --- |
| Upstream reconstruction | `scripts/bootstrap-upstream-skills.mjs` reconstructs the declared upstream tree at `~/.agents/skills`; it does not import canonical content, change `skills-sources.json`, invoke curation, or refresh indexes. |
| Read-only audit | [`skills-auditor`](skills-auditor/SKILL.md) compares a candidate with relevant canonical evidence without writing files or upstream metadata. |
| Human decision | A maintainer reviews the evidence and decides whether an exact curation operation should proceed. |
| Approval-gated curation | [`skills-curator`](skills-curator/SKILL.md) is the one-way writer from the read-only upstream root into this canonical repository, and applies only an explicitly approved operation. See the [curation policy](skills-curator/references/curation-policy.md) for exact gates. |
| Discovery and indexing | Graphify and the generated registry can help discovery, but neither establishes ownership, provenance, approval, or mutation authority. |

[`skills-sources.json`](skills-sources.json) records repository/source relationships and is the curation and provenance authority for them; it does not determine authorship. The `canonical` root is the write target; `~/.agents/skills` is a read-only upstream source. External skill content, names, generated indexes, and semantic judgment are evidence or discovery aids, not ownership or approval.

### Bootstrap and curation are separate

| Bootstrap | Curation |
| --- | --- |
| Rebuilds the external upstream tree from the setup declaration. | Decides whether reviewed upstream content belongs in the canonical catalog. |
| Uses `--dry-run`, default install-missing behavior, `--update`, and `--verify`. | Uses read-only audit evidence, the manifest, and explicit human approval. |
| Never writes canonical skill content or refreshes Graphify/registry output. | Never writes upstream, auto-deletes canonical targets, commits, or pushes. |

After upstream reconstruction, request deterministic pending discovery with:

```text
/skills-auditor nuevas
```

Only after review and a human decision should the curation command be invoked:

```text
/skills-curator
```

## Catalog and discovery

The 30-count covers only the immediate child directories in this worktree that provide a usable root-level `SKILL.md` and an invocation channel. It excludes `_shared`, delegated-only support contracts, Git-ignored Gentle AI roots, and skills installed elsewhere. It describes the current worktree catalog; it is not an inventory of every installed skill.

### Functional areas

Names appear once in the ownership-aware catalog below; these are the corresponding area totals:

| Functional area | Count |
| --- | ---: |
| Frameworks & Libraries | 10 |
| Styling & Design | 3 |
| Database & ORM | 4 |
| Security & Authentication | 1 |
| Testing | 5 |
| Development Workflows | 1 |
| Project Maintenance | 2 |
| Skill Development | 4 |
| **Total** | **30** |

Authorship and canonical repository relationship are separate: first-party means authored by Codenburg; canonical relationship describes how a skill is managed in this repository. `skills-sources.json` records the latter and does not determine authorship.

### Codenburg-authored / first-party — 5

These five skills are authored by Codenburg. The **Core** label highlights skills that govern repository maintenance, documentation routing, or curation boundaries; it does not create another ownership class.

| Skill | Functional area | Problem solved / when used |
| --- | --- | --- |
| [`agents-md-manager`](agents-md-manager/SKILL.md) | Skill Development | **Core** — Manages the root `AGENTS.md` lifecycle, routing, and managed-region preservation; use only for its explicit lifecycle modes. It is not a foundation, documentation, or catalog manager. |
| [`docs-guardian`](docs-guardian/SKILL.md) | Project Maintenance | **Core** — Resolves release/version and documentation decisions for completed Gymflow work; use before final review and commit for qualifying changes. |
| [`project-foundation-manager`](project-foundation-manager/SKILL.md) | Project Maintenance | **Core** — Audits, plans, and updates a durable project documentation foundation after approval; use for explicit foundation lifecycle work, independently of `agents-md-manager`. |
| [`skills-auditor`](skills-auditor/SKILL.md) | Skill Development | **Core** — Performs the read-only semantic comparison before incorporation; use it to keep analysis separate from curation authority. |
| [`skills-curator`](skills-curator/SKILL.md) | Skill Development | **Core** — Performs exact approval-gated, one-way writes into the canonical repository; use only after review and explicit human approval. |

### Third-party — 25

These skills are not authored by Codenburg; the subgroups describe their repository relationships.

#### Locally maintained canonical third-party skills — 6

| Skill | Functional area | Problem solved / when used |
| --- | --- | --- |
| [`go-testing`](go-testing/SKILL.md) | Testing | Focused Go and Bubble Tea test patterns, coverage, and deterministic goldens; use when writing or reviewing Go tests. |
| [`playwright`](playwright/SKILL.md) | Testing | End-to-end structure, page objects, selector discipline, and MCP-first exploration; use when writing Playwright tests. |
| [`prisma`](prisma/SKILL.md) | Database & ORM | Prisma schema, type-safe client, migration, and performance guidance; use for Prisma design and query work. |
| [`prisma-migration-assistant`](prisma-migration-assistant/SKILL.md) | Database & ORM | Safe schema migration planning, SQL review, data backfills, and rollback sequencing; use for complex Prisma migrations. |
| [`tailwind-design-system`](tailwind-design-system/SKILL.md) | Styling & Design | Tailwind v4 tokens, CSS-first configuration, component patterns, and v3-to-v4 migration guidance; use for design-system work. |
| [`tanstack-table`](tanstack-table/SKILL.md) | Frameworks & Libraries | TanStack Table v8 patterns for data grids, sorting, filtering, pagination, and controlled state; use when building tables or datagrids. |

#### Curated imports — 3

These are the current managed entries in the manifest `imports[]`; the classification describes the recorded source-to-canonical curation relationship, not universal authorship.

| Skill | Functional area | Problem solved / when used |
| --- | --- | --- |
| [`auth-review`](auth-review/SKILL.md) | Security & Authentication | Static authentication and authorization review, including access-control and IDOR/BOLA checks; use for an explicit identity-security audit. |
| [`javascript-testing-patterns`](javascript-testing-patterns/SKILL.md) | Testing | JavaScript/TypeScript unit, integration, and end-to-end testing strategy; use when setting up or extending test infrastructure. |
| [`prisma-cli`](prisma-cli/SKILL.md) | Database & ORM | Prisma ORM CLI command reference; use for Prisma initialization, generation, migration, database, validation, and related CLI workflows. |

#### Selected local copies / origin not claimed — 16

The manifest records these paths as `canonical local copy without managed provenance`. Their origin is intentionally neutral here; use the attribution and contract details in each `SKILL.md` without converting a local copy into a first-party authorship claim.

| Skill | Functional area | Problem solved / when used |
| --- | --- | --- |
| [`expo-tailwind-setup`](expo-tailwind-setup/SKILL.md) | Styling & Design | Tailwind v4 with `react-native-css` and NativeWind v5 across iOS, Android, and Web; use for Expo styling setup. |
| [`find-skills`](find-skills/SKILL.md) | Skill Development | Finds an existing ecosystem skill for a requested capability; use when a task may already have reusable guidance. |
| [`frontend-design`](frontend-design/SKILL.md) | Styling & Design | Distinctive, production-grade frontend interface design; use for web components, pages, and layouts. |
| [`next-best-practices`](next-best-practices/SKILL.md) | Frameworks & Libraries | Next.js App Router, RSC, routing, metadata, error handling, and optimization guidance; use for Next.js application work. |
| [`next-cache-components`](next-cache-components/SKILL.md) | Frameworks & Libraries | Next.js 16 Cache Components, Partial Prerendering, and cache invalidation; use for Cache Components work. |
| [`prisma-database-setup`](prisma-database-setup/SKILL.md) | Database & ORM | Prisma configuration for PostgreSQL, MySQL, SQLite, MongoDB, and other providers; use for database setup or connection troubleshooting. |
| [`react-19`](react-19/SKILL.md) | Frameworks & Libraries | React 19 Compiler, hooks, Server Components, and Actions patterns; use when writing React 19 components. |
| [`react-hook-form`](react-hook-form/SKILL.md) | Frameworks & Libraries | Client-side React Hook Form configuration, subscriptions, controlled components, and field arrays; use for client-side forms. |
| [`shadcn`](shadcn/SKILL.md) | Frameworks & Libraries | shadcn/ui component and project composition; use for component registries, presets, styling, and debugging. |
| [`typescript-advanced-types`](typescript-advanced-types/SKILL.md) | Frameworks & Libraries | Advanced TypeScript generics, conditional types, mapped types, and type-safe utilities; use for complex type-driven code. |
| [`typescript-react-reviewer`](typescript-react-reviewer/SKILL.md) | Development Workflows | TypeScript and React code review for anti-patterns, state management, hooks, and maintainability; use during React review work. |
| [`vercel-react-best-practices`](vercel-react-best-practices/SKILL.md) | Frameworks & Libraries | React and Next.js performance guidance for fetching, rendering, bundles, and load times; use when optimizing frontend code. |
| [`vitest`](vitest/SKILL.md) | Testing | Vitest patterns for async tests, mocking, snapshots, and test performance; use when writing or debugging Vitest tests. |
| [`webapp-testing`](webapp-testing/SKILL.md) | Testing | Playwright-based verification of local web applications, browser behavior, screenshots, and logs; use for local web-app testing. |
| [`zod-4`](zod-4/SKILL.md) | Frameworks & Libraries | Zod 4 validation and migration patterns; use for TypeScript-first schema validation. |
| [`zustand-5`](zustand-5/SKILL.md) | Frameworks & Libraries | Zustand 5 state-management patterns, including persistence, Immer, DevTools, and slices; use for Zustand stores. |

### External and integrated tooling outside the 30

- `~/.agents/skills` is the manifest-declared, read-only upstream tree. It may contain additional external skills that are not present in this catalog.
- Gentle AI governance copies, including SDD, Graphify, issue, review, and skill-maintenance tooling, are separate installed integrations rather than entries in the 30 named root catalog.
- The project-scoped `.opencode/skills/graphify/` integration and plugin support optional discovery. They do not grant ownership or curation authority.

### Integration boundaries

| Integration | Role and authority |
| --- | --- |
| OpenCode | Reads project `AGENTS.md` instructions and independently discovers root-level `SKILL.md` contracts. `AGENTS.md` context routing and skill discovery are separate responsibilities. |
| Graphify | Optional, manual discovery aid for `/skills-auditor nuevas`; the [shortlist helper](skills-auditor/scripts/graphify-shortlist.mjs) and generated `graphify-out/` are advisory only, not auto-refreshed, and have zero authority. See the [integration reference](skills-auditor/references/graphify-integration.md) for its bounded role. |
| Registry projection | Generated `.atl/` discovery index only. It may emit machine-local paths and has no ownership, provenance, or curation authority. |

## Repository structure

| Path | Purpose |
| --- | --- |
| `README.md` | Human entry point, quick starts, catalog, boundaries, and contributor guidance. |
| `skills-sources.json` | Deterministic curation and provenance authority. |
| `setup/README.md` and `setup/upstream-skills.json` | Reproducible upstream reconstruction guidance and declaration. |
| `scripts/bootstrap-upstream-skills.mjs` | Dependency-free upstream bootstrap adapter. |
| `skills-auditor/` | Read-only semantic audit contract and bounded shortlist helper. |
| `skills-curator/` | Approval-gated one-way curation contract and helper. |
| `agents-md-manager/` | Root `AGENTS.md` lifecycle and routing contract. |
| `project-foundation-manager/` | Durable project-foundation audit, plan, and update contract. |
| `.opencode/` | Tracked project-scoped OpenCode and Graphify integration; local dependencies remain ignored. |
| `.atl/` and `graphify-out/` | Generated, ignored discovery state; never hand-edit as authority records. |

## Testing and structural evals

The repository separates executable mechanical checks from structural evaluation records. The source-definition counts below are not current pass results, and this documentation task did not run any tests or evals.

### Mechanical Node checks

Run from the repository root when changing the relevant helper:

```bash
# Bootstrap helper suite
node --test scripts/bootstrap-upstream-skills.test.mjs

# Root AGENTS.md helper suite
node --test agents-md-manager/scripts/agents-md-region.test.mjs

# Curation helper: 62 test definitions
node --test skills-curator/scripts/skill-tree-sync.test.mjs

# Graphify shortlist helper: 18 test definitions
node --test skills-auditor/scripts/graphify-shortlist.test.mjs

# Syntax and whitespace checks
node --check scripts/bootstrap-upstream-skills.mjs
node --check agents-md-manager/scripts/agents-md-region.mjs
node --check skills-curator/scripts/skill-tree-sync.mjs
node --check skills-auditor/scripts/graphify-shortlist.mjs
git diff --check
```

### Structural eval records

`skills-auditor/evals/evals.json`, `agents-md-manager/evals/evals.json`, and `project-foundation-manager/evals/evals.json` record expected contract behavior. They are structural records, not an executable semantic or model harness, and their presence does not claim a current PASS.

## Contributing

1. Create a root-level `<skill-name>/SKILL.md`; do not create a nested `skills` directory.
2. Follow the frontmatter and activation style used by current skill contracts. Put triggers in the quoted one-line `description` and/or the `Activation Contract`, not in a standalone frontmatter field named `trigger`.
3. Add an intentional canonical skill to the appropriate README category and supported discovery path for its consumer. Record repository/source relationships in the manifest; do not manually edit `.atl/` or Graphify-generated indexes.
4. Validate with the direct commands above. No package-manager script is required.
