import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, test } from "node:test";

import { buildShortlist, shortlistFromFile } from "./graphify-shortlist.mjs";

const SCRIPT_PATH = path.resolve(new URL("./graphify-shortlist.mjs", import.meta.url).pathname);
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function fixture(candidate = "candidate-skill") {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "graphify-shortlist-"));
  temporaryDirectories.push(base);
  const upstream = path.join(base, "upstream");
  const canonical = path.join(base, "canonical");
  fs.mkdirSync(upstream, { recursive: true });
  fs.mkdirSync(canonical, { recursive: true });
  writeSkill(upstream, candidate);
  return { base, upstream, canonical, candidate };
}

function writeSkill(root, skill) {
  const directory = path.join(root, skill);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "SKILL.md"), `# ${skill}\n`);
}

function graphNode(id, repo, sourceFile, label, extra = {}) {
  return {
    id,
    repo,
    source_file: sourceFile,
    label,
    norm_label: label.toLowerCase(),
    ...extra,
  };
}

function graph(nodes, links = [], hyperedges = []) {
  return {
    directed: false,
    multigraph: false,
    graph: {},
    nodes,
    links,
    hyperedges,
    built_at_commit: "fixture",
  };
}

function shortlist(fixtureData, data, candidate = fixtureData.candidate, options = {}) {
  return buildShortlist(data, candidate, {
    upstreamRoot: fixtureData.upstream,
    canonicalRoot: fixtureData.canonical,
    ...options,
  });
}

function skills(result) {
  assert.equal(result.available, true);
  return result.canonicalShortlist.map((entry) => entry.skill);
}

test("keeps canonical and upstream nodes distinct when source_file is identical", () => {
  const data = fixture("incoming-skill");
  writeSkill(data.canonical, "same-path");
  const result = shortlist(data, graph([
    graphNode("upstream-candidate", "upstream", "incoming-skill/SKILL.md", "Shared concept"),
    graphNode("canonical-counterpart", "canonical", "same-path/SKILL.md", "Shared concept"),
    graphNode("upstream-counterpart", "upstream", "same-path/SKILL.md", "Shared concept"),
  ]));

  assert.deepEqual(skills(result), ["same-path"]);
  assert.equal(JSON.stringify(result).includes("upstream-counterpart"), false);
});

test("collapses reference-heavy canonical roots to one bounded shortlist entry", () => {
  const data = fixture("testing-candidate");
  writeSkill(data.canonical, "reference-heavy");
  const nodes = [graphNode("candidate", "upstream", "testing-candidate/SKILL.md", "Bounded fixture overlap")];
  nodes.push(graphNode("reference-anchor", "canonical", "reference-heavy/SKILL.md", "Bounded fixture overlap"));
  for (let index = 0; index < 30; index += 1) {
    nodes.push(graphNode(
      `reference-${index}`,
      "canonical",
      `reference-heavy/references/topic-${index}.md`,
      "Bounded fixture overlap repeated reference",
    ));
  }

  const result = shortlist(data, graph(nodes));
  assert.equal(skills(result).filter((skill) => skill === "reference-heavy").length, 1);
  assert.equal(result.canonicalShortlist.length, 1);
});

test("excludes a reference-heavy root supported only by generic governance vocabulary", () => {
  const data = fixture("frontend-candidate");
  writeSkill(data.canonical, "governance-helper");
  const nodes = [
    graphNode("candidate", "upstream", "frontend-candidate/SKILL.md", "Frontend design"),
    graphNode(
      "governance-anchor",
      "canonical",
      "governance-helper/SKILL.md",
      "Copy token snapshot assert integration",
    ),
  ];
  for (let index = 0; index < 30; index += 1) {
    nodes.push(graphNode(
      `governance-reference-${index}`,
      "canonical",
      `governance-helper/references/topic-${index}.md`,
      "Copy token snapshot assert integration",
    ));
  }

  const result = shortlist(data, graph(nodes));
  assert.deepEqual(skills(result), []);
});

test("admits a differently named counterpart with semantic and community signals", () => {
  const data = fixture("interface-candidate");
  writeSkill(data.canonical, "visual-interface");
  const result = shortlist(data, graph([
    graphNode(
      "candidate",
      "upstream",
      "interface-candidate/SKILL.md",
      "Frontend design",
      { community: 12 },
    ),
    graphNode(
      "counterpart",
      "canonical",
      "visual-interface/SKILL.md",
      "Interface design",
      { community: 12 },
    ),
  ]));

  assert.deepEqual(skills(result), ["visual-interface"]);
  assert.equal(result.canonicalShortlist[0].reasons.includes("shared community signal"), true);
});

