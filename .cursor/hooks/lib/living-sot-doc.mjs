/**
 * Lint helpers for living SoT docs under .specs/codebase/ and .specs/project/
 * (ARCHITECTURE Design SoT + CONCERNS fragile-risk SoT + CONVENTIONS coding SoT
 * + INTEGRATIONS adapter SoT + STACK inventory SoT + STRUCTURE layout SoT
 * + TESTING infrastructure SoT + PROJECT product-vision SoT
 * + ROADMAP milestone-tracker SoT).
 * @see .cursor/rules/architecture-sot.mdc
 * @see .cursor/rules/concerns-sot.mdc
 * @see .cursor/rules/conventions-sot.mdc
 * @see .cursor/rules/integrations-sot.mdc
 * @see .cursor/rules/stack-sot.mdc
 * @see .cursor/rules/structure-sot.mdc
 * @see .cursor/rules/testing-sot.mdc
 * @see .cursor/rules/project-sot.mdc
 * @see .cursor/rules/roadmap-sot.mdc
 */

export const ARCHITECTURE_REL_PATH = ".specs/codebase/ARCHITECTURE.md";
export const CONCERNS_REL_PATH = ".specs/codebase/CONCERNS.md";
export const CONVENTIONS_REL_PATH = ".specs/codebase/CONVENTIONS.md";
export const INTEGRATIONS_REL_PATH = ".specs/codebase/INTEGRATIONS.md";
export const STACK_REL_PATH = ".specs/codebase/STACK.md";
export const STRUCTURE_REL_PATH = ".specs/codebase/STRUCTURE.md";
export const TESTING_REL_PATH = ".specs/codebase/TESTING.md";
export const PROJECT_REL_PATH = ".specs/project/PROJECT.md";
export const ROADMAP_REL_PATH = ".specs/project/ROADMAP.md";

/** Soft size warning for ARCHITECTURE (~context-limits warning band). Smoke does not fail on size. */
export const LINE_WARN = 450;

/** Soft size warning for ROADMAP. Smoke does not fail on size. */
export const ROADMAP_LINE_WARN = 900;

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
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintStackDoc(text) {
  return lintBannedTags(text);
}

/**
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintStructureDoc(text) {
  return lintBannedTags(text);
}

/**
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintTestingDoc(text) {
  return lintBannedTags(text);
}

/**
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintProjectDoc(text) {
  return lintBannedTags(text);
}

/**
 * ROADMAP allows M##; bans spec/tasks/Deferred dump patterns (roadmap-sot.mdc).
 * @param {string} text
 * @returns {{ bannedMatches: string[], lineCount: number, overSize: boolean }}
 */
export function lintRoadmapDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();

  /** @type {{ re: RegExp, label: string }[]} */
  const patterns = [
    { re: /\*\*Artifacts:\*\*|^\*\*?Artifacts:/gim, label: "Artifacts:" },
    { re: /HOTSPOT-\d+/gi, label: "HOTSPOT-*" },
    { re: /Final gate/gi, label: "Final gate" },
    { re: /\*\*Out of scope:\*\*|Out of scope:/gi, label: "Out of scope:" },
    { re: /Further horizon/gi, label: "Further horizon" },
    { re: /Suggested execution order/gi, label: "Suggested execution order" },
    { re: /\*\*Sisters\b/gi, label: "**Sisters" },
    { re: /\*\*IDs:\*\*/gi, label: "**IDs:**" },
    { re: /Post-[^\n]*backlog/gi, label: "Post-* backlog" },
    { re: /^- \[[ xX]\]/gm, label: "task checkbox" },
  ];

  for (const { re, label } of patterns) {
    re.lastIndex = 0;
    if (re.test(source)) {
      banned.add(label);
    }
  }

  const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length;
  return {
    bannedMatches: [...banned].sort(),
    lineCount,
    overSize: lineCount > ROADMAP_LINE_WARN,
  };
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

export const ARCHITECTURE_SOT_CONTEXT = `ARCHITECTURE.md is the Design SoT (.cursor/rules/architecture-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/sister-milestone voice. Allowed: ADR-*, RT-*, present-tense modules/pipelines/contracts. Milestone history → ROADMAP/STATE/features.`;

export const CONCERNS_SOT_CONTEXT = `CONCERNS.md is the fragile-risk SoT (.cursor/rules/concerns-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/superseded voice. Allowed: RT-*, present-tense risk→mitigation→test expectations. Milestone history → ROADMAP/STATE/features.`;

export const INTEGRATIONS_SOT_CONTEXT = `INTEGRATIONS.md is the external-adapter SoT (.cursor/rules/integrations-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/removed-in voice. Allowed: present-tense Role/Adapter/Rule/Failure/Tests; links to ARCHITECTURE/CONCERNS/TESTING. Milestone history → ROADMAP/STATE/features.`;

export const STACK_SOT_CONTEXT = `STACK.md is the technology-stack SoT (.cursor/rules/stack-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/provenance voice, adapter encyclopedias. Allowed: present-tense runtime/deps/publish inventory; negative “not in stack”; short pointers. Milestone history → ROADMAP/STATE/features.`;

export const STRUCTURE_SOT_CONTEXT = `STRUCTURE.md is the directory-layout / public-API map SoT (.cursor/rules/structure-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/provenance voice, CLI flag laundry lists, fixture methodology. Allowed: present-tense trees, Path|Role map, where-things-live, public exports; short pointers. Milestone history → ROADMAP/STATE/features.`;

export const TESTING_SOT_CONTEXT = `TESTING.md is the testing-infrastructure SoT (.cursor/rules/testing-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/provenance voice, schema encyclopedias, fragile-risk catalogs, exit-code tables. Allowed: present-tense runner/fixtures/coverage/gates/mock boundaries; short pointers. Milestone history → ROADMAP/STATE/features.`;

export const CONVENTIONS_SOT_CONTEXT = `CONVENTIONS.md is the coding-conventions SoT (.cursor/rules/conventions-sot.mdc). Forbidden: milestone tags (M##), changelog/STATE provenance voice. Allowed: HOTSPOT-* as naming prefix, ADR-*, present-tense naming/imports/build/lint. Milestone history → ROADMAP/STATE/features. Package publish facts → STACK.`;

export const PROJECT_SOT_CONTEXT = `PROJECT.md is the product-vision SoT (.cursor/rules/project-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/through-M voice, CLI flag laundry lists, deferred inventories. Allowed: present-tense vision/goals/constraints/capability scope; JSON version table; short pointers. Milestone history → ROADMAP/STATE/features; deferred → STATE.`;

export const ROADMAP_SOT_CONTEXT = `ROADMAP.md is the milestone-tracker SoT (.cursor/rules/roadmap-sot.mdc). Forbidden: Artifacts/Sisters/HOTSPOT-*/Out of scope/Final gate/Suggested execution order/Further horizon Deferred lists/task checkboxes/Post-* backlog dumps. Allowed: M##, Current table, Done summary, lean Archive entries (link + outcome + ≤5 bullets). Detail → .specs/features/; deferred → STATE.`;
