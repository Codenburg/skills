## Skills management

This repository is the canonical curated skills collection used by OpenCode.

The canonical installation is:

```text
~/.config/opencode/skills
```

A separate upstream/download tree may exist at:

```text
~/.agents/skills
```

Treat the canonical repository as the selected day-to-day collection. Skills may remain globally available while individual projects explicitly choose which ones they use.

### Curation rules

When adding, replacing, or removing skills:

- Review the candidate against the skills already present.
- Keep it only when it adds a distinct capability that is realistically useful for development, product work, or an active project.
- Remove it when another retained skill already performs the same responsibility well enough.
- Prefer focused skills over routers, wrappers, duplicate authorities, or broad meta-workflows.
- Do not keep specialized marketing, sales, PR, agency, or channel-operations skills without a concrete use case.
- Technical skills may remain even when niche when their capability is genuinely distinct.
- Product and SaaS skills may remain when they directly help build, launch, operate, measure, or improve a product.
- Apply skill-directory changes directly and review the resulting Git diff.
- Do not recreate the retired `skills-auditor` / `skills-curator` workflow unless explicitly requested.

The current filesystem and Git state are the source of truth for what is actually in the collection. The README documents the intended catalog and should be updated when the collection materially changes.

### Protected / coordinated families

Do not prune the following as isolated skills during ordinary cleanup:

- Gentle AI infrastructure and workflow skills marked as protected in `README.md`.
- The `sdd-*` family, which is treated as a coordinated workflow.
- `_shared/`, which is support infrastructure and is not an invocable skill.

If one of these systems needs redesign or removal, review the family as a whole instead of deleting individual pieces opportunistically.

## Bounded orchestration

Keep delegated exploration, verification, and review finite and proportional to the task.

### Delegation

- Delegate only narrowly defined questions with explicit scope and a clear stopping condition.
- Do not delegate open-ended repository-wide exploration when direct inspection, Git evidence, or targeted tests can answer the question.
- Do not recursively delegate exploration from an exploratory or verification subagent unless a concrete blocker makes it necessary.
- Do not use a generic security or correctness review as a substitute for the specific verification requested by the current workflow.
- A final scope review must verify the requested scope, not reopen the entire architecture for investigation.

### Evidence budget

Prefer mechanical evidence before semantic exploration.

Use this order for final verification:

1. targeted deterministic checks;
2. targeted tests and regression suites;
3. `git status`, `git diff --check`, and targeted diffs;
4. targeted source inspection only for a concrete failure, blocker, or unresolved assertion.

Additional rules:

- Do not reread previously inspected files unless a concrete failing test or unresolved finding requires that evidence.
- Do not continue exploring merely to increase confidence after the required checks pass.
- New speculative security, race, TOCTOU, performance, or correctness hypotheses discovered during final verification are deferred unless:
  - they are directly relevant to the requested workflow; and
  - they are supported by reproducible evidence or a failing check.
- Do not turn speculative hypotheses into recursive investigation during a bounded verification task.

### Stop conditions

Once:

- required tests pass;
- required deterministic checks pass;
- scope contains no unexpected changes;
- no concrete blocker remains; and
- the requested plan, report, or result can be produced;

stop exploring and produce the result.

Do not continue auditing unrelated components after the task's acceptance criteria have been satisfied.

## Context recovery and Engram

Use Engram for durable working memory, rationale, checkpoints, and recovery across long-running sessions and compactations.

- After context compaction or session recovery, recover the latest relevant Engram checkpoint before rereading repository context.
- Resume from completed work instead of reconstructing the investigation from scratch.
- Do not reread files or redo completed analysis merely because the context window was compacted.
- Persist compact checkpoints at meaningful workflow boundaries when useful.
- Checkpoints should record completed work, remaining work, important decisions, blockers, and next steps—not full source dumps or lengthy investigation transcripts.
- Engram is advisory memory, not authority.
- Engram cannot establish filesystem state, Git state, freshness, ownership, or authorization.
- When Engram conflicts with current repository evidence, current repository evidence wins.
- Keep memory retrieval bounded and relevant to the current task.

## Graphify

Use Graphify as a read-only advisory index when a valid existing graph helps narrow repository context.

- Graphify may help with queries, relationships, explanations, and bounded discovery.
- Graphify does not establish ownership, authority, freshness, or approval.
- Failure, absence, or staleness of Graphify does not authorize open-ended repository exploration.
- Do not automatically create, regenerate, update, cluster, or otherwise mutate `graphify-out/` because repository files changed.
- Commands that mutate Graphify output require either:
  - an explicit user request; or
  - explicit authorization from the workflow currently being executed.
- Modifying code, documentation, skills, or other repository files is not implicit permission to update Graphify.
- A workflow's approved scope takes precedence over general Graphify maintenance guidance.

<!-- agents-md-manager:managed:start -->
## Project essentials

- This is the canonical curated Agent Skills repository used by Codenburg/OpenCode.
- Root `AGENTS.md` is a concise router and global policy. OpenCode discovers root-level `SKILL.md` contracts independently.
- The active collection is intentionally broad globally; individual projects select the skills they need.
- See `README.md` for the current catalog, protected families, and maintenance model.

## Commands

- Inspect repository state: `git status`
- Review changes: `git diff` and `git diff --check`
- Root manager checks: `node --test agents-md-manager/scripts/agents-md-region.test.mjs` and `node --check agents-md-manager/scripts/agents-md-region.mjs`
- Commit the complete intended collection change with `git add -A` only after reviewing deletions and additions.

## Context routing

- Root `AGENTS.md` lifecycle work MUST route through `agents-md-manager/SKILL.md` and `agents-md-manager/references/agents-md-contract.md`.
- Documentation alignment work should use `docs-guardian/SKILL.md` when its activation contract applies.
- Durable project-foundation work should use `project-foundation-manager/SKILL.md` when its activation contract applies.
- Skill additions/removals are reviewed directly against the current collection; there is no mandatory auditor/curator routing layer.

## Mandatory workflows

- Keep delegated exploration and verification bounded: narrow scope, explicit stopping conditions, deterministic evidence first, and no recursive delegation without a concrete blocker.
- After compaction or session recovery, use the latest relevant Engram checkpoint before reconstructing repository context; Engram remains advisory.
- Treat Graphify as advisory and read-only by default; never refresh or mutate `graphify-out/` without explicit request or workflow authorization.
- Treat Gentle AI protected skills and the `sdd-*` family as coordinated systems, not ordinary isolated cleanup candidates.
- When the skill inventory materially changes, update `README.md` in the same change.

## Source precedence

- Current filesystem and Git state determine what actually exists.
- `README.md` documents the intended catalog and maintenance model.
- Skill-local `SKILL.md` files define each skill's activation contract and behavior.
- Engram and Graphify are advisory only.
- If these sources conflict materially, report the conflict instead of guessing.
<!-- agents-md-manager:managed:end -->
