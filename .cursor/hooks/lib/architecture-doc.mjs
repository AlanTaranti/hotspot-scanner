/**
 * Lint helpers for .specs/codebase/ARCHITECTURE.md (Design SoT drift guards).
 * @see .cursor/rules/architecture-sot.mdc
 */

export const ARCHITECTURE_REL_PATH = ".specs/codebase/ARCHITECTURE.md";

/** Soft size warning (~context-limits warning band). Smoke does not fail on size. */
export const LINE_WARN = 450;

const MILESTONE_RE = /\bM\d+\b/g;
const HOTSPOT_RE = /HOTSPOT-\d+/gi;

/**
 * @param {string} text
 * @returns {{ bannedMatches: string[], lineCount: number, overSize: boolean }}
 */
export function lintArchitectureDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();

  for (const re of [MILESTONE_RE, HOTSPOT_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      banned.add(match[0]);
    }
  }

  const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length;
  return {
    bannedMatches: [...banned].sort(),
    lineCount,
    overSize: lineCount > LINE_WARN,
  };
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isArchitectureDocPath(relPath) {
  if (!relPath || typeof relPath !== "string") return false;
  const n = relPath.replace(/\\/g, "/");
  return (
    n === ARCHITECTURE_REL_PATH ||
    n.endsWith("/ARCHITECTURE.md") ||
    n === "ARCHITECTURE.md"
  );
}

export const ARCHITECTURE_SOT_CONTEXT = `ARCHITECTURE.md is the Design SoT (.cursor/rules/architecture-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/sister-milestone voice. Allowed: ADR-*, RT-*, present-tense modules/pipelines/contracts. Milestone history → ROADMAP/STATE/features.`;
