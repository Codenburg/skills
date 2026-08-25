---
name: agents-md-manager
description: "Manage the root AGENTS.md context-routing region with explicit init, update, and audit workflows."
disable-model-invocation: true
user-invocable: true
license: MIT
metadata:
  author: "Codenburg"
  version: "1.0"
---

## Activation Contract

Use only when the user explicitly invokes `/agents-md-manager init`, `/agents-md-manager update`, or `/agents-md-manager audit`. Manage the root `AGENTS.md` lifecycle as an evidence-based context router; nested `AGENTS.md` files are read-only evidence.

## Hard Rules

- Own exactly one region delimited by `<!-- agents-md-manager:managed:start -->` and `<!-- agents-md-manager:managed:end -->`.
- The prefix through the start marker and suffix from the end marker onward must remain byte-for-byte unchanged; never reorder, normalize, rewrite, move, or delete manual content outside the single managed region.
- `audit` is read-only. `init` creates only a missing root `AGENTS.md`. `update` mutates only a valid managed region; unmanaged adoption requires explicit approval, and malformed input stops without mutation.
- Route only existing, evidence-backed, repository-relative sources. Read selectively; never dump Markdown recursively or copy `.env` material.
- Use project-declared precedence when present. Otherwise report `CONFLICTING_CONTEXT` with both paths, claims, affected rule, and missing evidence, then omit uncertain guidance.
- Keep this skill dependency-free and script-free unless a deterministic need is proven; v1 has no helper.
- Do not create manifests, metadata, shared state, scripts, watchers, hooks, databases, Graphify updates, or generic skill catalogs.

## Decision Gates

| Mode/state | Action |
| --- | --- |
| `init` + `ABSENT` | Inspect bounded evidence and create the root managed region only. |
| `init` + any present state | Report the state; change nothing. |
| `update` + `MANAGED` | Rebuild only the region interior and verify the outside is unchanged. |
| `update` + `UNMANAGED` | Request explicit adoption approval; otherwise change nothing. |
| `update` + `MALFORMED` or `ABSENT` | Stop and report; change nothing. |
| `audit` + any state | Report evidence and preservation checks; change nothing. |

## Execution Steps

1. Establish the worktree root, classify the root file, and load [`references/agents-md-contract.md`](references/agents-md-contract.md). Complete this classification before reading project content.
2. Read only high-signal indexes, manifests, task runners, CI/test configuration, and task-relevant docs or source. Record routes, commands, explicit precedence, stale pointers, and unresolved conflicts.
3. Build a concise managed region from validated relative paths and evidenced commands. Keep runtime context classes ephemeral; persist no new manifest.
4. Apply the mode/state gate, then reclassify and compare the pre/post prefix and suffix. The only permitted project mutation is root `AGENTS.md`.

## Output Contract

Return the mode, state, mutation result, routed sources, evidenced commands, preservation result, conflicts, and next action. State `Files changed: None` for read-only or stopped paths and name `CONFLICTING_CONTEXT` findings exactly.

## References

- [`references/agents-md-contract.md`](references/agents-md-contract.md) — marker, routing, evidence, safety, and verification contract.
