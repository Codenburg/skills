---
name: find-skills
description: "Trigger: how do I do X, find a skill for X, is there a skill that can. Discover and install skills from the open agent skills ecosystem."
license: Apache-2.0
metadata:
  author: Codenburg
  version: "1.1"
---

## Activation Contract

Use this skill when the user asks how to do a common task, wants to find an existing skill for a capability, or expresses interest in extending agent capabilities. Do NOT use for tasks that are trivially handled by general knowledge.

## Hard Rules

- Always try `npx skills find <query>` before suggesting manual workarounds.
- Present multiple options when the search returns relevant results.
- If no skill exists, offer to help directly and suggest creating a custom skill.
- Never install skills without user confirmation.

## Decision Gates

| Situation | Action |
|-----------|--------|
| User asks "how do I do X" | Search skills with `npx skills find "X"` |
| User asks "find a skill for X" | Search with relevant keywords, present options |
| User says "can you do X" | Check if a skill exists, otherwise offer direct help |
| No skill found | Acknowledge, offer direct help, suggest `npx skills init` |
| User wants to install | Install with `npx skills add <package> -g -y` after confirmation |

## Execution Steps

### Step 1 — Understand the need

Identify the domain (React, testing, design, etc.) and the specific task.

### Step 2 — Search

```bash
npx skills find [query]
```

Try specific keywords: "react testing" works better than "testing". Try alternative terms if the first search fails.

### Step 3 — Present options

Return skill name, description, install command, and link to skills.sh.

```
I found a skill that might help! The "X" skill provides Y.
To install: npx skills add <owner/repo@skill>
Learn more: https://skills.sh/...
```

### Step 4 — Install on confirmation

```bash
npx skills add <owner/repo@skill> -g -y
```

The `-g` flag installs globally (user-level) and `-y` skips confirmation.

## Output Contract

Return:
- Search query used and results found.
- Skills presented with install command and source URL.
- Installation result if user confirmed.
- Fallback path if no skill found.

## Common Skill Categories

| Category | Example Queries |
|----------|----------------|
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing | testing, jest, playwright, e2e |
| DevOps | deploy, docker, kubernetes, ci-cd |
| Documentation | docs, readme, changelog, api-docs |
| Code Quality | review, lint, refactor, best-practices |
| Design | ui, ux, design-system, accessibility |
| Productivity | workflow, automation, git |

## References

- [Skills CLI](https://skills.sh/) — browse and search available skills
