#!/usr/bin/env node
import { additionalContext, emptyOk } from "./lib/respond.mjs";
import {
  extractEditPath,
  FRAGILE_CONTEXT,
  isFragilePath,
  isFragileScoringPath,
  SCORING_FORMULA_CONTEXT,
} from "./lib/paths.mjs";
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
  const isProductionFragile =
    isFragilePath(relPath) && !/\.test\.ts$/.test(relPath);
  if (isProductionFragile) {
    const state = loadState(input);
    const fragileAckPaths = state.fragileAckPaths ?? [];
    if (!fragileAckPaths.includes(relPath)) {
      saveState(input, { fragileAckPaths: [...fragileAckPaths, relPath] });
    }
  }
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

if (messages.length > 0) {
  additionalContext(messages.join("\n\n"));
  process.exit(0);
}

emptyOk();
process.exit(0);
