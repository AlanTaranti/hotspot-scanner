import { extractEditPath } from "./paths.mjs";
import { loadState, saveState, trackPathInState } from "./state.mjs";

/**
 * @param {Record<string, unknown>} input
 * @returns {import("./state.mjs").SessionState | null}
 */
export function trackEditFromToolInput(input) {
  const relPath = extractEditPath(input.tool_input);
  if (!relPath) return null;

  const state = loadState(input);
  const next = trackPathInState(state, relPath);
  saveState(input, next);
  return next;
}

/**
 * @param {Record<string, unknown>} input
 * @param {string | null} relPath
 * @returns {import("./state.mjs").SessionState | null}
 */
export function trackEditFromPath(input, relPath) {
  if (!relPath) return null;

  const state = loadState(input);
  const next = trackPathInState(state, relPath);
  saveState(input, next);
  return next;
}
