<!-- agents-md-manager:managed:start -->
## Project essentials

- This is a personal collection of 91 versioned OpenCode skills. Projects select only the skills useful to their work.
- README.md explains the collection and current catalog; this file defines how to work in the repository.
- Add, update, and remove skills manually. Keep README.md aligned when the versioned catalog materially changes.
- Ignored local integrations are not authority for the versioned collection.

## Commands

- Inspect state: `git status`.
- Review changes: `git diff` and `git diff --check`.
- Verify the root manager: `node --test agents-md-manager/scripts/agents-md-region.test.mjs` and `node --check agents-md-manager/scripts/agents-md-region.mjs`.

## Context routing

- Root AGENTS.md work must use agents-md-manager/SKILL.md and agents-md-manager/references/agents-md-contract.md.
- Use docs-guardian/SKILL.md when its activation contract applies.
- Use project-foundation-manager/SKILL.md for applicable project-foundation work.

## Mandatory workflows

- Keep exploration, verification, and review proportional: use narrow scope, mechanical evidence before semantic exploration, and no recursive investigation without a concrete blocker.
- Verify with deterministic checks and targeted tests first, then Git status, diff checks, and targeted diffs. Stop once required checks pass, scope is clean, and no blocker remains.
- Engram is advisory memory, never authority; current versioned filesystem and Git evidence win.
- Graphify is advisory and read-only. Do not generate or mutate its output without an explicit request or workflow authorization.

## Source precedence

- The versioned filesystem and Git state establish what exists.
- README.md is the current catalog and collection documentation.
- Each versioned SKILL.md defines its activation contract and behavior.
- Report material source conflicts instead of guessing.
<!-- agents-md-manager:managed:end -->
