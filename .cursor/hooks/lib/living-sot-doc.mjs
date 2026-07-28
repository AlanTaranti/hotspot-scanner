/**
 * Lint helpers for living SoT docs under .specs/codebase/ and .specs/project/
 * (ARCHITECTURE Design SoT + CONCERNS fragile-risk SoT + CONVENTIONS coding SoT
 * + INTEGRATIONS adapter SoT + STACK inventory SoT + STRUCTURE layout SoT
 * + TESTING infrastructure SoT + PROJECT product-vision SoT
 * + ROADMAP milestone-tracker SoT + STATE session-memory SoT
 * + AGENTS index/policies SoT + CONTRIBUTING contribute-guide SoT
 * + README adoption SoT).
 * @see .cursor/rules/architecture-sot.mdc
 * @see .cursor/rules/concerns-sot.mdc
 * @see .cursor/rules/conventions-sot.mdc
 * @see .cursor/rules/integrations-sot.mdc
 * @see .cursor/rules/stack-sot.mdc
 * @see .cursor/rules/structure-sot.mdc
 * @see .cursor/rules/testing-sot.mdc
 * @see .cursor/rules/project-sot.mdc
 * @see .cursor/rules/roadmap-sot.mdc
 * @see .cursor/rules/state-sot.mdc
 * @see .cursor/rules/agents-sot.mdc
 * @see .cursor/rules/contributing-sot.mdc
 * @see .cursor/rules/readme-sot.mdc
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
export const STATE_REL_PATH = ".specs/project/STATE.md";
export const AGENTS_REL_PATH = "AGENTS.md";
export const CONTRIBUTING_REL_PATH = "CONTRIBUTING.md";
export const README_REL_PATH = "README.md";

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
 * Extract body of `## Deferred` through the next `## ` heading (exclusive).
 * @param {string} source
 * @returns {string}
 */
function extractDeferredSection(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => /^## Deferred\b/.test(line));
  if (start < 0) return "";
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join("\n");
}

/**
 * STATE allows M##; bans execute-log / Done-leftover patterns (state-sot.mdc).
 * Does not apply to STATE-ARCHIVE.md.
 * @param {string} text
 * @returns {{ bannedMatches: string[], lineCount: number, overSize: boolean }}
 */
export function lintStateDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();

  /** @type {{ re: RegExp, label: string }[]} */
  const patterns = [
    { re: /Execute complete/gi, label: "Execute complete" },
    { re: /Specs Planned/gi, label: "Specs Planned" },
    { re: /Gate green/gi, label: "Gate green" },
    { re: /Next:\s*M\d+/gi, label: "Next: M##" },
    { re: /Superseded by M\d+\s+Done/gi, label: "Superseded by M## Done" },
    { re: /HOTSPOT-\d+/gi, label: "HOTSPOT-*" },
  ];

  for (const { re, label } of patterns) {
    re.lastIndex = 0;
    if (re.test(source)) {
      banned.add(label);
    }
  }

  const deferred = extractDeferredSection(source);
  if (/\bM\d+\s+Done\b/i.test(deferred)) {
    banned.add("Deferred M## Done leftover");
  }

  const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length;
  return {
    bannedMatches: [...banned].sort(),
    lineCount,
    overSize: lineCount > STATE_LINE_WARN,
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
 * AGENTS bans milestone tags only — HOTSPOT-* naming prefix is allowed (agents-sot.mdc).
 * @param {string} text
 * @returns {{ bannedMatches: string[], lineCount: number, overSize: boolean }}
 */
export function lintAgentsDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();
  MILESTONE_RE.lastIndex = 0;
  let match;
  while ((match = MILESTONE_RE.exec(source)) !== null) {
    banned.add(match[0]);
  }
  const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length;
  return {
    bannedMatches: [...banned].sort(),
    lineCount,
    overSize: lineCount > AGENTS_LINE_WARN,
  };
}

