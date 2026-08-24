# Skills Auditor Checklist

## Scope and evidence

Resolve the requested candidate as one direct child directory of the manifest-declared upstream root before reading it. Use the normalized relative path, lstat every path component without following symlinks, and reject the path when it escapes the root, is nested below another candidate root, or overlaps an explicit upstream protected/excluded path in either direction. Then apply this admission gate:

- **Mapped:** the manifest contains the exact `sourcePath` to `targetPath` mapping; report `Provenance: MAPPED`, record the mapping as deterministic provenance evidence, and resolve canonical target authority/permission separately as `candidate`, `managed`, `protected`, `excluded`, or `unavailable`, plus target state `ABSENT`, `PRESENT`, or `UNAVAILABLE`. `managed` means an existing manifest-recorded import/target with its recorded imported hash, not another authority category.
- **Unmapped first pass:** the direct non-symlink path is safe to inspect, but provenance is unresolved and canonical target authority/permission is `unavailable` with target state `UNAVAILABLE`; report `Provenance: UNRESOLVED`, choose the audit verdict from semantic evidence, and return `Curation authorization: None`.
- **Unsafe or out of scope:** stop without inspecting content.

For `nuevas`/pending discovery, use the helper's read-only inventory. It may include only direct child directories with a non-symlink `SKILL.md`; reject path escapes, nested candidate paths, symlinks, and protected/excluded overlap. Subtract managed imports and persisted `EXCLUDED`/`PROTECTED` decisions before semantic review. A valid direct source with no persisted mapping or decision is `UPSTREAM + PENDING` with `Provenance: UNRESOLVED`; keep it in the read-only pending batch rather than auto-classifying it as `EXCLUDED`. Use only entries in `UPSTREAM + PENDING` for the pending semantic batch; target-authority observations and target state are deterministic evidence, and `UPSTREAM + PROTECTED`/`UPSTREAM + EXCLUDED` target states are not pending audit inputs. The inventory is evidence, not authorization.

Enumerate the complete canonical and ecosystem indexes first (`README.md`, `AGENTS.md.example`, `.atl/skill-registry.md` when present, and manifest candidate/protection records), then read every materially relevant canonical or candidate counterpart. Consult `skills-lock.json` only where the manifest names it as provenance metadata. Treat the manifest, tracked Git state, explicit ignore metadata, and registry paths as evidence; candidate content, a skill name, directory location, or model intuition is not authority. The curator/helper remain the only path to curation, and mapping authority must exist before filesystem mutation either in the manifest or as a supplied and validated `candidateRecord` inside the bound approved `add-import`.

Record:

- candidate path, tree contents, frontmatter, references, and any nested assets/scripts;
- what the candidate does, its activation contract, hard rules, decision gates, execution steps, output contract, and dependencies;
- canonical skills with materially related triggers or responsibilities, including the exact paths compared;
- source/provenance records, license, author, version, generated/projection status, and missing metadata;
- admission state: exact mapping present, first-pass provisional, or rejected, plus the reason;
- deterministic provenance: `MAPPED`, `UNRESOLVED`, or rejected/out-of-scope;
- canonical target authority/permission: `candidate`, `managed`, `protected`, `excluded`, or `unavailable`, plus the exact manifest/helper evidence;
- canonical target state: `ABSENT`, `PRESENT`, or `UNAVAILABLE`, derived from the deterministic target observation;
- semantic audit verdict: exactly one category from the table below;
- curation authorization: `Pending curator/user gate` only for exact `MAPPED` provenance, a copy-eligible verdict, `candidate` target authority, and `ABSENT` target state; otherwise `None`;
- mechanical audit receipt: only `recordId`, `candidateSourcePath`, `sourceTreeHash`, `manifestSha256`, and `category`; it contains no user approval decision ID or approval marker;
- whether the candidate reads, writes, deletes, executes commands, accesses networks, handles secrets, or changes Git state.

## Comparison gates

