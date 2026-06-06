# Agent Skills Registry

Collection of specialized skills for AI agents. Each skill provides domain-specific instructions that get loaded automatically when relevant context is detected.

## Quick Reference

Copy any of these lines into your `AGENTS.md` to enable the skill:

---

### Frameworks & Libraries

When working with **React 19** (React Compiler, Server Components, Actions), read `~/skills/react-19/SKILL.md` first.

When working with **Next.js** (App Router, RSC, API routes, caching), read `~/skills/next-best-practices/SKILL.md` first.

When working with **Next.js 16 Cache Components** (PPR, use cache, cacheLife, cacheTag), read `~/skills/next-cache-components/SKILL.md` first.

When working with **React Hook Form** (useForm, useWatch, useController, useFieldArray), read `~/skills/react-hook-form/SKILL.md` first.

When working with **Zustand 5** (state management, slices, persist), read `~/skills/zustand-5/SKILL.md` first.

When working with **shadcn/ui** (component registry, presets, styling), read `~/skills/shadcn/SKILL.md` first.

When working with **TanStack Table** (headless tables, sorting, filtering), read `~/skills/tanstack-table/SKILL.md` first.

When working with **Zod 4** (schema validation, breaking changes from v3), read `~/skills/zod-4/SKILL.md` first.

---

### Styling & Design

When working with **Tailwind CSS v4** (design tokens, component libraries, responsive), read `~/skills/tailwind-design-system/SKILL.md` first.

When working with **Frontend Design** (production-grade interfaces, landing pages, dashboards), read `~/skills/frontend-design/SKILL.md` first.

---

### Database & ORM

When working with **Prisma** (type-safe database operations, schema design), read `~/skills/prisma/SKILL.md` first.

When working with **Prisma Database Setup** (PostgreSQL, MySQL, SQLite, MongoDB), read `~/skills/prisma-database-setup/SKILL.md` first.

---

### Testing

When working with **Playwright** (E2E tests, Page Objects, selectors), read `~/skills/playwright/SKILL.md` first.

When working with **Go Testing** (Bubbletea TUI, teatest patterns), read `~/skills/go-testing/SKILL.md` first.

---

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

When **splitting oversized changes** into chained or stacked PRs, read `~/skills/chained-pr/SKILL.md` first.

When **planning commits** as reviewable work units, read `~/skills/work-unit-commits/SKILL.md` first.

When **designing documentation** with reduced cognitive load, read `~/skills/cognitive-doc-design/SKILL.md` first.

---

### GitHub & Issues

When **creating GitHub issues** or **reporting bugs**, read `~/skills/issue-creation/SKILL.md` first.

When **creating pull requests**, read `~/skills/branch-pr/SKILL.md` first.

When **writing collaboration comments** (PR feedback, reviews, messages), read `~/skills/comment-writer/SKILL.md` first.

---

### Project Maintenance

When **maintaining README/CHANGELOG** with semver versioning, read `~/skills/readme-guardian/SKILL.md` first.

---

### Skill Development

When **creating new AI agent skills**, read `~/skills/skill-creator/SKILL.md` first.

When **searching for available skills**, read `~/skills/find-skills/SKILL.md` first.

When **improving or auditing** existing AI agent skills, read `~/skills/skill-improver/SKILL.md` first.

When **updating the skill registry** after adding or removing skills, read `~/skills/skill-registry/SKILL.md` first.

---

## Using as AGENTS.md

Each Quick Reference entry is a self-contained block you can copy directly into any project's `AGENTS.md`. When the AI encounters that context, it knows exactly which `SKILL.md` to load.

File: [`AGENTS.md.example`](./AGENTS.md.example) — contains all skills in ready-to-use format.

**How to use it:**

1. Clone this repo to `~/skills/` (or wherever you prefer)
2. Copy `AGENTS.md.example` or the relevant sections into your project's `AGENTS.md`
3. The AI reads `AGENTS.md` at session start and loads matching skills on demand

The goal: a project's `AGENTS.md` becomes a lightweight symlink — it doesn't duplicate skill content, it just tells the AI where to find it.

```bash
cp ~/skills/AGENTS.md.example my-project/AGENTS.md
# Then edit it: keep only the sections relevant to your project
```

---

## Available Skills (36)

| Skill | Description |
|-------|-------------|
| `branch-pr` | Create Gentle AI pull requests with issue-first checks |
| `chained-pr` | Split oversized changes into chained/stacked PRs |
| `cognitive-doc-design` | Design docs that reduce cognitive load |
| `comment-writer` | Write warm, direct collaboration comments |
| `find-skills` | Discover and install agent skills |
| `frontend-design` | Create distinctive production-grade frontend interfaces |
| `go-testing` | Go testing patterns (Bubbletea TUI) |
| `issue-creation` | Create GitHub issues with issue-first workflow |
| `judgment-day` | Blind dual adversarial review protocol |
| `next-best-practices` | Next.js best practices for App Router and RSC |
| `next-cache-components` | Next.js 16 Cache Components with PPR |
| `playwright` | Playwright E2E testing with Page Object Model |
| `prisma` | Prisma ORM with type-safe operations and schema design |
| `prisma-database-setup` | Configure Prisma with any database provider |
| `react-19` | React 19 patterns with Compiler, Server Components, Actions |
| `react-hook-form` | React Hook Form optimization for client-side forms |
| `readme-guardian` | Maintain README/CHANGELOG with semver versioning |
| `sdd-apply` | Implement SDD tasks from specs and design |
| `sdd-archive` | Archive completed SDD changes |
| `sdd-design` | Create SDD technical design and architecture |
| `sdd-explore` | Explore SDD ideas before committing to a change |
| `sdd-init` | Initialize SDD context and project configuration |
| `sdd-onboard` | Guided walkthrough of the full SDD cycle |
| `sdd-propose` | Create SDD change proposals with intent and scope |
| `sdd-spec` | Write SDD delta specs with requirements and scenarios |
| `sdd-tasks` | Break SDD changes into implementation tasks |
| `sdd-verify` | Validate implementation against SDD specs |
| `shadcn` | Manage shadcn/ui components, presets, and projects |
| `skill-creator` | Create LLM-first skills with valid frontmatter |
| `skill-improver` | Audit and upgrade existing AI agent skills |
| `skill-registry` | Index available skills by trigger and path |
| `tailwind-design-system` | Build scalable design systems with Tailwind v4 |
| `tanstack-table` | Headless UI for powerful tables and datagrids |
| `work-unit-commits` | Plan commits as reviewable work units |
| `zod-4` | Zod 4 schema validation with new top-level validators |
| `zustand-5` | Zustand 5 state management with persist and slices |

---

## Installation

Clone this repository to your `~/skills/` directory:

```bash
git clone https://github.com/Codenburg/skills ~/skills
```

Or add individual skills by copying the `SKILL.md` file to your local `~/skills/{skill-name}/` directory.
