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
import { LIVING_SOT_ENTRIES } from "./lib/living-sot-doc.mjs";
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
    "Promote tasks.md Status and use orchestrator-implementer in a new session for implementation.",
  );
  process.exit(0);
}

if (TSCONFIG_RE.test(relPath)) {
  const content = extractEditContent(input.tool_input);
  if (tsconfigAddsBinInclude(content)) {
    ask(
      "Do not add bin/ to tsconfig.json include without reconciling tsconfig.bin.json — causes duplicate output (bin-build.mdc).",
      "bin/ compiles via tsconfig.bin.json, not the root tsconfig.json.",
    );
    process.exit(0);
  }
}

for (const entry of LIVING_SOT_ENTRIES) {
  if (!entry.isPath(relPath)) continue;
  const content = extractEditContent(input.tool_input);
  const { bannedMatches } = entry.lint(content);
  if (bannedMatches.length > 0) {
    ask(
      entry.preEditAsk(bannedMatches),
      `${entry.sotContext} Matches: ${bannedMatches.join(", ")}`,
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
