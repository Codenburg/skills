# Skills Curator Plan

## Authority

- Manifest: `skills-sources.json`
- Manifest SHA-256: `<hash>`
- Approval payload SHA-256: `<hash over the complete plan payload except this field>`
- Canonical root: `canonical` (`<declared manifest root path>`, `canonical-git-repository`)
- Upstream root: `agents-skills` (`<declared manifest root path>`, `upstream-read-only`)
- Direction: `source-to-canonical-only`
- Decision policy: `EXCLUDED | PROTECTED`, current full source tree hash, exact approval marker
- Registry status: `<fresh, stale, unavailable, or not refreshed>`

## Deterministic observations

| Source | Target | Status | Source tree hash | Target state | Target tree hash | Recorded hash | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `agents-skills:<sourcePath>` | `canonical:<targetPath>` | `NEW` | `<hash>` | `ABSENT` | `<missing>` | `<none>` | `<manifest/helper/Git evidence>` |

Use only: `NEW`, `UNCHANGED`, `UPDATED`, `REMOVED_UPSTREAM`, `PROTECTED`, `EXCLUDED`, `UNEXPECTED_LOCAL_CHANGE`. Pending discovery additionally reports `UPSTREAM + IMPORTED`, `UPSTREAM + EXCLUDED`, `UPSTREAM + PROTECTED`, and `UPSTREAM + PENDING`. A valid direct skill with no persisted mapping or decision is `UPSTREAM + PENDING` with `Provenance: UNRESOLVED`, not `EXCLUDED`; discovery and audit remain read-only until mapping authority exists.

## Proposed operations

| Operation ID | Operation | Exact source | Exact target | Expected hashes | Authority | Approval |
| --- | --- | --- | --- | --- | --- | --- |
| `<copy-id>` | `copy / replace / delete` | `agents-skills:<sourcePath>` | `canonical:<targetPath>` | `<source/target/tombstone evidence>` | `<candidate for NEW / managed for replace>` | `pending` |
| `<decision-id>` | `record-decision` | `agents-skills:<sourcePath>` | `—` | `<current source tree hash>` | `<remove candidate / replace decision / add decision>` | `pending` |

No operation is implied by a status. `REMOVED_UPSTREAM`, `PROTECTED`, `EXCLUDED`, and `UNEXPECTED_LOCAL_CHANGE` produce no automatic operation. A user-approved `record-decision` may remove the source's existing candidate mapping and related audit receipt in the same manifest mutation, or replace an existing stale decision by source path; it must never coexist with an import.

## Machine plan shape

The helper accepts only this structure. `approvedOperationIds` must be the exact set of operation IDs, each operation approval must repeat the same decision ID and operation ID, and `approvalPayloadSha256` must hash the complete plan payload except itself using recursively sorted object keys, preserved array order, and JSON scalar encoding. It is an integrity/staleness digest, not a signature. A copy of a candidate with `provenance.requiresAudit: true` must include the complete mechanical audit record. Mapping authority must exist before filesystem mutation, either as an already-existing deterministic manifest mapping or as a new mapping supplied and fully validated as `candidateRecord` inside the bound, approved `add-import` update; an existing mapping is not required before that first-time update. A manifest-only source decision uses `operation: "record-decision"` and `action: "record-decision"` with null canonical target fields.

For `NEW`/`copy`, the source must be a valid direct skill directory, the target state must be `ABSENT`, no managed import or protected/excluded overlap may exist, and the approved plan must bind any required audit receipt, explicit approval, deterministic hashes, TOCTOU revalidation, staging/rollback, and post-apply verification. `managed` means the existing manifest-recorded import/target with `lastImportedTreeHash`; it is never a `NEW`/`copy`/`add-import` authority and uses `replace`/`update-import` instead.

```json
{
  "schemaVersion": 3,
  "kind": "skills-curator-approved-plan",
  "approved": true,
  "manifestSha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "approvalPayloadSha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "userApproval": {
    "marker": "explicit-user-approval",
    "decisionId": "decision-2026-08-19-001",
    "approvedOperationIds": ["copy-example"]
  },
  "operations": [
    {
      "operationId": "copy-example",
      "operation": "copy",
      "sourceRoot": "agents-skills",
      "sourcePath": "candidate-example",
      "targetRoot": "canonical",
      "targetPath": "candidate-example",
      "expectedSourceTreeHash": "0000000000000000000000000000000000000000000000000000000000000000",
      "expectedTargetTreeHash": null,
      "decisionRecord": null,
      "approval": {
        "approved": true,
        "marker": "explicit-user-approval",
        "decisionId": "decision-2026-08-19-001",
        "operationId": "copy-example"
      },
      "auditRecord": {
        "recordId": "audit-candidate-example-001",
        "candidateSourcePath": "candidate-example",
        "sourceTreeHash": "0000000000000000000000000000000000000000000000000000000000000000",
        "manifestSha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "category": "RECOMMENDED"
      }
    }
  ],
  "manifestUpdates": [
    {
      "operationId": "copy-example",
      "action": "add-import",
      "expectedSourceTreeHash": "0000000000000000000000000000000000000000000000000000000000000000",
      "expectedTargetTreeHash": null,
      "tombstoneId": null,
      "tombstoneRecord": null,
      "removeCandidate": false,
      "replaceDecision": false,
      "candidateRecord": null,
      "auditRecord": null,
      "importRecord": {
        "id": "import-candidate-example",
        "sourceRoot": "agents-skills",
        "sourcePath": "candidate-example",
        "targetRoot": "canonical",
        "targetPath": "candidate-example",
        "status": "managed",
        "lastImportedTreeHash": "0000000000000000000000000000000000000000000000000000000000000000",
        "authority": {
          "kind": "manifest-explicit-baseline",
          "basis": "approved operation completed and verified"
        }
      },
      "decisionRecord": null,
      "approval": {
        "approved": true,
        "marker": "explicit-user-approval",
        "decisionId": "decision-2026-08-19-001",
        "operationId": "copy-example"
      }
    }
  ]
}
```

