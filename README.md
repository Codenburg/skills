<div align="center">

# Codenburg Agent Skills

**111 curated OpenCode skills**

Personal skill collection for software development, product work, research, UI/UX and the workflows used around Codenburg projects.

![Skills](https://img.shields.io/badge/skills-111-2563eb?style=for-the-badge)
![Areas](https://img.shields.io/badge/areas-16-10b981?style=for-the-badge)
![Format](https://img.shields.io/badge/format-SKILL.md-f59e0b?style=for-the-badge)
![Runtime](https://img.shields.io/badge/runtime-OpenCode-ef4444?style=for-the-badge)

</div>

---

## What this repository is

This repository is the canonical collection of skills I keep available to OpenCode.

The collection is intentionally broad at the global level, but **skills are selected explicitly per project**. A skill stays here when it adds a distinct capability that is useful in real development or indie-SaaS work; redundant wrappers, duplicate authorities, abandoned workflows, and overly specialized tooling are removed.

The canonical maintainer installation is:

```text
~/.config/opencode/skills
```

A separate upstream/download area may exist at:

```text
~/.agents/skills
```

The two directories have different roles: `~/.agents/skills` can be used as an external source, while this repository represents the curated collection used day to day.

## Quick start

Clone the repository directly into the canonical OpenCode skills directory:

```bash
git clone https://github.com/Codenburg/skills ~/.config/opencode/skills
```

Or clone it elsewhere and expose that path through an OpenCode-supported skill discovery mechanism.

Skills are normal directories whose primary contract is a `SKILL.md`. Supporting references, scripts, examples, or evals can live beside it when the skill needs them.

## Curation rules

The current collection follows a few simple rules:

- Keep a skill when it provides a distinct capability that is realistically useful.
- Remove it when another retained skill already performs the same job well enough.
- Prefer focused skills over broad routers or second authorities.
- Keep technical skills even when they are project-specific if their capability is genuinely distinct.
- Keep product skills that directly help build, launch, operate, or improve a SaaS.
- Do not keep specialized marketing, sales, PR, channel-operations, or agency workflows without a concrete use case.
- Gentle AI infrastructure and the SDD family are treated as coordinated systems rather than pruned as isolated skills.
- Project configuration decides which globally available skills are active for a given codebase.

There is no automated auditor/curator workflow in the current setup. Changes to the collection are reviewed and applied directly.

## Catalog

The current collection contains **111 skills** across **16 functional areas**.

| Functional area | Count | Skills |
| --- | ---: | --- |
| Core / arquitectura / debugging | 7 | `codebase-design`, `domain-modeling`, `diagnosing-bugs`, `tdd`, `typescript-best-practices`, `typescript-advanced-types`, `typescript-security-review` |
| React / Next.js | 10 | `react-dev`, `vercel-react-best-practices`, `react19-source-patterns`, `react19-test-patterns`, `vercel-react-native-skills`, `vercel-react-view-transitions`, `next-best-practices`, `next-cache-components`, `next-cache-components-adoption`, `next-cache-components-optimizer` |
| Prisma ORM | 4 | `prisma-client-api`, `prisma-cli`, `prisma-database-setup`, `prisma-patterns` |
| Prisma Next | 7 | `prisma-next-quickstart`, `prisma-next-build`, `prisma-next-contract`, `prisma-next-migrations`, `prisma-next-queries`, `prisma-next-runtime`, `prisma-next-migration-review` |
| Testing | 5 | `vitest`, `playwright-best-practices`, `playwright-cli`, `javascript-testing-patterns`, `go-testing` |
| Frontend / UI técnico | 8 | `shadcn`, `tailwind-design-system`, `tailwind-responsive-ui`, `tailwindcss-advanced-layouts`, `react-hook-form`, `zod-validation-utilities`, `zustand-5`, `tanstack-table` |
| Diseño / UX | 10 | `ui-design`, `ui-radar`, `frontend-design`, `refactoring-ui`, `ux-heuristics`, `microinteractions`, `web-typography`, `imagegen-frontend-mobile`, `image`, `brandkit` |
| Documentación | 4 | `cognitive-doc-design`, `docs-guardian`, `agents-md-manager`, `project-foundation-manager` |
| Seguridad / web / SEO | 5 | `auth-review`, `schema`, `seo-audit`, `ai-seo`, `site-architecture` |
| Producto / SaaS | 15 | `product-marketing`, `customer-research`, `copywriting`, `copy-editing`, `cro`, `ab-testing`, `analytics`, `pricing`, `signup`, `onboarding`, `paywalls`, `churn-prevention`, `emails`, `launch`, `shipping-and-launch` |
| Research | 6 | `tavily-search`, `tavily-research`, `tavily-crawl`, `tavily-extract`, `tavily-map`, `tavily-dynamic-search` |
| Ideación / definición | 5 | `grilling`, `prototype`, `to-questionnaire`, `enhance-prompt`, `handoff` |
| Archivos / tooling / setup | 3 | `react-pdf`, `turborepo`, `wizard` |
| Gestión de skills | 2 | `skill-creator`, `skill-improver` |
| Infraestructura Gentle AI — PROTECTED | 9 | `branch-pr`, `chained-pr`, `issue-creation`, `work-unit-commits`, `systemic-issue-triage`, `rdd-defect-workflow`, `gentle-ai-bench`, `skill-registry`, `judgment-day` |
| SDD — fuera de auditoría | 11 | `sdd-init`, `sdd-explore`, `sdd-research`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-archive`, `sdd-onboard` |
| **Total** | **111** | |

### First-party Codenburg skills

These are the skills authored and maintained as Codenburg-specific contracts:

| Skill | Purpose |
| --- | --- |
| [`agents-md-manager`](agents-md-manager/SKILL.md) | Manage the `AGENTS.md` lifecycle and its controlled managed region. |
| [`docs-guardian`](docs-guardian/SKILL.md) | Keep project documentation and release/documentation decisions aligned with completed work. |
| [`project-foundation-manager`](project-foundation-manager/SKILL.md) | Establish and maintain a durable project documentation foundation. |

### Gentle AI infrastructure — protected

These skills are part of the Gentle AI workflow/infrastructure and are kept as a coordinated integration rather than judged individually during normal pruning:

```text
branch-pr
chained-pr
issue-creation
work-unit-commits
systemic-issue-triage
rdd-defect-workflow
gentle-ai-bench
skill-registry
judgment-day
```

### SDD workflow — kept as a system

The SDD family is intentionally preserved as a coordinated workflow and is outside normal per-skill pruning:

```text
sdd-init
sdd-explore
sdd-research
sdd-propose
sdd-spec
sdd-design
sdd-tasks
sdd-apply
sdd-verify
sdd-archive
sdd-onboard
```

## Main capability map

The collection is concentrated around the work I actually do:

- software architecture, debugging and TDD;
- TypeScript, React, Next.js and React Native;
- Prisma and database workflows;
- unit, integration and E2E testing;
- Tailwind, shadcn, forms, tables and state management;
- UI design, UX, typography, branding and microinteractions;
- project documentation and repository foundations;
- authentication, security, technical SEO and structured data;
- product marketing, customer research, pricing, onboarding, conversion, analytics and churn;
- web research with Tavily;
- ideation, prototyping, prompt refinement and handoffs;
- project setup and tooling;
- Gentle AI and SDD workflows.

## Repository support directories

Some directories in the working installation are infrastructure rather than invocable skills:

| Path | Role |
| --- | --- |
| `.atl/` | Local/generated workflow state. |
| `.engram/` | Engram state and supporting metadata. |
| `_shared/` | Shared local contracts/support used by coordinated workflows; not an invocable skill. |
| `.git/` | Git repository metadata. |

They are not included in the 111-skill count.

## Maintaining the collection

When adding or removing skills:

1. Prefer the canonical checkout at `~/.config/opencode/skills`.
2. Review the candidate against the skills that already cover the same responsibility.
3. Keep one clear authority for a responsibility unless the scopes are genuinely different.
4. Add or remove the complete skill directory.
5. Update the catalog and counts in this README.
6. Review the diff, commit, and push.

Example:

```bash
cd ~/.config/opencode/skills
git status
git diff
git add -A
git commit -m "chore(skills): refresh curated collection"
git push
```

## Repository structure

```text
skills/
├── README.md
├── AGENTS.md
├── <skill>/
│   ├── SKILL.md
│   ├── references/     # optional
│   ├── scripts/        # optional
│   └── evals/          # optional
├── .engram/            # supporting state when tracked
└── ...
```

The `SKILL.md` contract is the important boundary. Extra files exist only when the skill needs them.

## Philosophy

The goal is not to collect the maximum number of skills. The goal is to keep a set that is broad enough to cover real projects without making multiple skills compete to solve the same problem.

Global availability is useful; **project-level selection is what keeps the runtime focused**.

---

Maintained by [Codenburg](https://github.com/Codenburg).
