---
name: vercel-react-best-practices
description: "React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements."
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

## Activation Contract

Load this skill when writing new React / Next.js components, implementing data fetching (client or server), reviewing code for performance, refactoring existing React / Next.js code, or optimizing bundle size and load times.

## Hard Rules

Apply the highest-priority category first. Each rule has a stable `id` of the form `{prefix}-{name}` and a corresponding file at `rules/{id}.md` with full code examples.

| Priority | Prefix | Category | Impact |
|----------|--------|----------|--------|
| 1 | `async-` | Eliminating Waterfalls | CRITICAL |
| 2 | `bundle-` | Bundle Size Optimization | CRITICAL |
| 3 | `server-` | Server-Side Performance | HIGH |
| 4 | `client-` | Client-Side Data Fetching | MEDIUM-HIGH |
| 5 | `rerender-` | Re-render Optimization | MEDIUM |
| 6 | `rendering-` | Rendering Performance | MEDIUM |
| 7 | `js-` | JavaScript Performance | LOW-MEDIUM |
| 8 | `advanced-` | Advanced Patterns | LOW |

Non-negotiable rules:

- `async-parallel` — use `Promise.all()` for independent operations.
- `async-defer-await` — move `await` into the branch that uses the value.
- `async-suspense-boundaries` — use `<Suspense>` to stream content, do not block the wrapper.
- `bundle-barrel-imports` — import directly from source; never via `index.ts` re-exports.
- `bundle-dynamic-imports` — use `next/dynamic` for heavy components.
- `server-auth-actions` — authenticate every Server Action inside the action body, not in middleware.
- `server-cache-react` — use `React.cache()` for per-request deduplication.
- `server-parallel-fetching` — restructure components so independent fetches run in parallel.
- `client-swr-dedup` — use SWR (or TanStack Query) for client-side deduplication.
- `rerender-derived-state` and `rerender-derived-state-no-effect` — derive state during render, never in `useEffect`.
- `rerender-functional-setstate` — use functional `setState` to avoid stale closures.
- `rerender-defer-reads` — do not subscribe to state used only in callbacks.
- `rerender-no-inline-components` — never define components inside components.
- `rendering-conditional-render` — use ternary, not `&&`, when the value can be `0` or `NaN`.
- `rendering-hydration-suppress-warning` — only suppress expected hydration mismatches.
- `js-set-map-lookups` / `js-index-maps` — use `Set` / `Map` for repeated lookups.
- `js-tosorted-immutable` — use `.toSorted()` not `.sort()` to keep React state immutable.
- `advanced-effect-event-deps` — never put `useEffectEvent` results in dependency arrays.

## Decision Gates

| Task | Open these rule files |
|------|----------------------|
| Add a new feature with data fetching | `async-parallel`, `server-cache-react`, `server-parallel-fetching`, then category-specific rules |
| Review a PR for performance | Walk priorities 1→8; for each issue, look up the matching `rules/{id}.md` |
| Refactor existing component for re-renders | `rerender-*` + `rendering-*` |
| Cut bundle size | `bundle-*` (barrel imports, dynamic imports, defer third-party, conditional loading, preload) |
| Optimize a hot path / micro-perf | `js-*` (Set/Map, index maps, cache, early returns, `toSorted`, `flatMap`, hoist RegExp) |
| Server Action / Route Handler | `server-auth-actions`, `server-cache-react`, `server-serialization`, `server-after-nonblocking` |

## Execution Steps

1. Identify which priority category applies (waterfalls → bundle → server → client → re-render → rendering → JS → advanced).
2. Open the matching `rules/{prefix}-{name}.md` file for the full incorrect / correct example and rationale.
3. Apply the rule to the code under review; record the `id` of every rule that was applied.
4. For comprehensive guidance or a full read, see `AGENTS.md` (the compiled guide with all 40+ rules expanded).
5. Verify with a measurement when the rule is performance-critical (`async-parallel`, `bundle-barrel-imports`, `server-parallel-fetching`) — bundle size, render time, or request latency.

## Output Contract

Return:

- Category(ies) touched and the `id` of every applied rule (e.g., `async-parallel`, `bundle-barrel-imports`).
- For each applied rule: a one-line diff summary or commit reference.
- Measured impact when available (bundle size delta, render time, request latency).
- A short follow-up list of any rule that was considered but not applied (with reason).

## References

- `AGENTS.md` — compiled full guide with all 40+ rules expanded (bad / good examples + impact).
- `rules/{prefix}-{name}.md` — one file per rule (e.g., `rules/async-parallel.md`, `rules/bundle-barrel-imports.md`).
- `README.md` — rule file format, naming convention, and how to add new rules.
- `metadata.json` — document version and abstract.