test("admits a high-information product-family root across different names", () => {
  const data = fixture("playwright-best-practices");
  writeSkill(data.canonical, "playwright");
  const nodes = [
    graphNode(
      "candidate",
      "upstream",
      "playwright-best-practices/SKILL.md",
      "Playwright Best Practices SKILL",
    ),
    graphNode(
      "counterpart",
      "canonical",
      "playwright/SKILL.md",
      "Playwright E2E Testing Skill",
    ),
  ];
  for (const skill of ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"]) {
    writeSkill(data.canonical, skill);
    nodes.push(graphNode(skill, "canonical", `${skill}/SKILL.md`, `${skill} concept`));
  }

  const result = shortlist(data, graph(nodes));

  assert.deepEqual(skills(result), ["playwright"]);
  assert.equal(result.canonicalShortlist[0].reasons.includes("shared skill family: playwright"), true);
});

test("does not admit a non-family anchor overlap from migration and to", () => {
  const data = fixture("react19-test-patterns");
  writeSkill(data.canonical, "tailwind-design-system");
  const result = shortlist(data, graph([
    graphNode(
      "candidate",
      "upstream",
      "react19-test-patterns/SKILL.md",
      "React 19 Test Migration Patterns",
    ),
    graphNode(
      "counterpart",
      "canonical",
      "tailwind-design-system/SKILL.md",
      "v3 to v4 migration checklist",
    ),
  ]));

  assert.deepEqual(skills(result), []);
});

test("excludes repository documentation, nested projections, and graph artifacts", () => {
  const data = fixture("documentation-candidate");
  writeSkill(data.canonical, "real-skill");
  const result = shortlist(data, graph([
    graphNode("candidate", "upstream", "documentation-candidate/SKILL.md", "Graph concept"),
    graphNode("real", "canonical", "real-skill/SKILL.md", "Graph concept"),
    graphNode("readme", "canonical", "README.md", "Graph concept"),
    graphNode("registry", "canonical", ".atl/skill-registry.md", "Graph concept"),
    graphNode("nested", "canonical", ".opencode/skills/graphify/SKILL.md", "Graph concept"),
    graphNode("artifact", "canonical", "graphify-out/graph.json", "Graph concept"),
  ]));

  assert.equal(skills(result).includes("real-skill"), true);
  assert.equal(skills(result).some((skill) => ["README.md", ".atl", ".opencode", "graphify-out"].includes(skill)), false);
});

test("orders equal scores deterministically by skill name", () => {
  const data = fixture("tie-candidate");
  writeSkill(data.canonical, "alpha-skill");
  writeSkill(data.canonical, "beta-skill");
  const graphData = graph([
    graphNode("candidate", "upstream", "tie-candidate/SKILL.md", "Shared semantic token"),
    graphNode("alpha", "canonical", "alpha-skill/SKILL.md", "Shared semantic token"),
    graphNode("beta", "canonical", "beta-skill/SKILL.md", "Shared semantic token"),
  ]);

  const first = shortlist(data, graphData);
  const second = shortlist(data, graphData);
  assert.deepEqual(first, second);
  assert.deepEqual(skills(first), ["alpha-skill", "beta-skill"]);
});

test("honors a bounded limit and never returns more than the hard cap", () => {
  const data = fixture("limited-candidate");
  const nodes = [graphNode("candidate", "upstream", "limited-candidate/SKILL.md", "Shared bounded token")];
  for (const skill of ["alpha-skill", "beta-skill", "gamma-skill", "delta-skill", "epsilon-skill"]) {
    writeSkill(data.canonical, skill);
    nodes.push(graphNode(skill, "canonical", `${skill}/SKILL.md`, "Shared bounded token"));
  }

  const limited = shortlist(data, graph(nodes), data.candidate, { limit: 2 });
  assert.equal(limited.limit, 2);
  assert.equal(limited.canonicalShortlist.length, 2);

  const capped = shortlist(data, graph(nodes), data.candidate, { limit: 1000 });
  assert.equal(capped.limit, 8);
  assert.equal(capped.canonicalShortlist.length, 5);
});

test("returns a compact successful fallback when the graph file is missing", () => {
  const data = fixture("missing-graph-candidate");
  const result = shortlistFromFile({
    graphPath: path.join(data.base, "missing.json"),
    candidate: data.candidate,
    upstreamRoot: data.upstream,
    canonicalRoot: data.canonical,
  });

  assert.deepEqual(result, { available: false, reason: "graph-missing" });
});

