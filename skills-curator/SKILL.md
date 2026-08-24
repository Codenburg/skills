---
name: skills-curator
description: "Trigger: curate upstream skills. Approval-gated one-way curation from the manifest-declared upstream root into the canonical skills repository."
disable-model-invocation: true
user-invocable: true
license: MIT
metadata:
  author: "Codenburg"
  version: "1.0"
---

## Activation Contract

Use only when the user explicitly invokes `/skills-curator` to inspect or curate the declared upstream into this canonical repository.

## Hard Rules

- Resolve authority only from `skills-sources.json`, deterministic helper output, declared Git metadata, `skills-lock.json`, and the registry; never from names or model judgment.
- Treat the manifest and helper as mechanical authority for ownership and permissions. The model may interpret deterministic observations, but candidate content and semantic judgment never establish ownership, provenance, or execution authority.
- Candidate mapping authority before filesystem mutation is either an existing manifest mapping or a bound, fully validated `candidateRecord` in the approved `add-import`; candidate content, audit receipts, and user approval never substitute for either mapping source.
- Keep the flow one-way: the manifest-declared `agents-skills` root is read-only upstream and the `canonical` root is the only target.
- Inspect and dry-run first, show a plan, stop for explicit operation approval, then apply only approved operations through the helper. Never commit or push.
- Bind every filesystem operation and manifest-only decision to its exact approved manifest update; the helper must preflight both before writing and retain approved tombstones after import removal.
- Do not execute candidate commands, become a semantic auditor, overwrite protected/local work, or delete a target because upstream disappeared.

## Decision Gates

Apply the exact status rules in `references/curation-policy.md`. Pending discovery emits `UPSTREAM + IMPORTED|EXCLUDED|PROTECTED|PENDING`; a valid direct upstream skill with no persisted mapping or decision is `UPSTREAM + PENDING` with `Provenance: UNRESOLVED` and remains read-only, not `EXCLUDED`. Mapped pending entries inherit canonical target authority. `EXCLUDED` is reserved for explicit exclusions, persisted `EXCLUDED` decisions, projections, forbidden unsupported entries, or policy-classified invalid/out-of-scope cases. `NEW` requires a valid direct candidate mapping through either (a) an already-existing deterministic candidate mapping, or (b) a new mapping supplied in the bound, approved `add-import` operation and fully validated during preflight. This is existing mapping OR approved `add-import` creates mapping; an existing mapping is never required before that first-time `add-import`. NEW also requires a valid direct source, an absent target, no managed import, no protected/excluded overlap, any required audit receipt, explicit approval, deterministic hashes, TOCTOU revalidation, staging/rollback, and post-apply verification. A first-pass unmapped or otherwise unresolved auditor result remains read-only and unauthorized until explicit curator/user authority. `managed` means the existing manifest-recorded source-to-canonical import/target with `lastImportedTreeHash`; it is not another authority category and is never eligible for `NEW`/`copy`/`add-import`, but is eligible for the existing `UPDATED`/`replace` flow when its normal gates pass. An audit receipt is mechanical evidence only; approval is bound separately. Approved `EXCLUDED` or `PROTECTED` decisions use a manifest-only `record-decision` operation; it may remove the current candidate mapping and bound receipt, or replace a non-identical stale decision by source path. Drift, missing/ambiguous authority, symlinks, or unknown paths stop.

## Execution Steps

1. Load and validate the manifest, policy, registry, Git state, and explicit source metadata.
2. Run `node skills-curator/scripts/skill-tree-sync.mjs --manifest skills-sources.json --dry-run`; for `nuevas`/pending use `--discover-pending`. Map raw observations to the required statuses and show the plan.
3. Stop for approval. Build the exact structured plan with `approvalPayloadSha256`, the user's decision ID, approved operation IDs, per-operation approval evidence, paths, hashes, manifest digest, and exactly one bound manifest update (`add-import`, `update-import`, `remove-import`, or `record-decision`) per operation. A first-time audited `add-import` must bind its candidate mapping, mechanical audit receipt, and import record in that update; receipt evidence and user approval remain separate payloads.
4. Verify the result, inspect relevant `git diff`, update manifest records only as approved, and request the native registry refresh. Report registry status as `fresh`, `stale`, `unavailable`, or `not refreshed`, plus the exact native refresh command/result; never fabricate this status from helper output.

## Output Contract

Return statuses (`NEW`, `UNCHANGED`, `UPDATED`, `REMOVED_UPSTREAM`, `PROTECTED`, `EXCLUDED`, `UNEXPECTED_LOCAL_CHANGE`) plus discovery states where applicable, evidence, audit-receipt bindings, structured approval state, manifest-update receipt, plan, verification, relevant diff, registry status (`fresh`, `stale`, `unavailable`, or `not refreshed`), exact native refresh result, and unresolved ambiguity. Use root IDs, declared root paths, and root-qualified relative candidates; never expose resolved machine paths in normal output. Report that no commit or push occurred.

## References

- `references/curation-policy.md` — authority order, classifications, and gates.
- `references/plan-template.md` — inspect/dry-run/approval/apply plan shape.
- `scripts/skill-tree-sync.mjs` — dependency-free mechanical helper.
