/**
 * Path constants and path-classification helpers for living SoT docs.
 */

export const ARCHITECTURE_REL_PATH = ".specs/codebase/ARCHITECTURE.md";
export const CONCERNS_REL_PATH = ".specs/codebase/CONCERNS.md";
export const CONVENTIONS_REL_PATH = ".specs/codebase/CONVENTIONS.md";
export const INTEGRATIONS_REL_PATH = ".specs/codebase/INTEGRATIONS.md";
export const STACK_REL_PATH = ".specs/codebase/STACK.md";
export const STRUCTURE_REL_PATH = ".specs/codebase/STRUCTURE.md";
export const TESTING_REL_PATH = ".specs/codebase/TESTING.md";
export const DOC_OWNERSHIP_REL_PATH = ".specs/codebase/DOC-OWNERSHIP.md";
export const PROJECT_REL_PATH = ".specs/project/PROJECT.md";
export const ROADMAP_REL_PATH = ".specs/project/ROADMAP.md";
export const STATE_REL_PATH = ".specs/project/STATE.md";
export const AGENTS_REL_PATH = "AGENTS.md";
export const CONTRIBUTING_REL_PATH = "CONTRIBUTING.md";
export const README_REL_PATH = "README.md";
export const DOCS_CLI_REFERENCE_REL_PATH = "docs/cli-reference.md";
export const DOCS_RECIPES_REL_PATH = "docs/recipes.md";
export const DOCS_METHODOLOGY_REL_PATH = "docs/methodology.md";
export const DOCS_WARNING_CODES_REL_PATH = "docs/warning-codes.md";
export const SKILLS_DIR_REL_PATH = ".cursor/skills";
export const AGENT_ROLES_DIR_REL_PATH = ".cursor/agents";

/** Soft size warning for ARCHITECTURE (~context-limits warning band). Smoke does not fail on size. */
export const LINE_WARN = 450;

/** Soft size warning for ROADMAP. Smoke does not fail on size. */
export const ROADMAP_LINE_WARN = 900;

/** Soft size warning for STATE. Smoke does not fail on size. */
export const STATE_LINE_WARN = 200;

/** Soft size warning for AGENTS. Smoke does not fail on size. */
export const AGENTS_LINE_WARN = 100;

/** Soft size warning for CONTRIBUTING. Smoke does not fail on size. */
export const CONTRIBUTING_LINE_WARN = 160;

/** Soft size warning for README. Smoke does not fail on size. */
export const README_LINE_WARN = 320;

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
export function isStackDocPath(relPath) {
  return isCodebaseDocPath(relPath, "STACK.md", STACK_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isStructureDocPath(relPath) {
  return isCodebaseDocPath(relPath, "STRUCTURE.md", STRUCTURE_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isTestingDocPath(relPath) {
  return isCodebaseDocPath(relPath, "TESTING.md", TESTING_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isConventionsDocPath(relPath) {
  return isCodebaseDocPath(relPath, "CONVENTIONS.md", CONVENTIONS_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isProjectDocPath(relPath) {
  return isCodebaseDocPath(relPath, "PROJECT.md", PROJECT_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isRoadmapDocPath(relPath) {
  return isCodebaseDocPath(relPath, "ROADMAP.md", ROADMAP_REL_PATH);
}

/**
 * Live STATE only — excludes STATE-ARCHIVE.md.
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isStateDocPath(relPath) {
  if (!relPath || typeof relPath !== "string") return false;
  const n = relPath.replace(/\\/g, "/");
  if (n.endsWith("STATE-ARCHIVE.md") || n === "STATE-ARCHIVE.md") return false;
  return (
    n === STATE_REL_PATH || n.endsWith("/STATE.md") || n === "STATE.md"
  );
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isAgentsDocPath(relPath) {
  return isCodebaseDocPath(relPath, "AGENTS.md", AGENTS_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isContributingDocPath(relPath) {
  return isCodebaseDocPath(relPath, "CONTRIBUTING.md", CONTRIBUTING_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isReadmeDocPath(relPath) {
  return isCodebaseDocPath(relPath, "README.md", README_REL_PATH);
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isDocOwnershipDocPath(relPath) {
  return isCodebaseDocPath(relPath, "DOC-OWNERSHIP.md", DOC_OWNERSHIP_REL_PATH);
}

/**
 * Any file under docs/ (user docs).
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isDocsUserDocPath(relPath) {
  if (!relPath || typeof relPath !== "string") return false;
  const n = relPath.replace(/\\/g, "/");
  return n === "docs" || n.startsWith("docs/");
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isSkillDocPath(relPath) {
  if (!relPath || typeof relPath !== "string") return false;
  return /^\.cursor\/skills\/.+\.md$/.test(relPath.replace(/\\/g, "/"));
}

/**
 * @param {string | null | undefined} relPath
 * @returns {boolean}
 */
export function isAgentRoleDocPath(relPath) {
  if (!relPath || typeof relPath !== "string") return false;
  return /^\.cursor\/agents\/.+\.md$/.test(relPath.replace(/\\/g, "/"));
}
