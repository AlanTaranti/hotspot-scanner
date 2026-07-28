/**
 * Shared `tasks.md` Status helpers. Planning boundary SoT:
 * `.cursor/skills/vitals-spec-driven/references/planning-session-boundary.md`.
 */
import fs from "node:fs";
import path from "node:path";

/** Status is declared in the header block; reading more would waste I/O. */
const STATUS_HEAD_BYTES = 4096;

/** First `Status:` / `**Status**:` declaration line of a tasks.md header. */
const STATUS_LINE_RE =
  /^\*{0,2}Status\*{0,2}:\s*`?\*{0,2}([A-Za-z][A-Za-z ]*?)\*{0,2}`?\s*$/m;

export const IN_PROGRESS_STATUS_RE = /^In Progress$/i;
export const PLANNED_STATUS_RE = /^Planned$/i;
export const DRAFT_OR_PLANNED_STATUS_RE = /^(?:Draft|Planned)$/i;

/**
 * Header Status value of a tasks.md, or null when absent. Only the first
 * declaration counts — later prose such as `**Status: Planned**` in a handoff
 * note must not override a promoted header.
 * @param {string} text
 * @returns {string | null}
 */
export function readTasksStatus(text) {
  const source = typeof text === "string" ? text : "";
  const match = STATUS_LINE_RE.exec(source);
  return match ? match[1].trim() : null;
}

/**
 * @param {string} text
 * @param {RegExp} statusRe
 * @returns {boolean}
 */
export function tasksStatusMatches(text, statusRe) {
  const status = readTasksStatus(text);
  return status !== null && statusRe.test(status);
}

/**
 * @param {string} file
 * @returns {string}
 */
function readHead(file) {
  const fd = fs.openSync(file, "r");
  try {
    const buffer = Buffer.alloc(STATUS_HEAD_BYTES);
    const bytes = fs.readSync(fd, buffer, 0, STATUS_HEAD_BYTES, 0);
    const text = buffer.subarray(0, bytes).toString("utf8");
    if (bytes < STATUS_HEAD_BYTES) return text;
    // Drop a possibly truncated trailing line so line anchors stay valid
    return text.slice(0, text.lastIndexOf("\n") + 1);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Feature slugs whose `tasks.md` header Status matches `statusRe`.
 * @param {string} workspaceRoot
 * @param {RegExp} statusRe
 * @returns {string[]}
 */
export function findFeaturesByStatus(workspaceRoot, statusRe) {
  const featuresDir = path.join(workspaceRoot, ".specs/features");
  if (!fs.existsSync(featuresDir)) return [];

  const slugs = [];
  for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tasksPath = path.join(featuresDir, entry.name, "tasks.md");
    if (!fs.existsSync(tasksPath)) continue;
    try {
      if (tasksStatusMatches(readHead(tasksPath), statusRe)) {
        slugs.push(entry.name);
      }
    } catch {
      // Unreadable feature — skip
    }
  }
  return slugs;
}

/**
 * @param {string} workspaceRoot
 * @returns {string[]}
 */
export function findUnpromotedFeatures(workspaceRoot) {
  return findFeaturesByStatus(workspaceRoot, DRAFT_OR_PLANNED_STATUS_RE);
}