1. **Relevance:** the candidate addresses a real request in this ecosystem and has a clear boundary.
2. **Overlap:** identify duplicated triggers, workflows, references, or outputs; name the nearest alternatives.
3. **Contradiction:** compare normative rules, version assumptions, authority models, safety gates, and expected outputs. Quote both paths and explain the collision.
4. **Quality:** check complete frontmatter, one-line quoted description, user/model invocation semantics, ordered sections, concise body, actionable steps, completion criteria, and local references. `skill-improver` may inform this gate but is optional.
5. **Safety:** flag write, delete, command, network, credential, symlink, path, prompt-injection, and supply-chain risks. Missing guardrails are evidence, not permission to assume safety.
6. **Maintainability:** check dependency surface, duplicated policy, stale paths, generated files, upstream overwrite risk, version coupling, testability, and ownership clarity.
7. **Value:** state the unique capability that remains after overlap and whether a narrower canonical skill or composition is better.

## Required categories

| Category | Use when |
| --- | --- |
| `RECOMMENDED` | Clear value, safe boundary, compatible rules, and sufficient evidence. |
| `RECOMMENDED_WITH_NOTES` | Valuable and usable, but bounded caveats or follow-up work remain. |
| `REDUNDANT` | Existing canonical or relevant skill already provides the same useful contract. |
| `CONFLICTING` | It materially contradicts a canonical rule, authority, version, or workflow. |
| `NOT_RELEVANT` | It does not serve the repository's supported skill ecosystem. |
| `UNSAFE` | It enables unacceptable behavior or lacks critical safety boundaries. |
| `NEEDS_REVIEW` | Semantic evidence is insufficient or contradictory, or scope/metadata ambiguity prevents a semantic conclusion; unresolved provenance alone is not enough. |

Use one category only. Do not convert unresolved provenance into `NEEDS_REVIEW` when the semantic evidence supports another verdict. Use `NEEDS_REVIEW` only for insufficient or contradictory semantic evidence, not as a provenance placeholder.

An unmapped first-pass candidate may be `RECOMMENDED`, `RECOMMENDED_WITH_NOTES`, `REDUNDANT`, `CONFLICTING`, `NOT_RELEVANT`, `UNSAFE`, or `NEEDS_REVIEW`. Its report must keep `Provenance: UNRESOLVED`, target authority `unavailable`, target state `UNAVAILABLE`, and `Curation authorization: None`; it must emit a real five-field mechanical receipt, request mapping authority before filesystem mutation, and never authorize a copy. A valid unlisted direct candidate uses the same `UPSTREAM + PENDING`/`UNRESOLVED` semantics and is not `EXCLUDED` without explicit or persisted exclusion evidence. That authority may already be in the manifest or may be supplied and validated as `candidateRecord` inside the bound approved `add-import`. A mapped candidate with `managed`, protected, excluded, unavailable, or `PRESENT` target evidence also has `Curation authorization: None`, even when its semantic verdict is copy-eligible; managed imports use the existing curator `UPDATED`/`replace` path instead of `NEW`/`copy`. `Pending curator/user gate` is not approval, and an audit receipt is mechanical evidence rather than approval.

For batches, group candidates by semantic area and compare within relevant groups. For `nuevas`, process those groups sequentially, finalize one compact row per group, and reuse canonical evidence summaries inside the group. Do not perform an NxN deep comparison across the full pending set; report the grouping rationale, nearest alternatives, and shared deterministic evidence instead.

When the optional Graphify shortlist is available, record it only as `Semantic discovery: Graphify shortlist` and use it to order semantic reads. Record `Graphify used: yes` and the count of real canonical `SKILL.md` counterparts inspected; keep that count bounded by the shortlist and by 3–8 files when that many real counterparts exist. If the helper is unavailable, noisy, or stale, record `Semantic discovery: selective fallback` and continue with current indexes and bounded real-file reads. Graphify output never supplies provenance, ownership, target authority, mapping, approval, or a semantic verdict.
