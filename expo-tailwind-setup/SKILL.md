---
name: expo-tailwind-setup
description: "Set up Tailwind CSS v4 in Expo with react-native-css and NativeWind v5 for universal styling across iOS, Android, and Web."
license: MIT
metadata:
  author: Codenburg
  version: "1.0.0"
---

## Activation Contract

Load this skill when setting up Tailwind v4 styling in an Expo project, integrating `react-native-css` + NativeWind v5, migrating from NativeWind v4 / Tailwind v3, or building CSS-wrapped component primitives for iOS / Android / Web.

## Hard Rules

- Do NOT create a `babel.config.js` for Tailwind. NativeWind v5 + Tailwind v4 are CSS-first; any `babel-preset-expo` `jsxImportSource: "nativewind"` or `nativewind/babel` preset must be removed.
- Runtime install must include all four: `nativewind@preview`, `react-native-css`, `react-native-reanimated`, `react-native-safe-area-context`. Reanimated and safe-area-context are required peer dependencies in v5, not optional.
- Tailwind minimum is `tailwindcss@^4.1` (not `^4`). Dev deps: `tailwindcss`, `@tailwindcss/postcss`, `postcss`.
- Add `lightningcss` resolution (`"1.30.1"`) in `package.json`. Do NOT add `autoprefixer` — Expo + lightningcss covers it.
- `global.css` MUST have four `@import` lines: `tailwindcss/theme.css` (layer theme), `tailwindcss/preflight.css` (layer base), `tailwindcss/utilities.css`, and `nativewind/theme`. The fourth line loads NativeWind-specific tokens (elevation scales, platform variants).
- Two valid approaches for `className` on primitives: import rewrite from `react-native-css/react-native` (modern, recommended — no wrappers needed) OR `useCssElement` wrapper per primitive (legacy, valid alternative — see `references/setup-guide.md`).
- Never use `@tailwind base/components/utilities` (v3 syntax). Never create `tailwind.config.js` / `tailwind.config.ts`; use `@theme { ... }` in CSS.
- Configure `metro.config.js` with `withNativewind(config, { inlineVariables: false, globalClassNamePolyfill: false })`. `inlineVariables: false` is required for `PlatformColor` in CSS variables to work.
- For `useCSSVariable` on native, use `useFunctionalVariable` from `react-native-css`; on web, return `var(${name})`.

## Decision Gates

| Need | Edit / Create |
|------|---------------|
| Bundler / className support | `metro.config.js` (wrap with `withNativewind`) |
| PostCSS plugin chain | `postcss.config.mjs` (`@tailwindcss/postcss`) |
| Theme, preflight, utilities, NativeWind tokens, platform fonts | `src/global.css` + `src/css/*.css` |
| className on primitives (modern) | Import from `react-native-css/react-native` |
| className on primitives (legacy) | `src/tw/index.tsx`, `src/tw/image.tsx`, `src/tw/animated.tsx` |
| Apple semantic colors (blue, label, etc.) | `src/css/sf.css` with `@media ios` `platformColor()` + web `light-dark()` |
| Consuming a CSS variable in JS | `useCSSVariable("--your-var")` from `@/tw` |

## Execution Steps

1. Runtime: `npx expo install nativewind@preview react-native-css react-native-reanimated react-native-safe-area-context`.
2. Dev deps: `npx expo install --dev tailwindcss @tailwindcss/postcss postcss`.
3. Add the `lightningcss` resolution to `package.json`.
4. Create `metro.config.js`, `postcss.config.mjs`, and `src/global.css` with all four `@import` lines (full code in `references/setup-guide.md`).
5. Enable className on primitives — pick ONE approach:
   - Modern: import from `react-native-css/react-native` in app code.
   - Legacy: create `src/tw/{index,image,animated}.tsx` wrappers via `useCssElement`.
6. Import `src/global.css` from the app entry.
7. Follow `references/setup-guide.md` for the full Metro / PostCSS / CSS / wrapper / theme / troubleshooting reference.

## Output Contract

A working Expo + Tailwind v4.1 + react-native-css + NativeWind v5 setup where:

- `metro.config.js`, `postcss.config.mjs`, `src/global.css` exist and are wired up.
- No `babel.config.js` for Tailwind, no `autoprefixer`, no `tailwind.config.*`.
- `global.css` has all four `@import` lines including `nativewind/theme`.
- `className` works on primitives (via import rewrite OR `src/tw/*` wrappers).
- `useCSSVariable("--name")` returns the resolved CSS variable on both web and native.
- Platform colors render via `platformColor()` on iOS and `light-dark()` on web / Android.

## References

- [references/setup-guide.md](references/setup-guide.md) — full Metro / PostCSS / global CSS / `src/tw/*` / theme tokens / Apple system colors / troubleshooting.