/**
 * CONTRIBUTING bans SoT-mirror dumps + milestone tags — HOTSPOT-* naming allowed (contributing-sot.mdc).
 * @param {string} text
 * @returns {{ bannedMatches: string[], lineCount: number, overSize: boolean }}
 */
export function lintContributingDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();

  MILESTONE_RE.lastIndex = 0;
  let match;
  while ((match = MILESTONE_RE.exec(source)) !== null) {
    banned.add(match[0]);
  }

  /** @type {{ re: RegExp, label: string }[]} */
  const patterns = [
    { re: /[├└]──/, label: "directory tree" },
    {
      re: /^#{2,3} Coverage thresholds\b/m,
      label: "Coverage thresholds",
    },
    { re: /^\|\s*Exit code\s*\|/m, label: "Exit code table" },
    { re: /!=\s*0/, label: "!= 0 exit" },
    {
      re: /^## Architecture boundaries\b/m,
      label: "Architecture boundaries",
    },
    { re: /^## Fragile areas\b/m, label: "Fragile areas" },
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
    overSize: lineCount > CONTRIBUTING_LINE_WARN,
  };
}

/**
 * README bans encyclopedia / Advanced dumps + milestone tags (readme-sot.mdc).
 * HOTSPOT-* naming not banned (user docs rarely need it; allowed if mentioned).
 * @param {string} text
 * @returns {{ bannedMatches: string[], lineCount: number, overSize: boolean }}
 */
