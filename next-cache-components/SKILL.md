---
name: next-cache-components
description: "Trigger: Next.js 16 PPR, use cache, cacheLife, cacheTag, updateTag. Cache Components in Next.js 16+ — Partial Prerendering, use cache directive, and cache invalidation."
license: Apache-2.0
metadata:
  author: Codenburg
  version: "1.1"
---

## Activation Contract

Load this skill when using Next.js 16 Cache Components, Partial Prerendering, the `use cache` directive, or migrating from `unstable_cache` to Cache Components.

## Hard Rules

- Enable Cache Components with `cacheComponents: true` in `next.config.ts` (replaces `experimental.ppr`).
- `use cache` functions CANNOT access `cookies()`, `headers()`, or `searchParams` — pass them as arguments instead.
- Use `'use cache: private'` only when you must access runtime APIs inside a cached function (compliance/compatibility).
- Edge runtime does NOT support Cache Components — requires Node.js.
- The `unstable_cache` API is replaced by `use cache` — do not use it in new code.

## Three Content Types

| Type | Mechanism | When to Use |
|------|-----------|-------------|
| **Static** | Auto-prerendered | Synchronous code, imports, pure computations |
| **Cached** | `'use cache'` | Async data that doesn't need fresh fetches every request |
| **Dynamic** | Suspense boundary | Runtime data that must be fresh per request |

## `use cache` Directive

```tsx
// File-level — entire page is cached
'use cache'
export default async function Page() { ... }

// Component-level
async function CachedComponent() {
  'use cache'
  const data = await fetchData()
  return <div>{data}</div>
}

// Function-level
export async function getData() {
  'use cache'
  return db.query('SELECT * FROM posts')
}
```

### Cache Profiles

```tsx
'use cache'               // Default: 5m stale, 15m revalidate
'use cache: remote'       // Platform-provided cache (Redis, KV)
'use cache: private'      // For compliance, allows runtime APIs
```

### `cacheLife()` — Custom Lifetime

```tsx
cacheLife('hours')                       // Built-in: default/minutes/hours/days/weeks/max
cacheLife({ stale: 3600, revalidate: 7200, expire: 86400 })  // Inline config
```

### `cacheTag()` / `updateTag()` / `revalidateTag()` — Invalidation

```tsx
import { cacheTag, updateTag, revalidateTag } from 'next/cache'

async function getProducts() {
  'use cache'
  cacheTag('products')
  return db.products.findMany()
}

// Immediate invalidation — same request sees fresh data
updateTag(`product-${id}`)

// Background revalidation — next request sees fresh data
revalidateTag('posts')
```

## Runtime Data Constraint

Runtime APIs inside `use cache` are NOT allowed. Extract outside and pass as arguments:

```tsx
// ❌ Wrong — runtime API inside use cache
async function CachedProfile() {
  'use cache'
  const session = (await cookies()).get('session')?.value  // Error!
}

// ✅ Correct — extract outside, pass as argument
async function ProfilePage() {
  const session = (await cookies()).get('session')?.value
  return <CachedProfile sessionId={session} />
}

async function CachedProfile({ sessionId }: { sessionId: string }) {
  'use cache'
  // sessionId becomes part of cache key
  const data = await fetchUserData(sessionId)
  return <div>{data.name}</div>
}
```

Exception: `'use cache: private'` allows runtime APIs for compliance scenarios.

## Migration from Legacy APIs

| Old | Replacement |
|-----|-------------|
| `experimental.ppr` | `cacheComponents: true` |
| `dynamic = 'force-dynamic'` | Remove (default behavior) |
| `dynamic = 'force-static'` | `'use cache'` + `cacheLife('max')` |
| `revalidate = N` | `cacheLife({ revalidate: N })` |
| `unstable_cache()` | `'use cache'` directive |

See [references/migration-guide.md](references/migration-guide.md) for full migration examples.

## Output Contract

Return the cache strategy used (static/cached/dynamic), cache profiles applied, cache tags, and any migration steps from legacy APIs.

## References

- [Cache Components Guide](https://nextjs.org/docs/app/getting-started/cache-components)
- [use cache Directive](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [references/migration-guide.md](references/migration-guide.md) — full migration from `unstable_cache` and legacy patterns
