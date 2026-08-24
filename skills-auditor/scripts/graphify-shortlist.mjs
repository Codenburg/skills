#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 8;
const MAX_REASON_TOKENS = 6;
const MAX_SEMANTIC_MATCHES = 6;
const MAX_FAMILY_MATCHES = 3;
const MAX_ANCHOR_TOKENS = 32;
const MAX_SECONDARY_TOKENS = 16;
const MAX_SECONDARY_MATCHES = 3;
const MIN_FAMILY_TOKEN_WEIGHT = 24;
const MAX_COMMUNITY_MATCHES = 2;
const MAX_DIRECT_RELATIONS = 3;
const MAX_HYPEREDGE_MATCHES = 2;

const AUTHORITY_TOKENS = new Set([
  "approval",
  "authority",
  "authorized",
  "canonical",
  "curation",
  "excluded",
  "managed",
  "ownership",
  "pending",
  "permission",
  "protected",
  "provenance",
]);

const SEMANTIC_STOP_WORDS = new Set([
  "all",
  "always",
  "apache",
  "advanced",
  "as",
  "assert",
  "avoid",
  "best",
  "can",
  "class",
  "config",
  "configuration",
  "copy",
  "data",
  "document",
  "documentation",
  "docs",
  "ensure",
  "external",
  "file",
  "files",
  "for",
  "from",
  "function",
  "functions",
  "factories",
  "guide",
  "guides",
  "implementation",
  "input",
  "integration",
  "into",
  "library",
  "license",
  "local",
  "markdown",
  "md",
  "material",
  "mit",
  "method",
  "methods",
  "never",
  "new",
  "node",
  "nodes",
  "only",
  "optional",
  "output",
  "pattern",
  "patterns",
  "practices",
  "reference",
  "references",
  "repo",
  "repository",
  "required",
  "return",
  "returns",
  "section",
  "sections",
  "script",
  "should",
  "skill",
  "skills",
  "snapshot",
  "source",
  "support",
  "target",
  "test",
  "the",
  "this",
  "token",
  "type",
  "to",
  "using",
  "use",
  "used",
  "uses",
  "via",
  "when",
  "with",
  "without",
  "your",
]);

const ADMISSION_GENERIC_TOKENS = new Set([
  "act",
  "assert",
  "copy",
  "factories",
  "integration",
  "library",
  "material",
  "script",
  "snapshot",
  "test",
  "token",
]);

const USAGE = `Usage:
  node skills-auditor/scripts/graphify-shortlist.mjs --graph graphify-out/graph.json --candidate <direct-root> [--upstream-root <path>] [--limit 8]

The candidate is one direct upstream skill directory name, for example \`frontend-design\`.
--root is accepted as an alias for --upstream-root. --canonical-root is optional and is
used only to validate real canonical <skill>/SKILL.md directories in fixture or alternate roots.`;

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CANONICAL_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_UPSTREAM_ROOT = path.join(os.homedir(), ".agents", "skills");

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unavailable(reason) {
  return { available: false, reason };
}

