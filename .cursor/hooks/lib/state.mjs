import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isCodePath,
  isFragilePath,
  isFragileScoringPath,
  toRelPath,
} from "./paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOKS_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.resolve(HOOKS_ROOT, "..", "hooks-state");

/** @returns {import('./state.mjs').SessionState} */
export function defaultState() {
  return {
    userAllowedCommit: false,
    activeSubagent: null,
    orchestrated: false,
    codeTouched: false,
    gatePassedAt: null,
    buildPassedAt: null,
    testPassedAt: null,
    fragileAckPaths: [],
    touchedFragile: [],
    touchedFragileScoring: false,
    touchedPaths: [],
    planningBoundaryAcked: false,
  };
}

/**
 * @typedef {Object} SessionState
 * @property {boolean} userAllowedCommit
 * @property {string | null} activeSubagent
 * @property {boolean} orchestrated
 * @property {boolean} codeTouched
 * @property {string | null} gatePassedAt
 * @property {string | null} buildPassedAt
 * @property {string | null} testPassedAt
 * @property {string[]} fragileAckPaths
 * @property {string[]} touchedFragile
 * @property {boolean} touchedFragileScoring
 * @property {string[]} touchedPaths
 * @property {boolean} planningBoundaryAcked
 */

/**
 * @param {Record<string, unknown>} input
 * @returns {string}
 */
export function getConversationId(input) {
  const id = input.conversation_id;
  return typeof id === "string" && id.length > 0 ? id : "default";
}

/**
 * @param {string} conversationId
 */
function stateFilePath(conversationId) {
  const safe = conversationId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(STATE_DIR, `${safe}.json`);
}

/**
 * @param {Record<string, unknown>} input
 * @returns {SessionState}
 */
export function loadState(input) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const file = stateFilePath(getConversationId(input));
  if (!fs.existsSync(file)) return defaultState();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return { ...defaultState(), ...raw };
  } catch {
    return defaultState();
  }
}

/**
 * @param {Record<string, unknown>} input
 * @param {Partial<SessionState>} patch
 * @returns {SessionState}
 */
export function saveState(input, patch) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const current = loadState(input);
  const next = { ...current, ...patch };
  fs.writeFileSync(
    stateFilePath(getConversationId(input)),
    JSON.stringify(next, null, 2),
  );
  return next;
}

/**
 * @param {Record<string, unknown>} input
 * @returns {string}
 */
export function getWorkspaceRoot(input) {
  const roots = input.workspace_roots;
  if (Array.isArray(roots) && typeof roots[0] === "string") {
    return roots[0];
  }
  const cwd = input.cwd;
  if (typeof cwd === "string") return cwd;
  return process.cwd();
}

/**
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text);
}

/**
 * @param {SessionState} state
 * @param {string | null} relPath
 * @returns {SessionState}
 */
export function trackPathInState(state, relPath) {
  if (!relPath) return state;
  const touchedPaths = state.touchedPaths.includes(relPath)
    ? state.touchedPaths
    : [...state.touchedPaths, relPath];

  let touchedFragile = state.touchedFragile;
  if (isFragilePath(relPath) && !touchedFragile.includes(relPath)) {
    touchedFragile = [...touchedFragile, relPath];
  }

  return {
    ...state,
    touchedPaths,
    touchedFragile,
    codeTouched: state.codeTouched || isCodePath(relPath),
    touchedFragileScoring:
      state.touchedFragileScoring || isFragileScoringPath(relPath),
  };
}

/**
 * @param {string} workspaceRoot
 * @param {SessionState} state
 */
function gateTimestampsCurrent(workspaceRoot, state) {
  const codePaths = state.touchedPaths
    .map((p) => toRelPath(p, workspaceRoot) ?? p)
    .filter((rel) => isCodePath(rel));
  if (codePaths.length === 0) return false;

  const hasCombined = Boolean(state.gatePassedAt);
  const hasSplit = Boolean(state.buildPassedAt) && Boolean(state.testPassedAt);
  if (!hasCombined && !hasSplit) return false;

  for (const rel of codePaths) {
    const abs = path.join(workspaceRoot, rel);
    let mtimeMs;
    try {
      mtimeMs = fs.statSync(abs).mtimeMs;
    } catch {
      return false;
    }

    let covered = false;
    if (hasCombined) {
      const gateTime = Date.parse(state.gatePassedAt);
      covered = !Number.isNaN(gateTime) && gateTime >= mtimeMs;
    }
    if (!covered && hasSplit) {
      const buildTime = Date.parse(state.buildPassedAt);
      const testTime = Date.parse(state.testPassedAt);
      covered =
        !Number.isNaN(buildTime) &&
        !Number.isNaN(testTime) &&
        buildTime >= mtimeMs &&
        testTime >= mtimeMs;
    }
    if (!covered) return false;
  }

  return true;
}

/**
 * @param {string} workspaceRoot
 * @param {SessionState} state
 */
export function gateStaleAfterEdits(workspaceRoot, state) {
  const hasCode =
    state.codeTouched ||
    state.touchedPaths.some((p) =>
      isCodePath(toRelPath(p, workspaceRoot) ?? p),
    );
  if (!hasCode) return false;
  return !gateTimestampsCurrent(workspaceRoot, state);
}

/**
 * @param {string | null | undefined} raw
 * @param {string | undefined | null} [workspaceRoot]
 */
export function trackPathFromAfterFileEdit(raw, workspaceRoot) {
  return toRelPath(typeof raw === "string" ? raw : null, workspaceRoot);
}
