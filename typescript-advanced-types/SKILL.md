---
name: typescript-advanced-types
description: "Master TypeScript's advanced type system including generics, conditional types, mapped types, template literals, and utility types for building type-safe applications. Use when implementing complex type logic, creating reusable type utilities, or ensuring compile-time type safety in TypeScript projects."
license: MIT
metadata:
  author: Codenburg
  version: "1.0.0"
---

## Activation Contract

Load this skill when building type-safe libraries, generic utilities, type-driven API clients, form validation systems, strongly-typed config objects, type-safe state machines, or migrating JS codebases to TypeScript with strict typing.

## Hard Rules

- Prefer `unknown` over `any` — enforce type checking with type guards or assertion functions.
- Use `interface` for object shapes (better error messages, declaration merging); use `type` for unions, intersections, conditional types, and mapped types.
- Enable `strict: true` in `tsconfig.json` for production code.
- Use `const` assertions (`as const`) to preserve literal types; prefer type guards over `as` type assertions.
- Cache complex type computations; avoid deeply nested conditional types and unbounded recursion.
- Document non-obvious types with JSDoc and verify them with type-level tests (`AssertEqual`, `Expect<Equal<...>>`).
- Avoid over-using `any`, ignoring strict null checks, missing discriminated unions, missing `readonly` modifiers, circular type references, and unhandled edge cases (empty arrays, null values).

## Decision Gates

| Need | Construct |
|------|-----------|
| Reusable, type-flexible API | `<T>` generics, `T extends Constraint` for bounds |
| Type depends on another type | Conditional types: `T extends X ? Y : Z`, `infer R` |
| Transform every property of a type | Mapped types: `{ [K in keyof T]: ... }` |
| Build string patterns (event names, paths) | Template literal types: `` `on${Capitalize<E>}` `` |
| Pick / omit / readonly / partial built-ins | `Pick`, `Omit`, `Readonly`, `Partial`, `Required`, `Record`, `Exclude`, `Extract`, `NonNullable` |
| Discriminated union narrowing | Tag field + `switch` on the tag (`type`, `status`) |
| Type-safe event emitter / API client / form validator / builder | Worked example in `references/details.md` |

## Execution Steps

1. Enable strict mode in `tsconfig.json`.
2. Pick the construct from the Decision Gates table — do not invent a custom one until the standard ones are exhausted.
3. Implement the type with a short inline example; verify with the compiler.
4. For non-obvious behavior, add a type test (`AssertEqual<A, B>` or `Expect<Equal<A, B>>`).
5. For advanced patterns (event emitter, API client, builder, deep readonly/partial, form validation, discriminated unions, `infer`, type guards, assertion functions), read `references/details.md` for the full worked examples.

## Output Contract

Return:

- The chosen construct and one-line rationale.
- The type definition with a minimal usage example.
- A type test (`AssertEqual` / `Expect`) when the inference is non-obvious.
- `tsconfig` flags actually enabled (do not claim strict without verifying).

## References

- [references/details.md](references/details.md) — worked examples: type-safe event emitter, API client, builder, deep `Readonly`/`Partial`, form validator, discriminated unions, `infer`, type guards, assertion functions.
