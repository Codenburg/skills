# Root AGENTS.md manager contract

This contract defines the behavior behind the three explicit modes in `SKILL.md`. It is a lifecycle and routing contract, not a documentation generator.

## Managed-region contract

The only owned region is the half-open text range beginning with the exact line marker `<!-- agents-md-manager:managed:start -->` and ending with the exact line marker `<!-- agents-md-manager:managed:end -->`.

Classify the root `AGENTS.md` as follows:

| State | Evidence |
| --- | --- |
| `ABSENT` | The root file does not exist. |
| `MANAGED` | Exactly one start marker and one end marker exist, in that order, with one managed region. |
| `UNMANAGED` | The root file exists and contains neither marker. |
| `MALFORMED` | A marker is missing, duplicated, nested, or ordered incorrectly. |

Read the file without newline or encoding normalization. For a managed update, preserve the exact prefix through the start marker and exact suffix from the end marker onward; replace only the bytes between the markers. Validate that the result still contains exactly one ordered pair. A managed region is wholly owned by this skill; manual content outside it is not.

`init` inspects a present file and reports its state without changing it. With `ABSENT`, it may inspect evidence and create only the root file. `update` with `ABSENT` reports that `init` is required. With `UNMANAGED`, ask for explicit adoption approval. After approval, append one managed region at the end while leaving the existing content untouched; never silently wrap, rewrite, or reformat it. `MALFORMED` always stops without mutation and requires manual repair before another update. `audit` never writes.

## Evidence router

Use this bounded navigation order to find evidence, not as a source-precedence rule:

1. Read the root README or documented index for project purpose, structure, commands, and named sources.
2. Inspect the relevant package/build manifest, task runner, scripts, CI configuration, and test configuration for exact commands and boundaries.
3. Follow only task-relevant links into architecture docs, specifications, decision records, or narrowly validated source/config files.
4. Inspect existing project instruction files and `opencode.json` only to understand already-declared routing. Preserve their ownership and configuration.

Persist a route only when its target exists, its relevance is clear, and its relationship is supported by a project index, manifest, script, task runner, CI/test config, explicit instruction, or a narrowly validated source/config claim. Use repository-relative paths. Keep each route conditional and small: `condition → path → reason`. Record commands only when their exact spelling is evidenced; never invent flags or substitute a familiar framework command.

Prefer pointers over copied prose. Do not recursively read every Markdown file. Do not enumerate skill directories, registry rows, or generic capability catalogs. A logical skill reference is permitted only when an existing project governance source makes that particular workflow mandatory; the manager never creates a catalog or invokes `project-foundation-manager`.

## Runtime context classes

Use these classes only while reasoning about evidence; never persist their labels in `AGENTS.md`, a manifest, hidden state, or a generated index:

| Class | Runtime meaning |
| --- | --- |
| `INLINE` | Small evidence needed directly for the current decision. |
| `ROUTED` | A durable pointer belongs in the managed region. |
| `SITUATIONAL` | Route only for a named task, domain, or workflow. |
| `GENERATED` | Derived output; use only when the task is about that output, never as authority by default. |
| `HISTORICAL` | Release, roadmap, or Git history; use only for history or planning questions. |
| `IRRELEVANT` | Not useful for the current task; do not load or route it. |

Treat `ROADMAP`, `CHANGELOG`, archived proposals, and historical specs as `HISTORICAL` or `SITUATIONAL` unless the project explicitly identifies a current contract. Use a docs index to select one relevant specification instead of dumping a whole tree. Treat generated registries, Graphify output, caches, and build artifacts as `GENERATED` and non-authoritative.

## Precedence and conflict handling

Look for an explicit project rule named `precedence`, `source of truth`, `authority`, or equivalent. Follow that rule as evidence and route to the file that defines it. OpenCode's instruction-loading behavior is not project source precedence: do not invent an order between README, code, specs, history, or skills.

When two existing sources make incompatible claims and no explicit project precedence resolves them, emit:

```text
CONFLICTING_CONTEXT
- Path A: <repository-relative path>; claim: <claim>
- Path B: <repository-relative path>; claim: <claim>
- Affected rule: <routing or project rule>
- Missing evidence: <precedence or verification still needed>
```

Omit the uncertain route or rule from the candidate managed region. Stable, unrelated routes may still be retained. Never choose the more recent-looking, more detailed, or more familiar source without evidence. If an explicit precedence source itself conflicts with another precedence source, report both and omit the affected guidance unless a higher project-declared rule resolves it.

For a moved pointer, search only authoritative indexes, manifests, scripts, task runners, CI, and direct references for a replacement. If evidence proves a new relative path, report the stale path and route the replacement. If no replacement is proven, report the broken source and omit the route; never guess.

## Safety and responsibility boundaries

- Manage only the root `AGENTS.md`; nested `AGENTS.md` and `CLAUDE.md` files are read-only evidence. Never create or update nested instruction files.
- Existing project-foundation-style documents, directories, and configuration are ordinary evidence when relevant. Consume them without changing them. The manager has no dependency on a foundation manager, metadata, shared state, or coupling manifest.
- Never read, print, copy, or persist values from `.env` or other secret-bearing environment files. Use safe setup documentation or non-secret configuration declarations instead.
- Do not rewrite `opencode.json`; its `instructions` entries are a separate native routing mechanism. Do not duplicate remote instructions into `AGENTS.md`.
- OpenCode discovers skills through `SKILL.md` independently from persistent project instructions. Do not reproduce the global skill catalog in the managed region.
- Do not make Graphify, a daemon, watcher, hook, framework, database, OpenSpec manager, or general docs manager part of this skill.

## Verification and report

Before any permitted write, retain the original root-file content and the proposed region. Afterward verify the marker count/order, every persisted path is repository-relative and exists, every command has evidence, and the original outside-region prefix/suffix are unchanged. For adoption, verify that the prior unmanaged content is the exact prefix of the result. For `audit` and all stopped gates, state `Files changed: None` and do not report a simulated mutation.

Return a compact report with `Mode`, `State`, `Mutation`, `Routes`, `Commands`, `Preservation`, `Conflicts`, and `Next action`. Include the relevant evidence paths and distinguish `CONFLICTING_CONTEXT` from a missing or stale source.
