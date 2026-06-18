---
name: typescript-react-reviewer
description: "Expert code reviewer for TypeScript + React 19 applications. Use when reviewing React code, identifying anti-patterns, evaluating state management, or assessing code maintainability. Triggers: code review requests, PR reviews, React architecture evaluation, identifying code smells, TypeScript type safety checks, useEffect abuse detection, state management review."
license: MIT
metadata:
  author: Codenburg
  version: "1.0.0"
---

## Activation Contract

Load this skill when asked to review React + TypeScript code, audit a PR for anti-patterns, evaluate state management choices, validate React 19 hook usage (`useActionState`, `useOptimistic`, `use`, `useFormStatus`), or assess code maintainability.

## Hard Rules

- Critical issues BLOCK the merge: derived state in `useEffect`, missing `useEffect` cleanup, direct state mutation (`.push` / `.splice` / `arr[i] =`), conditional hook calls, `key={index}` in dynamic lists, unjustified `any`, `useFormStatus` in the same component as `<form>` (returns `false`), and promises created in render with `use()`.
- High priority issues: incomplete dependency arrays (stale closures), props typed as `any`, unjustified `useMemo` / `useCallback`, missing error boundaries, controlled input initialized with `undefined`.
- Architecture / style: components over 300 lines, prop drilling deeper than 2-3 levels, state placed far from where it is used, custom hooks without a `use` prefix.
- Never copy server data into local state with `useEffect` — the query (`useQuery` / `useSWR`) is the source of truth.
- Never suppress `react-hooks/exhaustive-deps` — fix the root cause instead.
- Never define components inside components — they remount on every render and lose state.
- Never use `useState(undefined)` for inputs — use an empty string default.
- `tsconfig.json` must enable `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `exactOptionalPropertyTypes`.
- Avoid barrel files (`index.ts` re-exports) in app code — import directly from the source file.

## Decision Gates

| Severity | Action |
|----------|--------|
| Critical (block merge) | Report and require fix before merge |
| High | Report and require fix in same PR |
| Architecture / style | Report as suggestion; defer to author |
| Theoretically possible but not a realistic use case | Note as `INFO` only; do not block |

## Execution Steps

1. Scan the diff for the Critical issues table first; these block the merge outright.
2. Check React 19 hook usage — see `references/react19-patterns.md` for new API patterns and pitfalls.
3. Evaluate state management — colocate state, separate server state (TanStack Query / SWR) from client state (Zustand / Jotai / `useState`).
4. Assess TypeScript safety — generic components, discriminated unions, strict config, no unjustified `any`.
5. Review maintainability — component size, custom hook design, folder structure, no barrel files.
6. For each issue, report: severity, file:line, the offending pattern, and the fix (link to `references/antipatterns.md` for the full catalog and `references/checklist.md` for the complete review checklist).

## Output Contract

Return a per-issue report:

| Severity | Location | Pattern | Fix |
|----------|----------|---------|-----|

Group issues: Critical → High → Architecture. Reference the specific `references/*.md` file for the fix pattern. End with a one-line verdict: `APPROVE` / `REQUEST CHANGES (N critical, M high)` / `COMMENT ONLY`.

## References

- [references/antipatterns.md](references/antipatterns.md) — full anti-pattern catalog with ❌/✅ examples.
- [references/checklist.md](references/checklist.md) — complete code review checklist.
- [references/react19-patterns.md](references/react19-patterns.md) — React 19 new hooks, Server / Client Component boundaries.
