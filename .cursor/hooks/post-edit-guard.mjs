#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { additionalContext, emptyOk } from "./lib/respond.mjs";
import {
  extractEditPath,
  FRAGILE_CONTEXT,
  isFragilePath,
  isFragileScoringPath,
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

if (workspaceRoot) {
  for (const entry of LIVING_SOT_ENTRIES) {
    if (!entry.isPath(relPath)) continue;
    // docs/*: lint the edited file path; other entries use canonical relPath
    const fileRel =
      entry.id === "docs" ? relPath.replace(/\\/g, "/") : entry.relPath;
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
