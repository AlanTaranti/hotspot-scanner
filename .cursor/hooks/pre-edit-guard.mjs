#!/usr/bin/env node
import { allow, deny, ask } from "./lib/respond.mjs";
import {
  extractEditContent,
  extractEditPath,
  FRAGILE_CONTEXT,
  isFragilePath,
  OWNERSHIP_PATH_RE,
  PLANNER_BLOCKED_RE,
  tsconfigAddsBinInclude,
  TSCONFIG_RE,
} from "./lib/paths.mjs";
import {
  README_SOT_CONTEXT,
  AGENTS_SOT_CONTEXT,
  ARCHITECTURE_SOT_CONTEXT,
  CONCERNS_SOT_CONTEXT,
  CONTRIBUTING_SOT_CONTEXT,
  CONVENTIONS_SOT_CONTEXT,
  INTEGRATIONS_SOT_CONTEXT,
  PROJECT_SOT_CONTEXT,
  ROADMAP_SOT_CONTEXT,
  STATE_SOT_CONTEXT,
  STACK_SOT_CONTEXT,
  STRUCTURE_SOT_CONTEXT,
  TESTING_SOT_CONTEXT,
  isAgentsDocPath,
  isArchitectureDocPath,
  isConcernsDocPath,
  isContributingDocPath,
  isConventionsDocPath,
  isIntegrationsDocPath,
  isProjectDocPath,
  isReadmeDocPath,
  isRoadmapDocPath,
  isStateDocPath,
  isStackDocPath,
  isStructureDocPath,
  isTestingDocPath,
  lintAgentsDoc,
  lintArchitectureDoc,
  lintConcernsDoc,
  lintContributingDoc,
  lintConventionsDoc,
  lintIntegrationsDoc,
  lintProjectDoc,
  lintReadmeDoc,
  lintRoadmapDoc,
  lintStateDoc,
  lintStackDoc,
  lintStructureDoc,
  lintTestingDoc,
} from "./lib/living-sot-doc.mjs";
import { getWorkspaceRoot, loadState, readStdinJson } from "./lib/state.mjs";

const input = await readStdinJson();
const state = loadState(input);
const workspaceRoot = getWorkspaceRoot(input);
const relPath = extractEditPath(input.tool_input, workspaceRoot);

if (!relPath) {
  allow();
  process.exit(0);
}

if (
  state.activeSubagent === "implementer" &&
  state.orchestrated &&
  OWNERSHIP_PATH_RE.test(relPath)
) {
  deny(
    "Orchestrated implementer cannot edit tasks.md or ROADMAP.md — only orchestrator-implementer updates Status and roadmap.",
    "See orchestrated-implementer.md and roadmap-sync.md.",
  );
  process.exit(0);
}

if (state.activeSubagent === "planner-feature" && PLANNER_BLOCKED_RE.test(relPath)) {
  deny(
    "Planning session: planner-feature does not edit src/, bin/, or tests/. Artifacts stay under .specs/features/ (planning-session-boundary.md).",
    "Planning session boundary — Status Planned, no Execute in this session.",
  );
  process.exit(0);
}

if (TSCONFIG_RE.test(relPath)) {
  const content = extractEditContent(input.tool_input);
  if (tsconfigAddsBinInclude(content)) {
    deny(
      "Do not add bin/ to tsconfig.json include without reconciling tsconfig.bin.json — causes duplicate output (bin-build.mdc).",
      "bin/ compiles via tsconfig.bin.json, not the root tsconfig.json.",
    );
    process.exit(0);
  }
}

if (isArchitectureDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintArchitectureDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `ARCHITECTURE.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
      `${ARCHITECTURE_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isConcernsDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintConcernsDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `CONCERNS.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
      `${CONCERNS_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isIntegrationsDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintIntegrationsDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `INTEGRATIONS.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
      `${INTEGRATIONS_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isStackDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintStackDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `STACK.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
      `${STACK_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isStructureDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintStructureDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `STRUCTURE.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
      `${STRUCTURE_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isTestingDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintTestingDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `TESTING.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
      `${TESTING_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isConventionsDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintConventionsDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `CONVENTIONS.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone changelog voice or confirm intentional exception.`,
      `${CONVENTIONS_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isProjectDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintProjectDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `PROJECT.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
      `${PROJECT_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isRoadmapDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintRoadmapDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `ROADMAP.md edit introduces forbidden drift patterns (${bannedMatches.join(", ")}). Use lean milestone template (roadmap-sot) or confirm intentional exception.`,
      `${ROADMAP_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isStateDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintStateDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `STATE.md edit introduces forbidden execute-log drift (${bannedMatches.join(", ")}). Keep lasting locks only (state-sot) or confirm intentional exception.`,
      `${STATE_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isAgentsDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintAgentsDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `AGENTS.md edit introduces forbidden tags (${bannedMatches.join(", ")}). Remove milestone changelog voice or confirm intentional exception.`,
      `${AGENTS_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isContributingDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintContributingDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `CONTRIBUTING.md edit introduces forbidden SoT-mirror content (${bannedMatches.join(", ")}). Link STRUCTURE/TESTING/INTEGRATIONS/CONCERNS/AGENTS instead or confirm intentional exception.`,
      `${CONTRIBUTING_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

if (isReadmeDocPath(relPath)) {
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = lintReadmeDoc(content);
  if (bannedMatches.length > 0) {
    ask(
      `README.md edit introduces forbidden adoption-SoT drift (${bannedMatches.join(", ")}). Put encyclopedias in docs/cli-reference.md (workflows in docs/recipes.md) or confirm intentional exception.`,
      `${README_SOT_CONTEXT} Matches: ${bannedMatches.join(", ")}`,
    );
    process.exit(0);
  }
}

const isProductionFragile =
  isFragilePath(relPath) && !/\.test\.ts$/.test(relPath);
const fragileAckPaths = state.fragileAckPaths ?? [];

if (isProductionFragile && !fragileAckPaths.includes(relPath)) {
  ask(
    `Edit in fragile area (${relPath}). Confirm you will update co-located Vitest tests before marking Complete.`,
    `Fragile scanner area. ${FRAGILE_CONTEXT} Path: ${relPath}`,
  );
  process.exit(0);
}

allow();
process.exit(0);
