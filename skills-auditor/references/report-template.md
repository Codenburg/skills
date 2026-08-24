# Skills Auditor Report

## Subject

- Candidate: `agents-skills:<sourcePath>`
- Manifest candidate mapping: `<agents-skills:sourcePath -> canonical:targetPath or absent>`
- Admission: `<admitted | first-pass-provisional | rejected>`
- Provenance: `<MAPPED | UNRESOLVED | REJECTED>`
- Canonical target authority/permission: `<candidate | managed | protected | excluded | unavailable>`
- Canonical target authority evidence: `<manifest/helper observation with canonical:targetPath and reason, or unavailable>`
- Canonical target state: `<ABSENT | PRESENT | UNAVAILABLE>`
- Audit verdict: `<RECOMMENDED | RECOMMENDED_WITH_NOTES | REDUNDANT | CONFLICTING | NOT_RELEVANT | UNSAFE | NEEDS_REVIEW>`
- Curation authorization: `<None | Pending curator/user gate for MAPPED + copy-eligible verdict + candidate target authority + ABSENT target>`
- Candidate tree hash: `<hash or unavailable>`
- Manifest SHA-256: `<hash or unavailable>`
- Audit date: `<date>`
- Mode: read-only

## Evidence and scope

- Canonical root: `canonical` (`<declared manifest root path>`)
- Upstream root: `agents-skills` (`<declared manifest root path>`)
- Manifest and registry paths: `<repository-relative paths>`
- Relevant candidates and canonical skills: `<root-id:relative paths>`
- Explicit provenance metadata consulted: `<paths or none>`
- Canonical target authority/permission evidence: `<manifest/helper observation for canonical:targetPath or unavailable>`
- Canonical target state evidence: `<target snapshot: missing = ABSENT, existing = PRESENT, or unavailable>`
- Evidence limits or unresolved ambiguities: `<none or list>`

## Batch context

- Mode: `<single candidate | explicit list | nuevas/pending>`
- Semantic group: `<group name or none>`
- Grouping rationale: `<why these candidates were compared together>`
- Shared deterministic evidence: `<hash/discovery/manifest references>`
- Semantic discovery: `<Graphify shortlist | selective fallback | not used>`
- Graphify used: `<yes | no>`
- Canonical counterparts inspected: `<bounded count of real canonical SKILL.md files>`
- Compact group summary: `<reused evidence and finalized group conclusion, or none>`

For a list or pending batch, include one row per candidate before the detailed sections:

| Candidate | Admission | Provenance | Target authority/permission | Target state | Audit verdict | Curation authorization | Source tree hash | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `agents-skills:<sourcePath>` | `<admitted | first-pass-provisional | rejected>` | `<MAPPED | UNRESOLVED | REJECTED>` | `<candidate | managed | protected | excluded | unavailable>` | `<ABSENT | PRESENT | UNAVAILABLE>` | `<category>` | `<None | Pending curator/user gate>` | `<hash>` | `<root-qualified relative evidence/receipt>` |

## What it does

`<Concise description of the candidate's actual contract and intended use.>`

## Ecosystem comparison

### Related canonical skills

| Skill | Why it is related | Boundary or relationship |
| --- | --- | --- |
| `<name and path>` | `<evidence>` | `<complements, overlaps, or conflicts>` |

### Concrete overlap and conflicts

- `<Trigger, rule, workflow, output, or authority overlap with paths and evidence>`
- `<Contradiction, if any, with both sides named>`

## Quality, safety, and maintainability

- Metadata and invocation: `<findings>`
- Trigger and contract quality: `<findings>`
- Safety risks and missing guardrails: `<findings>`
- Maintainability and upstream/update risks: `<findings>`
- Unique value: `<finding>`
- Alternative skills or compositions: `<finding>`

## Provenance and metadata observations

`<State only deterministic manifest, Git, ignore, lockfile, registry, and file evidence. Do not infer ownership.>`

## Pending classification

`UPSTREAM + PENDING` with `Provenance: UNRESOLVED` means a valid direct upstream skill has no persisted mapping or decision and is eligible only for read-only discovery/audit. It is not `EXCLUDED`. Use `EXCLUDED` only for explicit exclusions, persisted `EXCLUDED` decisions, projections, forbidden unsupported entries, or policy-classified invalid/out-of-scope cases.

## Final recommendation

- Category: `RECOMMENDED | RECOMMENDED_WITH_NOTES | REDUNDANT | CONFLICTING | NOT_RELEVANT | UNSAFE | NEEDS_REVIEW`
- Recommendation: `<keep, keep with notes, defer, reject, or request evidence — with reasons>`
- Required next action: `<one concrete action or none>`
- Files changed: `None`

## Mechanical audit receipt binding

`AUDIT RECEIPT != USER APPROVAL`. The mechanical receipt contains only `recordId`, `candidateSourcePath`, `sourceTreeHash`, `manifestSha256`, and `category`; it must be valid before any user decision and contains no `approvalDecisionId` or `userApprovalMarker`. The curator binds this receipt to approval separately through `userApproval`, `operation.approval`, and `manifestUpdate.approval`.

For an admitted candidate, including an explicit unmapped first pass, emit real values for all five receipt fields from the current evidence. The curator may bind this exact receipt from the report to an approved `NEW`/copy plan only when the verdict is copy-eligible, canonical target authority/permission is `candidate`, and target state is `ABSENT`. `managed` means an existing manifest-managed import/target and keeps `Curation authorization: None` for a NEW/import path; it uses the existing `UPDATED`/`replace` flow. Protected, excluded, `PRESENT`, or unavailable target evidence also keeps authorization at `None`. For an explicit unmapped first pass, target authority and target state remain `unavailable`/`UNAVAILABLE`, and the auditor remains read-only; the curator may supply and validate the mapping as `candidateRecord` inside the bound approved `add-import` before filesystem mutation. The receipt grants no ownership, target authority, mapping, copy authorization, or user approval. Do not require an audit rerun solely to persist the receipt. An unresolved, protected, excluded, redundant, conflicting, irrelevant, unsafe, or review-needed result is never curation authorization, and `Pending curator/user gate` is not approval.

- Record ID: `<stable receipt id>`
- Candidate source path: `<normalized source path relative to the declared upstream root>`
- Full source tree hash: `<same hash recorded above>`
- Manifest SHA-256: `<same manifest state used for the plan>`
- Exact category: `<one category from the checklist>`
- User approval binding: `Not part of the audit receipt; bind separately in the approved plan`
