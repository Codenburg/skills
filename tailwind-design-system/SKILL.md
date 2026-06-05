---
name: tailwind-design-system
description: "Trigger: Tailwind CSS v4, design tokens, component libraries, responsive patterns, dark mode. Build scalable design systems with Tailwind CSS v4, CSS-first configuration, and design tokens."
license: Apache-2.0
metadata:
  author: Codenburg
  version: "1.1"
---

## Activation Contract

Load this skill when creating a component library with Tailwind v4, implementing design tokens, building responsive/accessible components, standardizing UI patterns, or migrating from Tailwind v3 to v4.

## Hard Rules

- Use `@theme` in CSS for configuration — never `tailwind.config.ts` (v4 removes it).
- Use `@import "tailwindcss"` — never `@tailwind base/components/utilities` (v3 syntax).
- Use OKLCH colors for better perceptual uniformity than HSL.
- Use semantic tokens (`bg-primary`, `text-muted-foreground`) — never raw colors.
- Use `size-*` instead of `w-* h-*` for equal dimensions.
- Use `@custom-variant dark` for class-based dark mode.
- Prefer CSS `@keyframes` inside `@theme` blocks for animations.
- Use `@utility` for custom utilities instead of Tailwind plugins.

## Key v4 Changes from v3

| v3 Pattern | v4 Pattern |
|------------|------------|
| `tailwind.config.ts` | `@theme` in CSS |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| `darkMode: "class"` | `@custom-variant dark` |
| `theme.extend.colors` | `@theme { --color-*: value }` |
| `require("tailwindcss-animate")` | CSS `@keyframes` in `@theme` |
| `h-10 w-10` | `size-10` |

## Design Token Hierarchy

```
Brand Tokens (abstract)
    └── Semantic Tokens (purpose)
        └── Component Tokens (specific)

Example: oklch(45% 0.2 260) → --color-primary → bg-primary
```

## Execution Steps

1. Set up CSS-first config with `@import "tailwindcss"` and `@theme` block.
2. Define semantic color tokens using OKLCH.
3. Configure dark mode with `@custom-variant dark`.
4. Build components using CVA (Class Variance Authority) for type-safe variants.
5. Use `size-*`, `gap-*`, `truncate` shorthands — avoid v3 patterns.
6. Move animations to `@keyframes` inside `@theme`.

## Component Architecture

```
Base styles → Variants → Sizes → States → Overrides
```

Use CVA pattern with `@radix-ui/react-slot` for polymorphic components. React 19: no `forwardRef` needed — `ref` is a regular prop.

## Utility Functions

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## v3 to v4 Migration Checklist

- [ ] Replace `tailwind.config.ts` with CSS `@theme` block
- [ ] Change `@tailwind` directives to `@import "tailwindcss"`
- [ ] Move colors to `@theme { --color-*: value }`
- [ ] Replace `darkMode: "class"` with `@custom-variant dark`
- [ ] Move `@keyframes` inside `@theme` blocks
- [ ] Replace `require("tailwindcss-animate")` with native CSS animations
- [ ] Update `h-10 w-10` to `size-10`
- [ ] Replace custom plugins with `@utility` directives
- [ ] Consider OKLCH colors
- [ ] Remove `forwardRef` (React 19 passes ref as prop)

## Output Contract

Return the CSS configuration, component patterns used, migration steps applied, and any custom utilities or theme tokens created.

## References

- [references/theme-setup.md](references/theme-setup.md) — full CSS configuration, dark mode, advanced v4 CSS patterns
- [references/component-patterns.md](references/component-patterns.md) — CVA Button, Card, Input, Grid, Dialog, ThemeProvider code examples
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