The manifest's `authority.auditPolicy` defines the exact audit-record fields, categories, and copy-eligible categories. `AUDIT RECEIPT != USER APPROVAL`: approval decision IDs and markers belong only in `userApproval`, `operation.approval`, and `manifestUpdate.approval`. Resolve historical receipts for an existing candidate mapping by candidate source path plus the current source tree hash. A single current-hash copy-eligible receipt may be reused exactly with a null update receipt; stale receipts with another hash do not block a fresh receipt, which must match the current manifest digest and be persisted atomically in the approved `add-import` update. A missing fresh receipt blocks when no reusable current-hash receipt exists, and multiple current-hash receipts are conflicting and stop. For a first-time candidate, `candidateRecord` and fresh `auditRecord` are supplied by the same approved `add-import` update; the helper persists the receipt and import atomically. An auditor first-pass remains read-only but emits the real five-field receipt; the curator binds the exact receipt, mapping, and import in the approved update. Replace and delete operations omit `auditRecord`; lock-backed candidates may omit it when they do not declare `requiresAudit`.

`manifestUpdates` must contain exactly one entry for every operation. Every update includes boolean `removeCandidate` and `replaceDecision` fields; `tombstoneRecord` is `null` or a strict object as required by the action. Use `add-import` for `NEW`/`copy`, `update-import` with the existing import ID for managed `replace`, `remove-import` with `importRecord: null` plus either an existing `tombstoneId` and `tombstoneRecord: null`, or `tombstoneId: null` and a new strict `tombstoneRecord`, and `record-decision` with `decisionRecord` for an approved `EXCLUDED` or `PROTECTED` source decision. For `record-decision`, set `removeCandidate: true` only when the current manifest has that source mapping, and `replaceDecision: true` only when replacing a non-identical existing decision. Every update repeats the operation approval marker, decision ID, and operation ID; approval remains separate from mechanical audit evidence.

### First-time add-import update

For an unmapped direct candidate, the `add-import` update must contain all three records below, bound to the same operation: `candidateRecord`, fresh `auditRecord` when required, and `importRecord`. For an existing mapped candidate with no reusable current-hash receipt, including one with only stale historical receipts, the same update contains `auditRecord` and `importRecord` while `candidateRecord` remains null. The helper adds them to `candidatePaths`, `auditRecords`, and `imports` only after filesystem and manifest preflight succeeds.

```json
{
  "candidateRecord": {
    "sourceRoot": "agents-skills",
    "sourcePath": "candidate-example",
    "targetRoot": "canonical",
    "targetPath": "candidate-example",
    "provenance": { "kind": "manifest-candidate", "requiresAudit": true }
  },
  "auditRecord": "<complete receipt matching the operation and current manifest digest>",
  "importRecord": "<complete managed import record>"
}
```

### Delete tombstone update

For `remove-import`, use an existing `tombstoneId` with `tombstoneRecord: null`, or use `tombstoneId: null` with a new strict `tombstoneRecord` in the same update. The new record contains exactly `id`, `sourceRoot`, `sourcePath`, `targetRoot`, `targetPath`, `status`, and `deleteAuthorized`; its ID and mapping must match the operation and it is retained only after staged deletion and import removal verify successfully.

### Persisted decision operation

`record-decision` is manifest-only. It requires a direct non-symlink source with its current full tree hash, an exact approval marker and decision ID, and a `decisionRecord` whose state is `EXCLUDED` or `PROTECTED`. It carries `targetRoot: null`, `targetPath: null`, and never copies or deletes files. With `removeCandidate: true`, the helper removes the candidate mapping and its bound audit records before adding/replacing the decision. With `replaceDecision: true`, it replaces the decision by source path; an exact duplicate is rejected.

```json
{
  "operation": "record-decision",
  "sourcePath": "candidate-example",
  "targetRoot": null,
  "targetPath": null,
  "expectedSourceTreeHash": "<current full source tree hash>",
  "manifestUpdate": {
    "action": "record-decision",
    "removeCandidate": true,
    "replaceDecision": false,
    "decisionRecord": "<approved EXCLUDED or PROTECTED record>"
  }
}
```

## Approval gate

Stop here and ask the user to approve an explicit operation ID set. Approval must cover exact paths, hashes, and any manifest import/tombstone update. Do not infer approval from the original request or from a later unrelated message.

## Apply and verification receipt

- Approved operation IDs: `<ids or none>`
- Helper invocation: `<exact command>`
- Approval payload SHA-256: `<validated canonical plan digest>`
- Applied operations: `<ids or none>`
- Post-apply full-tree hashes: `<evidence>`
- Relevant `git diff`: `<paths and summary>`
- Registry refresh: `<native command result or unavailable>`
- Commit/push: `Not performed`