test("returns a compact successful fallback for malformed graph JSON and schema", () => {
  const data = fixture("malformed-graph-candidate");
  const malformedJson = path.join(data.base, "malformed.json");
  fs.writeFileSync(malformedJson, "{not-json");
  assert.deepEqual(shortlistFromFile({
    graphPath: malformedJson,
    candidate: data.candidate,
    upstreamRoot: data.upstream,
    canonicalRoot: data.canonical,
  }), { available: false, reason: "graph-invalid-json" });

  const malformedSchema = path.join(data.base, "schema.json");
  fs.writeFileSync(malformedSchema, JSON.stringify({ nodes: [], links: {} }));
  assert.deepEqual(shortlistFromFile({
    graphPath: malformedSchema,
    candidate: data.candidate,
    upstreamRoot: data.upstream,
    canonicalRoot: data.canonical,
  }), { available: false, reason: "graph-schema" });
});

test("keeps a valid graph available when no canonical counterpart is useful", () => {
  const data = fixture("unique-candidate");
  const result = shortlist(data, graph([
    graphNode("candidate", "upstream", "unique-candidate/SKILL.md", "Unique workflow"),
  ]));

  assert.deepEqual(result, {
    available: true,
    candidate: "unique-candidate",
    candidateRepo: "upstream",
    limit: 8,
    canonicalShortlist: [],
  });
});

test("requires an upstream graph anchor for the direct candidate", () => {
  const data = fixture("absent-candidate");
  const result = shortlist(data, graph([
    graphNode("other", "upstream", "other-skill/SKILL.md", "Other skill"),
  ]));

  assert.deepEqual(result, { available: false, reason: "candidate-absent" });
});

test("strongly prioritizes a real same-name canonical counterpart", () => {
  const data = fixture("same-name");
  writeSkill(data.canonical, "same-name");
  writeSkill(data.canonical, "semantic-match");
  const result = shortlist(data, graph([
    graphNode("candidate", "upstream", "same-name/SKILL.md", "Distinct workflow semantic match"),
    graphNode("same-name", "canonical", "same-name/SKILL.md", "Unrelated local wording"),
    graphNode("semantic", "canonical", "semantic-match/SKILL.md", "Distinct workflow semantic match"),
  ]));

  assert.equal(result.canonicalShortlist[0].skill, "same-name");
  assert.equal(result.canonicalShortlist[0].score > result.canonicalShortlist[1].score, true);
  assert.equal(result.canonicalShortlist[0].reasons.includes("same skill root"), true);
});

test("does not emit authority conclusions or fields", () => {
  const data = fixture("safe-candidate");
  writeSkill(data.canonical, "safe-counterpart");
  const result = shortlist(data, graph([
    graphNode("candidate", "upstream", "safe-candidate/SKILL.md", "Unique safe workflow"),
    graphNode("counterpart", "canonical", "safe-counterpart/SKILL.md", "Unique safe workflow"),
  ]));
  const serialized = JSON.stringify(result);

  assert.equal(/Provenance|Curation authorization|ownership|approval/i.test(serialized), false);
  assert.deepEqual(Object.keys(result), ["available", "candidate", "candidateRepo", "limit", "canonicalShortlist"]);
});

test("rejects nested, traversal, and backslash candidate forms", () => {
  const data = fixture("safe-candidate");
  const graphData = graph([
    graphNode("candidate", "upstream", "safe-candidate/SKILL.md", "Unique workflow"),
  ]);
  for (const candidate of ["nested/skill", "../escape", "safe\\candidate", "/absolute"]) {
    assert.deepEqual(shortlist(data, graphData, candidate), { available: false, reason: "candidate-invalid" });
  }
});

test("accepts source-less graph concepts while requiring the source_file field on every node", () => {
  const data = fixture("source-less-candidate");
  writeSkill(data.canonical, "source-less-counterpart");
  const graphData = graph([
    graphNode("candidate", "upstream", "source-less-candidate/SKILL.md", "Workflow concept"),
    graphNode("counterpart", "canonical", "source-less-counterpart/SKILL.md", "Workflow concept"),
    graphNode("concept", "canonical", "", "Workflow concept"),
    graphNode("null-concept", "upstream", "source-less-candidate/concepts/workflow.md", "Workflow concept", { source_file: null }),
  ], [
    { source: "candidate", target: "concept", relation: "references" },
  ]);
  assert.equal(shortlist(data, graphData).available, true);

  const missingSource = graph([{
    id: "candidate",
    repo: "upstream",
    label: "Workflow concept",
    norm_label: "workflow concept",
  }]);
  assert.deepEqual(shortlist(data, missingSource), { available: false, reason: "graph-node-shape" });
});

test("CLI keeps unavailable output compact and exits successfully", () => {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, "--graph", "/does/not/exist/graph.json", "--candidate", "missing-skill"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { available: false, reason: "graph-missing" });
  assert.equal(result.stderr, "");
});
