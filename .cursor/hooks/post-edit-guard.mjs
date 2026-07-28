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
import {
  ARCHITECTURE_REL_PATH,
  ARCHITECTURE_SOT_CONTEXT,
  CONCERNS_REL_PATH,
  CONCERNS_SOT_CONTEXT,
  CONVENTIONS_REL_PATH,
  CONVENTIONS_SOT_CONTEXT,
  INTEGRATIONS_REL_PATH,
  INTEGRATIONS_SOT_CONTEXT,
  STACK_REL_PATH,
  STACK_SOT_CONTEXT,
  STRUCTURE_REL_PATH,
  STRUCTURE_SOT_CONTEXT,
  TESTING_REL_PATH,
  TESTING_SOT_CONTEXT,
  isArchitectureDocPath,
  isConcernsDocPath,
  isConventionsDocPath,
  isIntegrationsDocPath,
  isStackDocPath,
  isStructureDocPath,
  isTestingDocPath,
  LINE_WARN,
  lintArchitectureDoc,
  lintConcernsDoc,
  lintConventionsDoc,
  lintIntegrationsDoc,
  lintStackDoc,
  lintStructureDoc,
  lintTestingDoc,
} from "./lib/living-sot-doc.mjs";
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

if (isArchitectureDocPath(relPath) && workspaceRoot) {
  const abs = path.join(workspaceRoot, ARCHITECTURE_REL_PATH);
  try {
    const text = fs.readFileSync(abs, "utf8");
    const { bannedMatches, lineCount, overSize } = lintArchitectureDoc(text);
    if (bannedMatches.length > 0) {
      messages.push(
        `[${ARCHITECTURE_REL_PATH}] Forbidden tags still present: ${bannedMatches.join(", ")}. ${ARCHITECTURE_SOT_CONTEXT}`,
      );
    }
    if (overSize) {
      messages.push(
        `[${ARCHITECTURE_REL_PATH}] Soft size warning: ${lineCount} lines (warn at ${LINE_WARN}). Slim UX/history; keep modules/pipelines/contracts only.`,
      );
    }
  } catch {
    // File missing mid-edit — skip
  }
}

if (isConcernsDocPath(relPath) && workspaceRoot) {
  const abs = path.join(workspaceRoot, CONCERNS_REL_PATH);
  try {
    const text = fs.readFileSync(abs, "utf8");
    const { bannedMatches } = lintConcernsDoc(text);
    if (bannedMatches.length > 0) {
      messages.push(
        `[${CONCERNS_REL_PATH}] Forbidden tags still present: ${bannedMatches.join(", ")}. ${CONCERNS_SOT_CONTEXT}`,
      );
    }
  } catch {
    // File missing mid-edit — skip
  }
}

if (isIntegrationsDocPath(relPath) && workspaceRoot) {
  const abs = path.join(workspaceRoot, INTEGRATIONS_REL_PATH);
  try {
    const text = fs.readFileSync(abs, "utf8");
    const { bannedMatches } = lintIntegrationsDoc(text);
    if (bannedMatches.length > 0) {
      messages.push(
        `[${INTEGRATIONS_REL_PATH}] Forbidden tags still present: ${bannedMatches.join(", ")}. ${INTEGRATIONS_SOT_CONTEXT}`,
      );
    }
  } catch {
    // File missing mid-edit — skip
  }
}

if (isStackDocPath(relPath) && workspaceRoot) {
  const abs = path.join(workspaceRoot, STACK_REL_PATH);
  try {
    const text = fs.readFileSync(abs, "utf8");
    const { bannedMatches } = lintStackDoc(text);
    if (bannedMatches.length > 0) {
      messages.push(
        `[${STACK_REL_PATH}] Forbidden tags still present: ${bannedMatches.join(", ")}. ${STACK_SOT_CONTEXT}`,
      );
    }
  } catch {
    // File missing mid-edit — skip
  }
}

if (isStructureDocPath(relPath) && workspaceRoot) {
  const abs = path.join(workspaceRoot, STRUCTURE_REL_PATH);
  try {
    const text = fs.readFileSync(abs, "utf8");
    const { bannedMatches } = lintStructureDoc(text);
    if (bannedMatches.length > 0) {
      messages.push(
        `[${STRUCTURE_REL_PATH}] Forbidden tags still present: ${bannedMatches.join(", ")}. ${STRUCTURE_SOT_CONTEXT}`,
      );
    }
  } catch {
    // File missing mid-edit — skip
  }
}

if (isTestingDocPath(relPath) && workspaceRoot) {
  const abs = path.join(workspaceRoot, TESTING_REL_PATH);
  try {
    const text = fs.readFileSync(abs, "utf8");
    const { bannedMatches } = lintTestingDoc(text);
    if (bannedMatches.length > 0) {
      messages.push(
        `[${TESTING_REL_PATH}] Forbidden tags still present: ${bannedMatches.join(", ")}. ${TESTING_SOT_CONTEXT}`,
      );
    }
  } catch {
    // File missing mid-edit — skip
  }
}

if (isConventionsDocPath(relPath) && workspaceRoot) {
  const abs = path.join(workspaceRoot, CONVENTIONS_REL_PATH);
  try {
    const text = fs.readFileSync(abs, "utf8");
    const { bannedMatches } = lintConventionsDoc(text);
    if (bannedMatches.length > 0) {
      messages.push(
        `[${CONVENTIONS_REL_PATH}] Forbidden tags still present: ${bannedMatches.join(", ")}. ${CONVENTIONS_SOT_CONTEXT}`,
      );
    }
  } catch {
    // File missing mid-edit — skip
  }
}

if (messages.length > 0) {
  additionalContext(messages.join("\n\n"));
  process.exit(0);
}

emptyOk();
process.exit(0);
