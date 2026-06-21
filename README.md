<div align="center">

# Agent Skills Registry

**41 specialized skills that AI agents load on demand**

Drop-in `AGENTS.md` blocks · Lazy context loading · Pure markdown

[Install](#installation) · [All Skills](#all-skills) · [By Category](#by-category)

![Skills](https://img.shields.io/badge/skills-41-2563eb?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDJsMyA3aDdsLTUuNSA0LjUgMiA3LTYuNS00LjUtNi41IDQuNSAyLTctNS41LTQuNWg3eiIvPjwvc3ZnPg==)
![Categories](https://img.shields.io/badge/categories-8-10b981?style=for-the-badge)
![Format](https://img.shields.io/badge/format-markdown-f59e0b?style=for-the-badge)
![Runtime](https://img.shields.io/badge/runtime-none-ef4444?style=for-the-badge)

</div>

---

## Overview

Each skill is a self-contained `SKILL.md` with domain-specific instructions. When the AI agent detects matching context (file types, technologies, or task patterns), it reads the skill **before** generating a response.

The goal: a project's `AGENTS.md` becomes a lightweight index — it doesn't duplicate skill content, it just tells the AI where to find it.

```text
Project AGENTS.md  →  points to skill paths  →  AI loads SKILL.md on demand
   (index)              (single line each)        (full instructions)
```

---

## Categories at a Glance

| Category | Count | What it's for |
|----------|:-----:|---------------|
| **Frameworks & Libraries** | 10 | React, Next.js, shadcn, TanStack, Zod, Zustand, TypeScript |
| **Styling & Design** | 3 | Tailwind v4, Expo + NativeWind, frontend design |
| **Database & ORM** | 2 | Prisma, multi-database setup |
| **Testing** | 3 | Playwright, webapp testing, Go/TUI testing |
| **Development Workflows** | 15 | SDD pipeline, code review, PR splits, work units |
| **GitHub & Issues** | 3 | Issues, PRs, collaboration comments |
| **Project Maintenance** | 1 | ROADMAP/CHANGELOG with semver (pending only, severity 🔴/🟡/🟢) |
| **Skill Development** | 4 | Create, find, improve, registry skills |

---

## Quick Reference

Copy any of these lines into your `AGENTS.md` to enable the skill.

### Frameworks & Libraries

When working with **React 19** (React Compiler, Server Components, Actions), read `~/skills/react-19/SKILL.md` first.
When working with **Next.js** (App Router, RSC, API routes, caching), read `~/skills/next-best-practices/SKILL.md` first.
When working with **Next.js 16 Cache Components** (PPR, use cache, cacheLife, cacheTag), read `~/skills/next-cache-components/SKILL.md` first.
When working with **Vercel React/Next.js best practices** (performance, data fetching, bundle optimization), read `~/skills/vercel-react-best-practices/SKILL.md` first.
When working with **React Hook Form** (useForm, useWatch, useController, useFieldArray), read `~/skills/react-hook-form/SKILL.md` first.
When working with **Zustand 5** (state management, slices, persist), read `~/skills/zustand-5/SKILL.md` first.
When working with **shadcn/ui** (component registry, presets, styling), read `~/skills/shadcn/SKILL.md` first.
When working with **TanStack Table** (headless tables, sorting, filtering), read `~/skills/tanstack-table/SKILL.md` first.
When working with **Zod 4** (schema validation, breaking changes from v3), read `~/skills/zod-4/SKILL.md` first.
When working with **TypeScript advanced types** (generics, conditional types, mapped types, template literals), read `~/skills/typescript-advanced-types/SKILL.md` first.

### Styling & Design

When working with **Tailwind CSS v4** (design tokens, component libraries, responsive), read `~/skills/tailwind-design-system/SKILL.md` first.
When working with **Expo + Tailwind** (NativeWind v5, Tailwind v4.1, react-native-css, import rewrite), read `~/skills/expo-tailwind-setup/SKILL.md` first.
When working with **Frontend Design** (production-grade interfaces, landing pages, dashboards), read `~/skills/frontend-design/SKILL.md` first.

### Database & ORM

When working with **Prisma** (type-safe database operations, schema design), read `~/skills/prisma/SKILL.md` first.
When working with **Prisma Database Setup** (PostgreSQL, MySQL, SQLite, MongoDB), read `~/skills/prisma-database-setup/SKILL.md` first.

### Testing

When working with **Playwright** (E2E tests, Page Objects, selectors), read `~/skills/playwright/SKILL.md` first.
When working with **Web App Testing** (Playwright-based toolkit for local apps, screenshots, logs), read `~/skills/webapp-testing/SKILL.md` first.
When working with **Go Testing** (Bubbletea TUI, teatest patterns), read `~/skills/go-testing/SKILL.md` first.

### Development Workflows

When working with **Spec-Driven Development** (SDD), read `~/skills/sdd-init/SKILL.md` first.
When creating a **new SDD change proposal**, read `~/skills/sdd-propose/SKILL.md` first.
When **writing SDD specifications**, read `~/skills/sdd-spec/SKILL.md` first.
When **creating SDD technical design**, read `~/skills/sdd-design/SKILL.md` first.
When **breaking down SDD into tasks**, read `~/skills/sdd-tasks/SKILL.md` first.
When **implementing SDD tasks**, read `~/skills/sdd-apply/SKILL.md` first.
When **verifying SDD implementation**, read `~/skills/sdd-verify/SKILL.md` first.
When **archiving a completed SDD change**, read `~/skills/sdd-archive/SKILL.md` first.
When **exploring codebase or thinking through ideas**, read `~/skills/sdd-explore/SKILL.md` first.
When **onboarding to SDD** (guided walkthrough), read `~/skills/sdd-onboard/SKILL.md` first.
When doing **Code Review** (adversarial, dual-judge), read `~/skills/judgment-day/SKILL.md` first.
When doing **TypeScript + React code review** (anti-patterns, state management, useEffect, type safety), read `~/skills/typescript-react-reviewer/SKILL.md` first.
When **splitting oversized changes** into chained or stacked PRs, read `~/skills/chained-pr/SKILL.md` first.
When **planning commits** as reviewable work units, read `~/skills/work-unit-commits/SKILL.md` first.
When **designing documentation** with reduced cognitive load, read `~/skills/cognitive-doc-design/SKILL.md` first.

### GitHub & Issues

When **creating GitHub issues** or **reporting bugs**, read `~/skills/issue-creation/SKILL.md` first.
When **creating pull requests**, read `~/skills/branch-pr/SKILL.md` first.
When **writing collaboration comments** (PR feedback, reviews, messages), read `~/skills/comment-writer/SKILL.md` first.

### Project Maintenance

When **maintaining ROADMAP/CHANGELOG/package.json/README** with semver versioning (ROADMAP pending only, severity 🔴/🟡/🟢, multi-fix + reverts + pre-release + optional tests, force-bump audit, tier-filtered §Pendiente matching, heuristic language detection, CHANGELOG validation), read `~/skills/docs-guardian/SKILL.md` first. Supersedes `readme-guardian`.

### Skill Development

When **creating new AI agent skills**, read `~/skills/skill-creator/SKILL.md` first.
When **searching for available skills**, read `~/skills/find-skills/SKILL.md` first.
When **improving or auditing** existing AI agent skills, read `~/skills/skill-improver/SKILL.md` first.
When **updating the skill registry** after adding or removing skills, read `~/skills/skill-registry/SKILL.md` first.

---

## Using as AGENTS.md

Each Quick Reference entry is a self-contained block you can copy directly into any project's `AGENTS.md`. When the AI encounters that context, it knows exactly which `SKILL.md` to load.

The full file is at [`AGENTS.md.example`](./AGENTS.md.example) — it contains all 41 skills in ready-to-use format.

**How to use it:**

1. Clone this repo to `~/skills/` (or wherever you prefer)
2. Copy `AGENTS.md.example` (or only the relevant sections) into your project's `AGENTS.md`
3. The AI reads `AGENTS.md` at session start and loads matching skills on demand

```bash
cp ~/skills/AGENTS.md.example my-project/AGENTS.md
# Then edit it: keep only the sections relevant to your project
```

---

## All Skills

<details>
<summary><b>Frameworks & Libraries</b> (10)</summary>

| Skill | Description |
|-------|-------------|
| `react-19` | React 19 patterns: Compiler, Server Components, Actions |
| `next-best-practices` | Next.js best practices for App Router and RSC |
| `next-cache-components` | Next.js 16 Cache Components with PPR |
| `vercel-react-best-practices` | React/Next.js performance guidelines from Vercel Engineering |
| `react-hook-form` | React Hook Form optimization for client-side forms |
| `zustand-5` | Zustand 5 state management with persist and slices |
| `shadcn` | Manage shadcn/ui components, presets, and projects |
| `tanstack-table` | Headless UI for powerful tables and datagrids |
| `zod-4` | Zod 4 schema validation with new top-level validators |
| `typescript-advanced-types` | Master TypeScript's advanced type system |

</details>

<details>
<summary><b>Styling & Design</b> (3)</summary>

| Skill | Description |
|-------|-------------|
| `tailwind-design-system` | Build scalable design systems with Tailwind v4 |
| `expo-tailwind-setup` | Set up NativeWind v5 + Tailwind v4.1 in Expo |
| `frontend-design` | Create distinctive production-grade frontend interfaces |

</details>

<details>
<summary><b>Database & ORM</b> (2)</summary>

| Skill | Description |
|-------|-------------|
| `prisma` | Prisma ORM with type-safe operations and schema design |
| `prisma-database-setup` | Configure Prisma with any database provider |

</details>

<details>
<summary><b>Testing</b> (3)</summary>

| Skill | Description |
|-------|-------------|
| `playwright` | Playwright E2E testing with Page Object Model |
| `webapp-testing` | Playwright toolkit for testing local web apps |
| `go-testing` | Go testing patterns (Bubbletea TUI) |

</details>

<details>
<summary><b>Development Workflows</b> (15)</summary>

| Skill | Description |
|-------|-------------|
| `sdd-init` | Initialize SDD context and project configuration |
| `sdd-propose` | Create SDD change proposals with intent and scope |
| `sdd-spec` | Write SDD delta specs with requirements and scenarios |
| `sdd-design` | Create SDD technical design and architecture |
| `sdd-tasks` | Break SDD changes into implementation tasks |
| `sdd-apply` | Implement SDD tasks from specs and design |
| `sdd-verify` | Validate implementation against SDD specs |
| `sdd-archive` | Archive completed SDD changes |
| `sdd-explore` | Explore SDD ideas before committing to a change |
| `sdd-onboard` | Guided walkthrough of the full SDD cycle |
| `judgment-day` | Blind dual adversarial review protocol |
| `typescript-react-reviewer` | Expert code reviewer for TypeScript + React 19 |
| `chained-pr` | Split oversized changes into chained/stacked PRs |
| `work-unit-commits` | Plan commits as reviewable work units |
| `cognitive-doc-design` | Design docs that reduce cognitive load |

</details>

<details>
<summary><b>GitHub & Issues</b> (3)</summary>

| Skill | Description |
|-------|-------------|
| `issue-creation` | Create GitHub issues with issue-first workflow |
| `branch-pr` | Create Gentle AI pull requests with issue-first checks |
| `comment-writer` | Write warm, direct collaboration comments |

</details>

<details>
<summary><b>Project Maintenance</b> (1)</summary>

| Skill | Description |
|-------|-------------|
| `docs-guardian` | Maintain ROADMAP/CHANGELOG/package.json/README with semver (ROADMAP pending only, severity 🔴/🟡/🟢, multi-fix + reverts + pre-release + optional tests, force-bump audit, tier-filtered §Pendiente matching). Supersedes readme-guardian. |

</details>

<details>
<summary><b>Skill Development</b> (4)</summary>

| Skill | Description |
|-------|-------------|
| `skill-creator` | Create LLM-first skills with valid frontmatter |
| `find-skills` | Discover and install agent skills |
| `skill-improver` | Audit and upgrade existing AI agent skills |
| `skill-registry` | Index available skills by trigger and path |

</details>

---

## Installation

**Option 1 — Full clone (recommended):**

```bash
git clone https://github.com/Codenburg/skills ~/skills
```

**Option 2 — Single skill:**

Copy just the skill folder you need:

```bash
# Example: only the Playwright skill
cp -r ~/skills/playwright/ ~/my-project/.opencode/skills/playwright/
```

**Option 3 — Selective via AGENTS.md:**

```bash
cp ~/skills/AGENTS.md.example my-project/AGENTS.md
# Edit the file and keep only the sections relevant to your project
```

After installation, verify the AI can find them:

```bash
ls ~/skills/ | wc -l    # should print 41 (+ the _shared internal dir)
```

---

## Contributing

To add a new skill:

1. Create a directory under `skills/` named after the skill
2. Add a `SKILL.md` with valid frontmatter (name, description, trigger)
3. Register it in the **Quick Reference** and **All Skills** sections
4. Update the category count in the badges above

To audit or improve an existing skill, use the [`skill-improver`](./skill-improver/SKILL.md) workflow.

---

## License

MIT — see [`LICENSE`](./LICENSE) for details.