export function lintReadmeDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();

  MILESTONE_RE.lastIndex = 0;
  let match;
  while ((match = MILESTONE_RE.exec(source)) !== null) {
    banned.add(match[0]);
  }

  /** @type {{ re: RegExp, label: string }[]} */
  const patterns = [
    { re: /^## Advanced\b/m, label: "## Advanced" },
    { re: /^## Features\b/m, label: "## Features" },
    { re: /^#{2,3} Pipeline detail\b/m, label: "Pipeline detail" },
    {
      re: /^#{2,3} Performance and diagnostics\b/m,
      label: "Performance and diagnostics",
    },
    { re: /^#{2,3} Rename confidence\b/m, label: "Rename confidence" },
    {
      re: /^#{2,3} Command synopsis and flags\b/m,
      label: "Command synopsis",
    },
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
    overSize: lineCount > README_LINE_WARN,
  };
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

export const ARCHITECTURE_SOT_CONTEXT = `ARCHITECTURE.md is the Design SoT (.cursor/rules/architecture-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/sister-milestone voice. Allowed: ADR-*, RT-*, present-tense modules/pipelines/contracts. Milestone history → ROADMAP + .specs/features/; decisions/deferred/blockers → STATE.`;

export const CONCERNS_SOT_CONTEXT = `CONCERNS.md is the fragile-risk SoT (.cursor/rules/concerns-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/superseded voice. Allowed: RT-*, present-tense risk→mitigation→test expectations. Milestone history → ROADMAP + .specs/features/; decisions/deferred/blockers → STATE.`;

export const INTEGRATIONS_SOT_CONTEXT = `INTEGRATIONS.md is the external-adapter SoT (.cursor/rules/integrations-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/removed-in voice. Allowed: present-tense Role/Adapter/Rule/Failure/Tests; links to ARCHITECTURE/CONCERNS/TESTING. Milestone history → ROADMAP + .specs/features/; decisions/deferred/blockers → STATE.`;

export const STACK_SOT_CONTEXT = `STACK.md is the technology-stack SoT (.cursor/rules/stack-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/provenance voice, adapter encyclopedias. Allowed: present-tense runtime/deps/publish inventory; negative “not in stack”; short pointers. Milestone history → ROADMAP + .specs/features/; decisions/deferred/blockers → STATE.`;

export const STRUCTURE_SOT_CONTEXT = `STRUCTURE.md is the directory-layout / public-API map SoT (.cursor/rules/structure-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/provenance voice, CLI flag laundry lists, fixture methodology. Allowed: present-tense trees, Path|Role map, where-things-live, public exports; short pointers. Milestone history → ROADMAP + .specs/features/; decisions/deferred/blockers → STATE.`;

export const TESTING_SOT_CONTEXT = `TESTING.md is the testing-infrastructure SoT (.cursor/rules/testing-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/provenance voice, schema encyclopedias, fragile-risk catalogs, exit-code tables. Allowed: present-tense runner/fixtures/coverage/gates/mock boundaries; short pointers. Milestone history → ROADMAP + .specs/features/; decisions/deferred/blockers → STATE.`;

export const CONVENTIONS_SOT_CONTEXT = `CONVENTIONS.md is the coding-conventions SoT (.cursor/rules/conventions-sot.mdc). Forbidden: milestone tags (M##), changelog/STATE provenance voice. Allowed: HOTSPOT-* as naming prefix, ADR-*, present-tense naming/imports/build/lint. Milestone history → ROADMAP + .specs/features/; decisions/deferred/blockers → STATE. Package publish facts → STACK.`;

export const PROJECT_SOT_CONTEXT = `PROJECT.md is the product-vision SoT (.cursor/rules/project-sot.mdc). Forbidden: milestone tags (M##), HOTSPOT-* IDs, changelog/through-M voice, CLI flag laundry lists, deferred inventories. Allowed: present-tense vision/goals/constraints/capability scope; JSON version table; short pointers. Milestone history → ROADMAP + .specs/features/; decisions/deferred/blockers → STATE.`;

export const ROADMAP_SOT_CONTEXT = `ROADMAP.md is the milestone-tracker SoT (.cursor/rules/roadmap-sot.mdc). Forbidden: Artifacts/Sisters/HOTSPOT-*/Out of scope/Final gate/Suggested execution order/Further horizon Deferred lists/task checkboxes/Post-* backlog dumps. Allowed: M##, Current table, Done summary, lean Archive entries (link + outcome + ≤5 bullets). Detail → .specs/features/; deferred → STATE.`;

export const STATE_SOT_CONTEXT = `STATE.md is the session-memory SoT (.cursor/rules/state-sot.mdc). Forbidden: Execute complete / Specs Planned / Gate green / Next: M## / Superseded by M## Done / HOTSPOT-* laundry / Deferred M## Done leftovers. Allowed: lasting locks (M## ok), ADRs, open Deferred, short Active, Lessons. Milestone status → ROADMAP + .specs/features/; archive dumps → STATE-ARCHIVE.`;

export const AGENTS_SOT_CONTEXT = `AGENTS.md is the agent index/policies SoT (.cursor/rules/agents-sot.mdc). Forbidden: milestone tags (M##), changelog voice, CLI example dumps, Design SoT / fragile catalogs. Allowed: HOTSPOT-* naming prefix, present-tense policies, exit-code table, skills/agents inventory, short pointers. Module map → vitals-project/STRUCTURE; flag encyclopedias → docs/cli-reference.md; adoption → README; milestones → ROADMAP + .specs/features/.`;

export const CONTRIBUTING_SOT_CONTEXT = `CONTRIBUTING.md is the human contribute-guide SoT (.cursor/rules/contributing-sot.mdc). Forbidden: milestone tags (M##), directory trees, Coverage thresholds sections, exit-code tables / != 0 shorthand, ## Architecture boundaries, ## Fragile areas risk dumps. Allowed: setup/gate/DX, contribute workflow, HOTSPOT-* naming in feature guidance, Documentation map of links. Detail → STRUCTURE/TESTING/INTEGRATIONS/CONCERNS/AGENTS.`;

export const README_SOT_CONTEXT = `README.md is the adoption / first-run SoT (.cursor/rules/readme-sot.mdc). Forbidden: ## Advanced / ## Features dumps, Pipeline detail / Performance and diagnostics / Rename confidence / Command synopsis encyclopedia headings, milestone tags (M##), full flag laundry lists. Allowed: quick start, essential flags, short config/API, exit codes, Documentation hub. Flag encyclopedias → docs/cli-reference.md; cookbooks → docs/recipes.md; methodology → docs/methodology.md; warning codes → docs/warning-codes.md.`;
