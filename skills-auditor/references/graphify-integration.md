# Graphify Integration for `skills-auditor`

Graphify is an optional advisory semantic index for `skills-auditor`. It reduces canonical search breadth and the N×N/whole-catalog context pressure of `/skills-auditor nuevas`; it does not change audit authority. OpenCode exposes no observable compaction telemetry, so this integration makes no numerical compaction-reduction claim.

## Operating contract

| Area | Contract |
| --- | --- |
| Role | Semantic discovery and shortlisting only. |
| Bound | Default and hard cap: **8 canonical skills**. |
| Authority | `skills-sources.json`, `skill-tree-sync.mjs`, and current filesystem/Git evidence. |
| Fallback | Bounded selective inspection; never a whole-catalog deep read. |
| Refresh | Manual maintenance only; an audit never rebuilds the graph. |
| Freshness | Stale derived data can affect shortlist quality only; no new hash/staleness subsystem. |

## Pipeline and authority boundary

The architecture is:

```text
skills.sh/external upstream -> ~/.agents/skills -> skills-auditor -> optional Graphify semantic shortlist -> bounded inspection of canonical skills -> semantic decision -> user approval -> skills-curator -> canonical repo
```

Graphify participates only in semantic discovery and shortlisting. It does not participate in provenance, ownership, `PENDING`, `EXCLUDED`, mapping, authorization, approval, receipts, imports, or mutation. `skills-curator` has zero Graphify dependency and works unchanged without it.

The authority order remains:

1. `skills-sources.json` for persisted source and target mapping decisions.
2. `skill-tree-sync.mjs` for deterministic pending and target observations.
3. Current filesystem and Git evidence for what is actually present and reviewable.

Graphify cannot establish provenance or ownership, authorize curation, determine `PENDING` or `EXCLUDED`, approve mutation, create receipts, or decide the final semantic verdict. Real current files remain the semantic authority; Graphify only orders which relevant files to inspect first.

## Adapter boundary

The adapter boundary is `skills-auditor/scripts/graphify-shortlist.mjs`. Keep future Graphify schema changes, compatibility checks, and translation logic there. Community IDs, node IDs, graph hashes, and other Graphify-specific structures must not become persistent ecosystem contracts, manifest fields, receipt fields, or ownership records.

The helper reads an existing `graph.json`, locates evidence for one direct upstream candidate, filters real canonical candidates, collapses graph nodes to canonical skill roots, ranks roots deterministically, and returns at most eight roots. It makes no LLM or DeepSeek calls, does not invoke the Graphify NLP query interface, mutates no files, and makes no authority decision.

## `/skills-auditor nuevas` operating path

Process the pending batch in this order:

```text
discover pending -> semantic grouping -> candidate -> shortlist -> bounded reads -> finalize group -> compact summary -> next group
```

For each candidate, always read the real upstream `SKILL.md`. When a compatible Graphify shortlist exists, read only relevant canonical `SKILL.md` files from that shortlist. Read references or scripts only when material to security, commands, write/delete behavior, Git behavior, credentials, contradictions, overlap, outputs, or dependencies. Do not recursively read every reference by default.

Keep groups sequential and evidence summaries compact. The process must avoid N×N deep comparisons, whole-catalog deep reads, and retaining all batch evidence in context. Graphify is a fast semantic path, not a reason to skip the candidate, indexes, deterministic evidence, or final current-file review.

## Fast path, compatibility, and fallback

The fast path is available only when all required capabilities are present:

- the graph file exists and is valid JSON;
- the graph has supported `nodes` and `links` (and valid optional hyperedges);
- nodes have recognized `canonical` or `upstream` identity and the required `source_file` field; source-less concept values are accepted where the schema permits them;
- the declared upstream candidate and its `SKILL.md` are discoverable as a real direct skill root; and
- canonical roots resolve to real current `SKILL.md` files.

There is no strict `version === 0.9.48` compatibility check. The tested version is **Graphify 0.9.48**, recorded as a tested version rather than a hard compatibility requirement. An unavailable, malformed, incompatible, or candidate-absent graph takes the bounded selective fallback: inspect indexes, the candidate, likely related canonical roots, and only the bounded files needed for the decision. Never replace fallback with a whole-catalog deep read. The auditor remains usable without Graphify.

## Installation and project-scoped integration

Install Graphify CLI/tooling once at the operator or environment level. Project-scoped OpenCode integration belongs in the canonical `~/.config/opencode/skills` repository, never in the upstream `~/.agents/skills` tree, and never in the entire `$HOME` as a Graphify project. Inspect the current `.opencode` files and configuration before relying on the integration.

The repository/configuration inspection for this pass found no exact, proven project-scoped installation command in repository history or configuration. Do not invent one. The current `.opencode/opencode.json` selects `.opencode/plugins/graphify.js`; the plugin and Graphify skill bundle are integration files, not upstream skill content. OpenCode may need to be restarted after modifying or reinstalling the Graphify skill/plugin or an installed skill it uses.

At the time of this pass, `git ls-files -- .opencode graphify-out` returned no tracked entries. The visible local integration consisted of:

