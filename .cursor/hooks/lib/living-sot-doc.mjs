/**
 * Lint helpers for living SoT docs under .specs/codebase/
 * (ARCHITECTURE Design SoT + CONCERNS fragile-risk SoT + CONVENTIONS coding SoT
 * + INTEGRATIONS adapter SoT).
 * @see .cursor/rules/architecture-sot.mdc
 * @see .cursor/rules/concerns-sot.mdc
 * @see .cursor/rules/conventions-sot.mdc
 * @see .cursor/rules/integrations-sot.mdc
 */

export const ARCHITECTURE_REL_PATH = ".specs/codebase/ARCHITECTURE.md";
export const CONCERNS_REL_PATH = ".specs/codebase/CONCERNS.md";
export const CONVENTIONS_REL_PATH = ".specs/codebase/CONVENTIONS.md";
export const INTEGRATIONS_REL_PATH = ".specs/codebase/INTEGRATIONS.md";

/** Soft size warning for ARCHITECTURE (~context-limits warning band). Smoke does not fail on size. */
export const LINE_WARN = 450;

const MILESTONE_RE = /\bM\d+\b/g;
const HOTSPOT_RE = /HOTSPOT-\d+/gi;

/**
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintBannedTags(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();

  for (const re of [MILESTONE_RE, HOTSPOT_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) {
      banned.add(match[0]);
    }
  }

  return { bannedMatches: [...banned].sort() };
}

/**
 * @param {string} text
 * @returns {{ bannedMatches: string[], lineCount: number, overSize: boolean }}
 */
export function lintArchitectureDoc(text) {
  const source = typeof text === "string" ? text : "";
  const { bannedMatches } = lintBannedTags(source);
  const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length;
  return {
    bannedMatches,
    lineCount,
    overSize: lineCount > LINE_WARN,
  };
}

/**
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintConcernsDoc(text) {
  return lintBannedTags(text);
}

/**
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintIntegrationsDoc(text) {
  return lintBannedTags(text);
}

/**
 * CONVENTIONS bans milestone tags only — HOTSPOT-* naming convention is allowed.
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintConventionsDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();
  MILESTONE_RE.lastIndex = 0;
  let match;
  while ((match = MILESTONE_RE.exec(source)) !== null) {
    banned.add(match[0]);
  }
  return { bannedMatches: [...banned].sort() };
}

/**
 * @param {string | null | undefined} relPath
 * @param {string} fileName
 * @param {string} relCanonical
 * @returns {boolean}
 */
function isCodebaseDocPath(relPath, fileName, relCanonical) {
  if (!relPath || typeof relPath !== "string") return false;
  const n = relPath.replace(/\\/g, "/");
  return n === relCanonical || n.endsWith(`/${fileName}`) || n === fileName;
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isArchitectureDocPath(relPath) {
  return isCodebaseDocPath(relPath, "ARCHITECTURE.md", ARCHITECTURE_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isConcernsDocPath(relPath) {
  return isCodebaseDocPath(relPath, "CONCERNS.md", CONCERNS_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isIntegrationsDocPath(relPath) {
  return isCodebaseDocPath(relPath, "INTEGRATIONS.md", INTEGRATIONS_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isConventionsDocPath(relPath) {
  return isCodebaseDocPath(relPath, "CONVENTIONS.md", CONVENTIONS_REL_PATH);
}

export const ARCHITECTURE_SOT_CONTEXT = `ARCHITECTURE.md is the Design SoT (.cursor/rules/architecture-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/sister-milestone voice. Allowed: ADR-*, RT-*, present-tense modules/pipelines/contracts. Milestone history → ROADMAP/STATE/features.`;

export const CONCERNS_SOT_CONTEXT = `CONCERNS.md is the fragile-risk SoT (.cursor/rules/concerns-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/superseded voice. Allowed: RT-*, present-tense risk→mitigation→test expectations. Milestone history → ROADMAP/STATE/features.`;

export const INTEGRATIONS_SOT_CONTEXT = `INTEGRATIONS.md is the external-adapter SoT (.cursor/rules/integrations-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/removed-in voice. Allowed: present-tense Role/Adapter/Rule/Failure/Tests; links to ARCHITECTURE/CONCERNS/TESTING. Milestone history → ROADMAP/STATE/features.`;

export const CONVENTIONS_SOT_CONTEXT = `CONVENTIONS.md is the coding-conventions SoT (.cursor/rules/conventions-sot.mdc). Forbidden: milestone tags (M##), changelog/STATE provenance voice. Allowed: HOTSPOT-* as naming prefix, ADR-*, present-tense naming/imports/build/lint. Milestone history → ROADMAP/STATE/features. Package publish facts → STACK.`;