function isSafeDirectRoot(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && value !== "."
    && value !== ".."
    && !value.includes("\\")
    && !value.includes("\0")
    && !path.posix.isAbsolute(value)
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function validateCandidate(candidate) {
  return isSafeDirectRoot(candidate) ? null : unavailable("candidate-invalid");
}

function isSafeSourceFile(sourceFile) {
  if (
    typeof sourceFile !== "string"
    || sourceFile.length === 0
    || sourceFile.includes("\\")
    || sourceFile.includes("\0")
    || path.posix.isAbsolute(sourceFile)
  ) {
    return false;
  }
  const normalizedSourceFile = sourceFile.endsWith("/") ? sourceFile.slice(0, -1) : sourceFile;
  if (
    normalizedSourceFile.length === 0
    || normalizedSourceFile.split("/").includes("..")
    || path.posix.normalize(normalizedSourceFile) !== normalizedSourceFile
  ) {
    return false;
  }
  return true;
}

function isValidGraphSourceFile(sourceFile) {
  return sourceFile === null || sourceFile === "" || isSafeSourceFile(sourceFile);
}

function sourceRoot(sourceFile) {
  return sourceFile.split("/", 1)[0];
}

function repoIdentity(node) {
  if (node.repo === "canonical" || node.repo === "upstream") return node.repo;
  if (node.repo === undefined && typeof node.id === "string") {
    const namespace = node.id.match(/^(canonical|upstream)::/);
    if (namespace) return namespace[1];
  }
  return null;
}

function validateGraph(graph) {
  if (!isObject(graph) || !Array.isArray(graph.nodes) || !Array.isArray(graph.links)) {
    return { ok: false, result: unavailable("graph-schema") };
  }

  const nodeById = new Map();
  const repoById = new Map();
  for (const node of graph.nodes) {
    if (
      !isObject(node)
      || typeof node.id !== "string"
      || node.id.length === 0
      || !Object.prototype.hasOwnProperty.call(node, "source_file")
      || !isValidGraphSourceFile(node.source_file)
    ) {
      return { ok: false, result: unavailable("graph-node-shape") };
    }
    const repo = repoIdentity(node);
    if (!repo) {
      return {
        ok: false,
        result: unavailable(typeof node.repo === "string" ? "graph-unsupported-repo" : "graph-missing-repo"),
      };
    }
    if (nodeById.has(node.id)) {
      return { ok: false, result: unavailable("graph-duplicate-node") };
    }
    nodeById.set(node.id, node);
    repoById.set(node.id, repo);
  }

  const links = [];
  for (const link of graph.links) {
    if (
      !isObject(link)
      || typeof link.source !== "string"
      || typeof link.target !== "string"
      || typeof link.relation !== "string"
      || link.relation.length === 0
      || !nodeById.has(link.source)
      || !nodeById.has(link.target)
    ) {
      return { ok: false, result: unavailable("graph-link-shape") };
    }
    links.push(link);
  }

  const hyperedges = [];
  if (graph.hyperedges !== undefined) {
    if (!Array.isArray(graph.hyperedges)) {
      return { ok: false, result: unavailable("graph-hyperedge-shape") };
    }
    for (const hyperedge of graph.hyperedges) {
      if (
        !isObject(hyperedge)
        || !Array.isArray(hyperedge.nodes)
        || hyperedge.nodes.some((nodeId) => typeof nodeId !== "string" || !nodeById.has(nodeId))
      ) {
        return { ok: false, result: unavailable("graph-hyperedge-shape") };
      }
      hyperedges.push(hyperedge);
    }
  }

  return { ok: true, nodeById, repoById, links, hyperedges };
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith(`~${path.sep}`) || value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function hasRealSkillRoot(root, skill, fsImpl = fs) {
  if (typeof root !== "string" || !isSafeDirectRoot(skill)) return false;
  try {
    const directory = fsImpl.lstatSync(path.join(root, skill));
    const skillFile = fsImpl.lstatSync(path.join(root, skill, "SKILL.md"));
    return directory.isDirectory()
      && !directory.isSymbolicLink()
      && skillFile.isFile()
      && !skillFile.isSymbolicLink();
  } catch {
    return false;
  }
}

function invokeSkillRootValidator(validator, root, skill) {
  try {
    return validator(skill, root) === true;
  } catch {
    return false;
  }
}

function tokenize(values) {
  const tokens = new Set();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    for (const token of normalized.split(" ")) {
      if (
        token.length >= 2
        && /[a-z]/.test(token)
        && !SEMANTIC_STOP_WORDS.has(token)
        && !AUTHORITY_TOKENS.has(token)
      ) {
        tokens.add(token);
      }
    }
  }
  return [...tokens].sort(compareStrings);
}

function nodeTokens(node) {
  return tokenize([node.label, node.norm_label]);
}

function familyTokens(values) {
  const expanded = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    expanded.push(value.replace(/([a-z])([0-9])/gi, "$1 $2").replace(/([0-9])([a-z])/gi, "$1 $2"));
  }
  return new Set(tokenize(expanded));
}

function rootFamilyTokens(skill) {
  return familyTokens([skill.split(/[-_.]/, 1)[0]]);
}

function addAll(target, values) {
  for (const value of values) target.add(value);
}

function capTokens(tokens, maximum) {
  return new Set([...tokens].sort(compareStrings).slice(0, maximum));
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value)).sort(compareStrings);
}