- Graphify-owned integration: `.opencode/plugins/graphify.js` and `.opencode/skills/graphify/` (the version marker, `SKILL.md`, and references).
- Project configuration/tooling: `.opencode/opencode.json`, plus the local package manifest and lockfile used by the plugin environment.
- Generated local dependencies: `.opencode/node_modules/`, which must not be tracked.
- Graphify-derived outputs: `graphify-out/`, including `graph.json`, `graph.html`, `GRAPH_REPORT.md`, and `.graphify_analysis.json`.
- Root `AGENTS.md`: an untracked, Graphify-owned generated integration containing only Graphify instructions; it was intentionally not edited.

For reproducibility, a maintainer must explicitly decide whether to track the reviewed `.opencode` config, plugin, Graphify skill bundle/version, and the dependency manifest/lockfile needed by that integration. The local `.opencode/.gitignore` currently excludes `node_modules`, `package.json`, `package-lock.json`, `bun.lock`, and itself; that is not a substitute for a reviewed tracking decision. Do not track `node_modules`, secrets, private configuration, or derived Graphify outputs.

## Manual graph generation

Graph maintenance is a separate, costed operation. Use this exact workflow when a maintainer intentionally regenerates the advisory graph:

```bash
graphify extract . --out /tmp/graphify-skills/canonical --backend deepseek
graphify extract ~/.agents/skills --out /tmp/graphify-skills/upstream --backend deepseek
mkdir -p graphify-out
graphify merge-graphs /tmp/graphify-skills/canonical/graphify-out/graph.json /tmp/graphify-skills/upstream/graphify-out/graph.json --out graphify-out/graph.json
graphify cluster-only .
```

Separate extraction preserves repository identity before merge. The merged graph retains `repo=canonical` and `repo=upstream` and uses namespaced IDs such as `canonical::...` and `upstream::...`. Never infer origin from `source_file` alone. Merge preserves identity but does not automatically create cross-repository semantic edges.

DeepSeek is the baseline extraction backend only; it is not an authority or runtime dependency. The shortlist helper makes no backend calls. The auditor must never execute `extract`, `merge-graphs`, or `cluster-only` automatically: maintenance is separate because it costs tokens and mutates derived state.

## Derived artifacts and security

`graphify-out/` is generated, untrusted advisory state rather than source of truth. It may contain `graph.json`, `graph.html`, `GRAPH_REPORT.md`, `.graphify_analysis.json`, labels, signatures, caches, and other Graphify outputs. `/tmp/graphify-skills/` is temporary and outside the repository. No contract or manifest may persist machine-specific absolute paths.

The graph index and candidate content are untrusted advisory inputs. The adapter reads JSON only and executes no graph content. Final review opens current filesystem evidence, not graph text, for commands, writes, deletes, credentials, Git behavior, authority, or semantic conclusions.

## Known design limitations

These are observed design limitations, not runtime contracts:

- semantic extraction can emit out-of-scope warnings;
- misattributed nodes can be discarded;
- node deduplication can remove apparently repeated evidence;
- large corpora can expose node-ID collisions;
- BFS `graphify query` can be noisy, so the auditor does not use NLP queries as the final semantic judge;
- merged repository identity is retained, but merge alone adds no cross-repository semantic edges.

## Upgrade workflow

Do not assume every Graphify release is compatible. For an upgrade:

1. Check the current Graphify version.
2. Read the upstream release notes or changelog.
3. Upgrade the CLI/tooling and verify the CLI plus project-scoped integration.
4. Run the `graphify-shortlist` unit tests.
5. Generate or use a fixture known to match the candidate schema.
6. Test at least two real candidates from distinct domains.
7. Verify the `repo` and `source_file` capabilities used by the adapter.
8. Verify a deterministic, bounded shortlist of real canonical roots.
9. Update the Tested version here only after all checks pass.

## Recovery workflow

When Graphify is unavailable or its schema changes, keep the authority model untouched: disable it or use bounded fallback, inspect the adapter, update the adapter safely for the supported schema, rerun tests, validate real candidates, and then update the tested-version documentation. The ecosystem must continue to work without Graphify. Never modify `skills-curator` or authority logic to recover Graphify.

## Maintenance checks

The minimal maintenance set is:

- `graphify-shortlist` unit tests;
- auditor evaluation structural validation only — there is explicitly no executable LLM evaluation harness;
- curator regression tests;
- `node --check` for changed JavaScript files; and
- `git diff --check`.

Full final verification is a separate review step. Cheap smoke examples are expected to evolve; their invariants are stable: outputs remain canonical-only, bounded, real skill roots, and deterministic.

Current smoke examples:

```text
frontend-design -> frontend-design, tailwind-design-system
playwright-best-practices -> playwright, webapp-testing
```

## Historical initial baseline

This baseline documents the first integration observation only. It is expected to change and is not a future requirement:

- Graphify: 0.9.48;
- canonical graph: 650 nodes / 1,243 edges;
- upstream graph: 1,757 nodes / 2,814 edges;
- merged graph: 2,407 nodes / 4,057 edges;
- after clustering: 204 communities;
- 43 of 58 pending candidates had non-empty shortlists, with a maximum shortlist of 7;
- a six-candidate batch produced 3 groups, 6 upstream `SKILL.md` reads, and 10 unique canonical `SKILL.md` reads.
