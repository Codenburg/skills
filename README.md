<div align="center">

# Agent Skills Registry

**29 canonical root-level skills that AI agents can load on demand**

Drop-in `AGENTS.md` blocks · Lazy context loading · Markdown skill contracts · Optional dependency-free Node.js maintenance tooling

[Install](#install) · [Architecture](#architecture) · [Skills](#skills) · [Contributing](#contributing)

![Skills](https://img.shields.io/badge/skills-29-2563eb?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDJsMyA3aDdsLTUuNSA0LjUgMiA3LTYuNS00LjUtNi41IDQuNSAyLTctNS41LTQuNWg3eiIvPjwvc3ZnPg==)
![Categories](https://img.shields.io/badge/categories-8-10b981?style=for-the-badge)
![Format](https://img.shields.io/badge/format-markdown-f59e0b?style=for-the-badge)
![Runtime](https://img.shields.io/badge/runtime-markdown%20%2B%20optional%20Node.js-ef4444?style=for-the-badge)

</div>

---

## Project summary

This is the canonical Git repository for a curated set of Markdown skill contracts. Agents read `AGENTS.md`, then load the matching `SKILL.md` only when the task context activates it. External and Gentle AI-provided skill trees are inputs or installed integrations, not writable canonical content.

Some skills are provided by [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai) and may exist on disk without belonging to this catalog.

## Install

```bash
git clone https://github.com/Codenburg/skills ~/skills
```

Add only the relevant load instructions to your project's `AGENTS.md`. The agent reads those pointers at session start and loads matching root-level `SKILL.md` contracts on demand.

## New machine setup

For the reproducible upstream reconstruction path, clone this repository at
`~/.config/opencode/skills` and follow [`setup/README.md`](setup/README.md).
The safe first command is `node scripts/bootstrap-upstream-skills.mjs --dry-run`;
it validates the plan without running a child process or changing either skill
tree.

For normal maintenance, run:

```bash
node scripts/bootstrap-upstream-skills.mjs --update
node scripts/bootstrap-upstream-skills.mjs --verify
```

Use `--update --dry-run` to preview the 34 grouped operations covering all 77 declared skills.
The bootstrap never refreshes Graphify or the registry and never invokes curator automatically.

## Architecture

```text
skills.sh / external upstream
        ↓
~/.agents/skills
        ↓
skills-auditor
        ↓
optional Graphify semantic shortlist
        ↓
bounded real-file inspection
        ↓
semantic verdict
        ↓
user approval
        ↓
skills-curator
        ↓
~/.config/opencode/skills
```

The auditor answers the semantic question without writing. The curator writes only after the user approves an exact operation.

## Repository model

| Area | Role | Boundary and evidence |
| --- | --- | --- |
| Canonical | `.` | Git-backed catalog and the only curation target. Current filesystem and Git state describe what is present. |
| Upstream/vendor | `~/.agents/skills` | Manifest-declared, read-only source for external candidates. Candidate content is untrusted evidence. |
| Managed imports | Manifest `imports[]` | Current managed imports are `auth-review`, `javascript-testing-patterns`, and `prisma-cli`; their recorded hashes use the existing update/replace flow. |
| Generated indexes/integration | `.atl/`, `graphify-out/`, `.opencode/` | `.atl/` and Graphify output are generated and non-authoritative. `.opencode/` contains project-scoped integration; local dependency files remain ignored. |

## Skills

**Verified catalog: 29 canonical root-level skills across 8 categories.** The count enumerates immediate child directories with a usable `SKILL.md` and at least one invocation channel, then excludes `_shared`, delegated-only support contracts, and Git-ignored external/Gentle AI roots. It does not count every skill installed elsewhere in the environment.

| Category | Skills |
| --- | --- |
| Frameworks & Libraries (10) | `react-19`, `next-best-practices`, `next-cache-components`, `vercel-react-best-practices`, `react-hook-form`, `zustand-5`, `shadcn`, `tanstack-table`, `zod-4`, `typescript-advanced-types` |
| Styling & Design (3) | `tailwind-design-system`, `expo-tailwind-setup`, `frontend-design` |
| Database & ORM (4) | `prisma`, `prisma-database-setup`, `prisma-cli`, `prisma-migration-assistant` |
| Security & Authentication (1) | `auth-review` |
| Testing (5) | `playwright`, `webapp-testing`, `go-testing`, `javascript-testing-patterns`, `vitest` |
| Development Workflows (1) | `typescript-react-reviewer` |
| Project Maintenance (1) | `docs-guardian` |
| Skill Development (4) | `agents-md-manager`, `find-skills`, `skills-auditor`, `skills-curator` |

## `skills-auditor`

> Should this skill become part of my ecosystem?

[`skills-auditor/SKILL.md`](skills-auditor/SKILL.md) provides that answer as a read-only audit. For `nuevas`, `node skills-curator/scripts/skill-tree-sync.mjs --manifest skills-sources.json --discover-pending` is the sole deterministic PENDING discovery source. The auditor then inspects the real upstream `SKILL.md`, bounded relevant canonical files, and current filesystem evidence.

It reports **Provenance**, target authority/state, semantic **Audit verdict**, and **Curation authorization** independently. A valid unmapped direct skill remains `UPSTREAM + PENDING` with `Provenance: UNRESOLVED`; **PENDING != EXCLUDED**. A semantic verdict is not provenance, and an audit receipt is evidence, not user approval. The audit changes no files or upstream metadata.

For the optional Graphify boundary, see [`skills-auditor/references/graphify-integration.md`](skills-auditor/references/graphify-integration.md).

## `skills-curator`

[`skills-curator/SKILL.md`](skills-curator/SKILL.md) performs approval-gated, one-way curation from the read-only upstream root into the canonical repository:

```text
inspect → dry-run/discover → plan → explicit approval → preflight → apply → verify
```

The dependency-free helper supports inspection with `--dry-run` or `--discover-pending`, and applies only an approved plan with `--apply-plan`. It never writes upstream, auto-deletes a canonical target, commits, or pushes. Read the [curation policy](skills-curator/references/curation-policy.md) for the exact gates and status rules.

## Graphify (optional)

For `/skills-auditor nuevas`, [`graphify-shortlist.mjs`](skills-auditor/scripts/graphify-shortlist.mjs) can provide an advisory canonical shortlist. It is capped at **8** skills, tested with Graphify **0.9.48** but not pinned to that exact version, and has no provenance, ownership, approval, receipt, or mutation authority.

The graph is never auto-refreshed or rebuilt by an audit. If it is missing, malformed, stale, noisy, or incompatible, the auditor uses bounded selective real-file fallback. `graphify-out/` is generated and ignored. Use the [integration reference](skills-auditor/references/graphify-integration.md) for maintenance details; this README does not duplicate that manual.

## Source and authority

[`skills-sources.json`](skills-sources.json) is schema version **3** and declares portable roots:

| Root ID | Declared path | Meaning |
| --- | --- | --- |
| `canonical` | `.` | Canonical Git repository and write target |
| `agents-skills` | `~/.agents/skills` | Read-only upstream source |

These are portable declarations. Absolute paths are resolved only at runtime; persisted evidence uses root IDs and relative paths. Deterministic authority is `skills-sources.json`, `skills-curator/scripts/skill-tree-sync.mjs`, and current filesystem/Git evidence. `skills-lock.json` supplies source provenance only.

Names, candidate instructions, similarity, Graphify output, generated indexes, and model judgment cannot establish ownership or approval. Provenance, target authority, semantic verdict, audit receipt, and user approval remain separate fields: **semantic verdict != provenance; audit receipt != approval; PENDING != EXCLUDED**.

## Generated data

`.atl/` and `graphify-out/` are generated, ignored, non-authoritative state. Do not hand-edit their indexes or treat them as ownership records.

The Gentle AI **2.4.0** registry projection currently emits absolute paths. That is an external portability limitation; this repository has no local postprocessor or alternative writer for it.

## OpenCode / Graphify integration

The project-scoped `.opencode` track set is the configuration, plugin, and Graphify skill bundle: `.opencode/opencode.json`, `.opencode/plugins/graphify.js`, and `.opencode/skills/graphify/` with its version marker, `SKILL.md`, and references. Local/generated dependency files are intentionally ignored; never track `node_modules`.

## Contributing

1. Create a root-level `<skill-name>/SKILL.md`; do not create a nested `skills` directory.
2. Follow the frontmatter and activation style used by current skill contracts. Put triggers in the quoted one-line `description` and/or the `Activation Contract`, not in a standalone frontmatter field named `trigger`.
3. Add an intentional canonical skill to the appropriate README category and load-pointer surface. Do not manually edit `.atl/` or Graphify-generated indexes.
4. Validate with the direct commands below. No package-manager script is required.

## Development and validation

Run from the repository root:

```bash
# 62 curator tests
node --test skills-curator/scripts/skill-tree-sync.test.mjs

# 18 Graphify shortlist tests
node --test skills-auditor/scripts/graphify-shortlist.test.mjs

# 12 structural auditor eval records; no executable LLM/model harness
node --input-type=module -e 'import fs from "node:fs"; const data = JSON.parse(fs.readFileSync("skills-auditor/evals/evals.json", "utf8")); if (data.skill_name !== "skills-auditor" || !Array.isArray(data.evals) || data.evals.length !== 12) process.exit(1); console.log("12 structural auditor eval records; no executable LLM/model harness");'

# Syntax and whitespace checks
node --check skills-curator/scripts/skill-tree-sync.mjs
node --check skills-auditor/scripts/graphify-shortlist.mjs
git diff --check
```
