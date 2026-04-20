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

When doing **Code Review** (adversarial, dual-judge), read `~/skills/judgment-day/SKILL.md` first.

---

### GitHub & Issues

When **creating GitHub issues** or **reporting bugs**, read `~/skills/issue-creation/SKILL.md` first.

When **creating pull requests**, read `~/skills/branch-pr/SKILL.md` first.

---

### Project Maintenance

When **maintaining README/CHANGELOG** with semver versioning, read `~/skills/readme-guardian/SKILL.md` first.

---

### Skill Development

When **creating new AI agent skills**, read `~/skills/skill-creator/SKILL.md` first.

When **searching for available skills**, read `~/skills/find-skills/SKILL.md` first.

---

## Available Skills (30)

| Skill | Description |
|-------|-------------|
| `branch-pr` | PR creation workflow for Agent Teams Lite |
| `find-skills` | Discover and install agent skills |
| `frontend-design` | Production-grade frontend interfaces |
| `go-testing` | Go testing patterns (Bubbletea TUI) |
| `issue-creation` | GitHub issue creation workflow |
| `judgment-day` | Parallel adversarial review protocol |
| `next-best-practices` | Next.js best practices |
| `next-cache-components` | Next.js 16 Cache Components |
| `playwright` | Playwright E2E testing patterns |
| `prisma` | Prisma ORM with type-safe operations |
| `prisma-database-setup` | Prisma database configuration |
| `react-19` | React 19 patterns with React Compiler |
| `react-hook-form` | React Hook Form optimization |
| `readme-guardian` | README/CHANGELOG semver versioning |
| `sdd-apply` | Implement SDD tasks |
| `sdd-archive` | Archive completed SDD changes |
| `sdd-design` | SDD technical design |
| `sdd-explore` | Explore codebase and ideas |
| `sdd-init` | Initialize SDD context |
| `sdd-propose` | Create SDD proposals |
| `sdd-spec` | Write SDD specifications |
| `sdd-tasks` | Break down SDD into tasks |
| `sdd-verify` | Verify SDD implementation |
| `shadcn` | shadcn/ui component management |
| `skill-creator` | Create new AI agent skills |
| `tailwind-design-system` | Tailwind CSS v4 design systems |
| `tanstack-table` | Headless table UI |
| `zod-4` | Zod 4 schema validation |
| `zustand-5` | Zustand 5 state management |

---

## Installation

Clone this repository to your `~/skills/` directory:

```bash
git clone https://github.com/Codenburg/skills ~/skills
```

Or add individual skills by copying the `SKILL.md` file to your local `~/skills/{skill-name}/` directory.
