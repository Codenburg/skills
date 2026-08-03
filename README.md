<div align="center">

# Agent Skills Registry

**21 specialized skills that AI agents load on demand**

Drop-in `AGENTS.md` blocks · Lazy context loading · Pure markdown

[Install](#install) · [Skills](#skills) · [Contributing](#contributing)

![Skills](https://img.shields.io/badge/skills-21-2563eb?style=for-the-badge&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDJsMyA3aDdsLTUuNSA0LjUgMiA3LTYuNS00LjUtNi41IDQuNSAyLTctNS41LTQuNWg3eiIvPjwvc3ZnPg==)
![Categories](https://img.shields.io/badge/categories-7-10b981?style=for-the-badge)
![Format](https://img.shields.io/badge/format-markdown-f59e0b?style=for-the-badge)
![Runtime](https://img.shields.io/badge/runtime-none-ef4444?style=for-the-badge)

</div>

---

## Install

```bash
git clone https://github.com/Codenburg/skills ~/skills
```

Copy only the skills your project needs:

```bash
cp ~/skills/AGENTS.md.example my-project/AGENTS.md
# Then edit it: keep only the sections relevant to your project
```

The AI reads `AGENTS.md` at session start and loads matching `SKILL.md` on demand.

This project uses [Gentle AI and its respective skills](https://github.com/Gentleman-Programming/gentle-ai).

---

## How It Works

Each skill is a `SKILL.md` with domain-specific instructions. When the AI detects matching context (file types, technologies, or task patterns), it reads the skill **before** generating a response.

```text
Project AGENTS.md  →  points to skill paths  →  AI loads SKILL.md on demand
   (index)              (single line each)        (full instructions)
```

---

## Skills

### Frameworks & Libraries (10)

| Load this skill | When working with |
|----------------|-------------------|
| `react-19` | React Compiler, Server Components, Actions |
| `next-best-practices` | Next.js App Router, RSC, API routes, caching |
| `next-cache-components` | Next.js 16 PPR, `use cache`, `cacheLife`, `cacheTag` |
| `vercel-react-best-practices` | React/Next.js performance optimization |
| `react-hook-form` | `useForm`, `useWatch`, `useFieldArray` |
| `zustand-5` | State management, persist, immer, slices |
| `shadcn` | Component registry, presets, styling |
| `tanstack-table` | Headless tables, sorting, filtering, pagination |
| `zod-4` | Schema validation, breaking changes from v3 |
| `typescript-advanced-types` | Generics, conditional types, mapped types |

### Styling & Design (3)

| Load this skill | When working with |
|----------------|-------------------|
| `tailwind-design-system` | Design tokens, Tailwind v4, responsive |
| `expo-tailwind-setup` | NativeWind v5 + Tailwind v4.1 + Expo |
| `frontend-design` | Production-grade interfaces, landing pages, dashboards |

### Database & ORM (2)

| Load this skill | When working with |
|----------------|-------------------|
| `prisma` | Schema design, type-safe database operations |
| `prisma-database-setup` | PostgreSQL, MySQL, SQLite, MongoDB setup |

### Testing (3)

| Load this skill | When working with |
|----------------|-------------------|
| `playwright` | E2E tests, Page Objects, selectors |
| `webapp-testing` | Playwright toolkit for local web apps, screenshots, logs |
| `go-testing` | Bubbletea TUI, teatest patterns |

### Development Workflows (1)

| Load this skill | When working with |
|----------------|-------------------|
| `typescript-react-reviewer` | TypeScript + React 19 code review |

### Project Maintenance (1)

| Load this skill | When working with |
|----------------|-------------------|
| `docs-guardian` | ROADMAP/CHANGELOG/package.json/README with semver versioning |

### Skill Development (1)

| Load this skill | When working with |
|----------------|-------------------|
| `find-skills` | Discovering and installing agent skills |

---

## Contributing

To add a new skill:

1. Create a directory under `skills/` named after the skill
2. Add a `SKILL.md` with valid frontmatter (name, description, trigger)
3. Add it to the **Skills** table for its category above
4. Update the count in the badges and in `AGENTS.md.example`

---

## License

MIT — see [`LICENSE`](./LICENSE) for details.