function tokenWeights(canonicalGroups) {
  const documentFrequency = new Map();
  for (const group of canonicalGroups.values()) {
    for (const token of group.primaryTokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const documentCount = Math.max(canonicalGroups.size, 1);
  const weights = new Map();
  for (const [token, frequency] of documentFrequency) {
    weights.set(token, Math.round((1 + Math.log((documentCount + 1) / (frequency + 1))) * 10));
  }
  return weights;
}

function rankedMatches(left, right, weights, maximum) {
  return intersection(left, right)
    .map((token) => ({ token, weight: weights.get(token) ?? 10 }))
    .sort((a, b) => b.weight - a.weight || compareStrings(a.token, b.token))
    .slice(0, maximum);
}

function mergeMatches(matchLists, maximum) {
  const byToken = new Map();
  for (const matches of matchLists) {
    for (const match of matches) {
      const existing = byToken.get(match.token);
      if (!existing || match.weight > existing.weight) byToken.set(match.token, match);
    }
  }
  return [...byToken.values()]
    .sort((a, b) => b.weight - a.weight || compareStrings(a.token, b.token))
    .slice(0, maximum);
}

function graphAdjacency(links) {
  const adjacency = new Map();
  for (const link of links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    if (!adjacency.has(link.target)) adjacency.set(link.target, []);
    adjacency.get(link.source).push(link);
    adjacency.get(link.target).push(link);
  }
  return adjacency;
}

function otherEndpoint(link, nodeId) {
  if (link.source === nodeId) return link.target;
  if (link.target === nodeId) return link.source;
  return null;
}

function communityKey(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function safeReasonTokens(values) {
  return tokenize(values).slice(0, MAX_REASON_TOKENS);
}

function buildShortlist(graph, candidate, options = {}) {
  const candidateError = validateCandidate(candidate);
  if (candidateError) return candidateError;

  const validated = validateGraph(graph);
  if (!validated.ok) return validated.result;

  const fsImpl = options.fsImpl ?? fs;
  const canonicalRoot = options.canonicalRoot ?? DEFAULT_CANONICAL_ROOT;
  const upstreamRoot = options.upstreamRoot ?? DEFAULT_UPSTREAM_ROOT;
  const canonicalValidator = options.canonicalSkillRootValidator
    ?? ((skill) => hasRealSkillRoot(canonicalRoot, skill, fsImpl));
  const upstreamValidator = options.upstreamSkillRootValidator
    ?? ((skill) => hasRealSkillRoot(upstreamRoot, skill, fsImpl));

  if (!invokeSkillRootValidator(upstreamValidator, upstreamRoot, candidate)) {
    return unavailable("candidate-root-unavailable");
  }

  const candidatePrefix = `${candidate}/`;
  const candidateNodes = graph.nodes.filter((node) => (
    validated.repoById.get(node.id) === "upstream"
    && typeof node.source_file === "string"
    && node.source_file.startsWith(candidatePrefix)
  ));
  if (!candidateNodes.some((node) => node.source_file === `${candidate}/SKILL.md`)) {
    return unavailable("candidate-absent");
  }

  const canonicalGroups = new Map();
  for (const node of graph.nodes) {
    if (validated.repoById.get(node.id) !== "canonical") continue;
    if (typeof node.source_file !== "string" || node.source_file.length === 0) continue;
    const skill = sourceRoot(node.source_file);
    if (!isSafeDirectRoot(skill)) continue;
    if (!canonicalGroups.has(skill)) {
      canonicalGroups.set(skill, {
        skill,
        nodes: [],
        nodeIds: new Set(),
        rootTokens: new Set(tokenize([skill])),
        rootFamilyTokens: rootFamilyTokens(skill),
        anchorTokens: new Set(),
        anchorFamilyTokens: new Set(),
        secondaryTokens: new Set(),
        communities: new Set(),
      });
    }
    const group = canonicalGroups.get(skill);
    group.nodes.push(node);
    group.nodeIds.add(node.id);
    if (node.source_file === `${skill}/SKILL.md`) {
      addAll(group.anchorTokens, nodeTokens(node));
      addAll(group.anchorFamilyTokens, nodeTokens(node));
    } else {
      addAll(group.secondaryTokens, nodeTokens(node));
    }
    const community = communityKey(node.community);
    if (community) group.communities.add(community);
  }

  for (const [skill, group] of [...canonicalGroups]) {
    if (!invokeSkillRootValidator(canonicalValidator, canonicalRoot, skill)) {
      canonicalGroups.delete(skill);
      continue;
    }
    group.anchorTokens = capTokens(group.anchorTokens, MAX_ANCHOR_TOKENS);
    group.anchorFamilyTokens = capTokens(group.anchorFamilyTokens, MAX_ANCHOR_TOKENS);
    group.secondaryTokens = capTokens(group.secondaryTokens, MAX_SECONDARY_TOKENS);
    group.primaryTokens = new Set([
      ...group.rootTokens,
      ...group.anchorTokens,
    ]);
  }

  const candidateRootTokens = new Set(tokenize([candidate]));
  const candidateRootFamilyTokens = rootFamilyTokens(candidate);
  const candidateAnchorTokens = new Set();
  const candidateAnchorFamilyTokens = new Set();
  const candidateSecondaryTokens = new Set();
  for (const node of candidateNodes) {
    if (node.source_file === `${candidate}/SKILL.md`) {
      addAll(candidateAnchorTokens, nodeTokens(node));
      addAll(candidateAnchorFamilyTokens, nodeTokens(node));
    } else {
      addAll(candidateSecondaryTokens, nodeTokens(node));
    }
  }
  const candidatePrimaryTokens = new Set([
    ...candidateRootTokens,
    ...capTokens(candidateAnchorTokens, MAX_ANCHOR_TOKENS),
  ]);
  const candidateSecondaryEvidence = capTokens(candidateSecondaryTokens, MAX_SECONDARY_TOKENS);
  const candidateAnchorFamilyEvidence = capTokens(candidateAnchorFamilyTokens, MAX_ANCHOR_TOKENS);
  const candidateCommunities = new Set(
    candidateNodes.map((node) => communityKey(node.community)).filter(Boolean),
  );
  const adjacency = graphAdjacency(validated.links);
  const directSignals = new Map();

  for (const candidateNode of candidateNodes) {
    for (const link of adjacency.get(candidateNode.id) ?? []) {
      const neighborId = otherEndpoint(link, candidateNode.id);
      if (!neighborId) continue;
       const neighbor = validated.nodeById.get(neighborId);
       if (!neighbor) continue;
       const neighborRepo = validated.repoById.get(neighbor.id);
      if (neighborRepo !== "canonical") continue;
      if (typeof neighbor.source_file !== "string" || neighbor.source_file.length === 0) continue;
      const skill = sourceRoot(neighbor.source_file);
      if (!canonicalGroups.has(skill)) continue;
      if (!directSignals.has(skill)) {
        directSignals.set(skill, { relations: new Set() });
      }
      const signal = directSignals.get(skill);
      signal.relations.add(link.relation);
    }
  }

  const hyperedgeSignals = new Map();
  for (const hyperedge of validated.hyperedges) {
    if (!hyperedge.nodes.some((nodeId) => candidateNodes.some((node) => node.id === nodeId))) continue;
    for (const nodeId of hyperedge.nodes) {
      const node = validated.nodeById.get(nodeId);
      if (!node || validated.repoById.get(node.id) !== "canonical") continue;
      if (typeof node.source_file !== "string" || node.source_file.length === 0) continue;
      const skill = sourceRoot(node.source_file);
      if (!canonicalGroups.has(skill)) continue;
      if (!hyperedgeSignals.has(skill)) hyperedgeSignals.set(skill, new Set());
      hyperedgeSignals.get(skill).add(hyperedge.id ?? hyperedge.label ?? "hyperedge");
    }
  }

  const weights = tokenWeights(canonicalGroups);
  const ranked = [];
  for (const [skill, group] of [...canonicalGroups].sort(([left], [right]) => compareStrings(left, right))) {
    const rootFamilyMatches = rankedMatches(
      candidateRootFamilyTokens,
      group.rootFamilyTokens,
      weights,
      MAX_FAMILY_MATCHES,
    );
    const crossFamilyMatches = mergeMatches([
      rankedMatches(candidateRootFamilyTokens, group.anchorFamilyTokens, weights, MAX_FAMILY_MATCHES),
      rankedMatches(candidateAnchorFamilyEvidence, group.rootFamilyTokens, weights, MAX_FAMILY_MATCHES),
    ], MAX_FAMILY_MATCHES);
    const familyMatches = mergeMatches([rootFamilyMatches, crossFamilyMatches], MAX_FAMILY_MATCHES);
    const rootMatches = rankedMatches(candidateRootTokens, group.rootTokens, weights, MAX_SEMANTIC_MATCHES);
    const anchorMatches = rankedMatches(candidateAnchorTokens, group.anchorTokens, weights, MAX_SEMANTIC_MATCHES);
    const semanticMatches = rankedMatches(candidatePrimaryTokens, group.primaryTokens, weights, MAX_SEMANTIC_MATCHES);
    const secondaryMatches = mergeMatches([
      rankedMatches(candidatePrimaryTokens, group.secondaryTokens, weights, MAX_SECONDARY_MATCHES),
      rankedMatches(candidateSecondaryEvidence, group.primaryTokens, weights, MAX_SECONDARY_MATCHES),
    ], MAX_SECONDARY_MATCHES);
    const sharedCommunities = intersection(candidateCommunities, group.communities).slice(0, MAX_COMMUNITY_MATCHES);
    const direct = directSignals.get(skill) ?? { relations: new Set() };
    const relations = [...direct.relations].sort(compareStrings).slice(0, MAX_DIRECT_RELATIONS);
    const hyperedges = [...(hyperedgeSignals.get(skill) ?? new Set())]
      .map(String)
      .sort(compareStrings)
      .slice(0, MAX_HYPEREDGE_MATCHES);
    const sameRoot = skill === candidate;
    const materialFamilyMatches = familyMatches.filter((match) => (
      match.weight >= MIN_FAMILY_TOKEN_WEIGHT
      && !ADMISSION_GENERIC_TOKENS.has(match.token)
    ));
    const materialRootMatches = rootMatches.filter((match) => !ADMISSION_GENERIC_TOKENS.has(match.token));
    const materialAnchorMatches = anchorMatches.filter((match) => !ADMISSION_GENERIC_TOKENS.has(match.token));
    const materialSemanticMatches = semanticMatches.filter((match) => !ADMISSION_GENERIC_TOKENS.has(match.token));
    const materialSecondaryMatches = secondaryMatches.filter((match) => !ADMISSION_GENERIC_TOKENS.has(match.token));
    const graphSignal = sharedCommunities.length > 0 || relations.length > 0 || hyperedges.length > 0;
    const independentSemanticTokens = new Set([
      ...materialRootMatches.map((match) => match.token),
      ...materialAnchorMatches.map((match) => match.token),
    ]);
    const independentSemanticSignal = (
      materialRootMatches.length > 0
      && materialAnchorMatches.length > 0
      && independentSemanticTokens.size >= 2
    ) || materialSemanticMatches.length >= 2;
    const admitted = sameRoot
      || materialFamilyMatches.length > 0
      || independentSemanticSignal
      || (graphSignal && materialSemanticMatches.length > 0);

    if (!admitted) continue;

    const semanticScore = Math.min(100, materialSemanticMatches.reduce((sum, match) => sum + match.weight, 0));
    const familyScore = Math.min(40, materialFamilyMatches.reduce((sum, match) => sum + match.weight, 0));
    const secondaryScore = Math.min(12, materialSecondaryMatches.reduce((sum, match) => sum + Math.round(match.weight / 3), 0));
    const communityScore = Math.min(MAX_COMMUNITY_MATCHES, sharedCommunities.length) * 3;
    const relationScore = relations.length * 4;
    const hyperedgeScore = hyperedges.length * 5;
    const score = (sameRoot ? 1000 : 0)
      + semanticScore
      + familyScore
      + secondaryScore
      + communityScore
      + relationScore
      + hyperedgeScore;

    const reasons = [];
    if (sameRoot) reasons.push("same skill root");
    if (materialFamilyMatches.length > 0) {
      reasons.push(`shared skill family: ${safeReasonTokens(materialFamilyMatches.map((match) => match.token)).join(", ")}`);
    }
    if (materialRootMatches.length > 0) {
      reasons.push(`skill-root overlap: ${safeReasonTokens(materialRootMatches.map((match) => match.token)).join(", ")}`);
    }
    if (materialAnchorMatches.length > 0) {
      reasons.push(`SKILL.md anchor overlap: ${safeReasonTokens(materialAnchorMatches.map((match) => match.token)).join(", ")}`);
    } else if (materialSemanticMatches.length > 0) {
      reasons.push(`semantic token overlap: ${safeReasonTokens(materialSemanticMatches.map((match) => match.token)).join(", ")}`);
    }
    if (sharedCommunities.length > 0) reasons.push("shared community signal");
    if (relations.length > 0) {
      const relationTokens = safeReasonTokens(relations);
      reasons.push(relationTokens.length > 0 ? `linked graph relation: ${relationTokens.join(", ")}` : "linked graph relation");
    }
    if (materialSecondaryMatches.length > 0) {
      reasons.push(`capped secondary overlap: ${safeReasonTokens(materialSecondaryMatches.map((match) => match.token)).join(", ")}`);
    }
    if (hyperedges.length > 0) reasons.push("hyperedge proximity signal");

    ranked.push({ skill, score, reasons: reasons.slice(0, 5) });
  }

  const limit = normalizeLimit(options.limit ?? DEFAULT_LIMIT);
  ranked.sort((left, right) => right.score - left.score || compareStrings(left.skill, right.skill));
  return {
    available: true,
    candidate,
    candidateRepo: "upstream",
    limit,
    canonicalShortlist: ranked.slice(0, limit),
  };
}

function normalizeLimit(value) {
  if (!Number.isInteger(value) || value < 1) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

function readGraph(graphPath, fsImpl = fs) {
  let raw;
  try {
    raw = fsImpl.readFileSync(graphPath, "utf8");
  } catch (error) {
    return unavailable(error?.code === "ENOENT" ? "graph-missing" : "graph-unreadable");
  }
  try {
    return JSON.parse(raw);
  } catch {
    return unavailable("graph-invalid-json");
  }
}

function shortlistFromFile({ graphPath, candidate, upstreamRoot, canonicalRoot, limit }) {
  const graph = readGraph(graphPath);
  if (graph && graph.available === false) return graph;
  return buildShortlist(graph, candidate, { upstreamRoot, canonicalRoot, limit });
}

function nextValue(args, index) {
  const value = args[index + 1];
  return value === undefined || value.startsWith("-") ? null : value;
}

function parseArguments(args) {
  const options = {
    graphPath: "graphify-out/graph.json",
    candidate: null,
    upstreamRoot: DEFAULT_UPSTREAM_ROOT,
    canonicalRoot: DEFAULT_CANONICAL_ROOT,
    limit: DEFAULT_LIMIT,
  };
  const positional = [];
  let graphExplicit = false;
  let candidateExplicit = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (!argument.startsWith("-")) {
      positional.push(argument);
      continue;
    }

    const equalsIndex = argument.indexOf("=");
    const name = equalsIndex === -1 ? argument : argument.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? null : argument.slice(equalsIndex + 1);
    if (!["--graph", "--graph-path", "--candidate", "--source-path", "--upstream-root", "--root", "--canonical-root", "--limit"].includes(name)) {
      return { error: "cli-invalid" };
    }
    const value = inlineValue ?? nextValue(args, index);
    if (value === null || value.length === 0) return { error: "cli-invalid" };
    if (inlineValue === null) index += 1;

    if (name === "--graph" || name === "--graph-path") {
      options.graphPath = expandHome(value);
      graphExplicit = true;
    } else if (name === "--candidate" || name === "--source-path") {
      options.candidate = value;
      candidateExplicit = true;
    } else if (name === "--upstream-root" || name === "--root") {
      options.upstreamRoot = expandHome(value);
    } else if (name === "--canonical-root") {
      options.canonicalRoot = expandHome(value);
    } else if (name === "--limit") {
      if (!/^\d+$/.test(value)) return { error: "limit-invalid" };
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1) return { error: "limit-invalid" };
      options.limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  if (positional.length > 2) return { error: "cli-invalid" };
  if (positional.length === 2 && !graphExplicit && !candidateExplicit) {
    options.graphPath = expandHome(positional[0]);
    options.candidate = positional[1];
  } else if (positional.length === 1 && !candidateExplicit) {
    options.candidate = positional[0];
  } else if (positional.length > 0) {
    return { error: "cli-invalid" };
  }

  return options;
}

function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (parsed.error) {
    process.stdout.write(`${JSON.stringify(unavailable(parsed.error))}\n`);
    return;
  }
  const result = shortlistFromFile(parsed);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

export {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildShortlist,
  hasRealSkillRoot,
  parseArguments,
  readGraph,
  shortlistFromFile,
  tokenize,
};

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  main();
}
