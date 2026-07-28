#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { additionalContext, emptyOk } from "./lib/respond.mjs";
import {
  extractEditPath,
  FRAGILE_CONTEXT,
  isFragilePath,
  isFragileScoringPath,
  PLANNER_BLOCKED_RE,
  SCORING_FORMULA_CONTEXT,
} from "./lib/paths.mjs";
import { LIVING_SOT_ENTRIES } from "./lib/living-sot-doc.mjs";
import {
  getWorkspaceRoot,
  loadState,
  readStdinJson,
  saveState,
} from "./lib/state.mjs";
import { trackEditFromToolInput } from "./lib/track-path.mjs";

const input = await readStdinJson();
trackEditFromToolInput(input);

const workspaceRoot = getWorkspaceRoot(input);
const relPath = extractEditPath(input.tool_input, workspaceRoot);

if (relPath) {
  const state = loadState(input);
  /** @type {Partial<import('./lib/state.mjs').SessionState>} */
  const patch = {};

  const isProductionFragile =
    isFragilePath(relPath) && !/\.test\.ts$/.test(relPath);
  const fragileAckPaths = state.fragileAckPaths ?? [];
  if (isProductionFragile && !fragileAckPaths.includes(relPath)) {
    patch.fragileAckPaths = [...fragileAckPaths, relPath];
  }

  // The planning-boundary ask already ran (or did not apply) for this edit
  if (
    !state.activeSubagent &&
    !state.planningBoundaryAcked &&
    PLANNER_BLOCKED_RE.test(relPath)
  ) {
    patch.planningBoundaryAcked = true;
  }

  if (Object.keys(patch).length > 0) saveState(input, patch);
}

if (!relPath) {
  emptyOk();
  process.exit(0);
}

const messages = [];

if (isFragilePath(relPath)) {
  messages.push(`[${relPath}] ${FRAGILE_CONTEXT}`);
}

if (isFragileScoringPath(relPath)) {
  messages.push(`[${relPath}] ${SCORING_FORMULA_CONTEXT}`);
}

if (workspaceRoot) {
  for (const entry of LIVING_SOT_ENTRIES) {
    if (!entry.isPath(relPath)) continue;
    // Glob entries (docs/, skills, agent roles) lint the edited file itself
    const fileRel = entry.perFile ? relPath.replace(/\\/g, "/") : entry.relPath;
    const abs = path.join(workspaceRoot, fileRel);
    try {
      const text = fs.readFileSync(abs, "utf8");
      const { bannedMatches, lineCount, overSize } = entry.lint(text);
      if (bannedMatches.length > 0) {
        messages.push(
          `[${fileRel}] ${entry.bannedLabel}: ${bannedMatches.join(", ")}. ${entry.sotContext}`,
        );
      }
      if (overSize && entry.lineWarn != null && entry.sizeHint) {
        messages.push(
          `[${fileRel}] Soft size warning: ${lineCount} lines (warn at ${entry.lineWarn}). ${entry.sizeHint}`,
        );
      }
    } catch {
      // File missing mid-edit — skip
    }
  }
}

if (messages.length > 0) {
  additionalContext(messages.join("\n\n"));
} else {
  emptyOk();
}
process.exit(0);
