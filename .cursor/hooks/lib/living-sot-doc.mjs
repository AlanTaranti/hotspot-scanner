/**
 * Lint helpers for living SoT docs. Ownership matrix SoT:
 * `.specs/codebase/DOC-OWNERSHIP.md`. Per-file Forbidden patterns: `*-sot.mdc` / `docs-sot.mdc`.
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
 * AGENTS is index-only — bans milestone tags + normative exit-code tables (agents-sot.mdc).
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
  if (/^\|\s*Exit code\s*\|/m.test(source)) {
    banned.add("Exit code table");
  }
  const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length;
  return {
    bannedMatches: [...banned].sort(),
    lineCount,
    overSize: lineCount > AGENTS_LINE_WARN,
  };
}

/**
 * DOC-OWNERSHIP bans milestone tags only (present-tense ownership matrix).
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintDocOwnershipDoc(text) {
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
 * docs/* user docs — ban milestone tags / changelog voice (docs-sot.mdc).
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintDocsUserDoc(text) {
  return lintDocOwnershipDoc(text);
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

/** Requirement-ID prefixes allowed in procedure docs (feature-planning.mdc, ADR ids, encodings). */
const ID_PREFIX_ALLOWLIST = ["HOTSPOT", "ADR", "UTF", "ISO", "SHA", "RFC"];

const FOREIGN_ID_RE = new RegExp(
  `\\b(?!(?:${ID_PREFIX_ALLOWLIST.join("|")})-)[A-Z][A-Z0-9]{2,}-\\d+\\b`,
  "g",
);

const GATE_TIER_RE = /\bQuick\s*[/|]\s*Full\s*[/|]\s*Build\b/gi;
const TIER_NEGATION_RE = /\b(?:no|not|never|single|one)\b/i;
const TIER_NEGATION_WINDOW = 60;

/**
 * True when gate tiers are described as real, not denied ("there are no
 * Quick / Full / Build tiers" stays allowed). Newlines are collapsed first so a
 * negation on the previous line still counts.
 * @param {string} source
 * @returns {boolean}
 */
function assertsGateTiers(source) {
  const flat = source.replace(/\s+/g, " ");
  GATE_TIER_RE.lastIndex = 0;
  let match;
  while ((match = GATE_TIER_RE.exec(flat)) !== null) {
    const before = flat.slice(
      Math.max(0, match.index - TIER_NEGATION_WINDOW),
      match.index,
    );
    if (!TIER_NEGATION_RE.test(before)) return true;
  }
  return false;
}

/** @type {{ re: RegExp, label: string }[]} */
const PROCEDURE_DOC_PATTERNS = [
  { re: /\bContext7\b/i, label: "Context7" },
  { re: /\bmermaid-studio\b/i, label: "mermaid-studio" },
  { re: /\.tsx\b/, label: ".tsx" },
  { re: /\bReact\b/, label: "React" },
];

/**
 * `.cursor/skills/**` procedures — ban foreign requirement-ID prefixes,
 * gate tiers, and nonexistent tooling / web-app examples (skills-sot.mdc).
 * M## is allowed (skills reference milestone bookkeeping steps).
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintSkillsDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set();

  FOREIGN_ID_RE.lastIndex = 0;
  let match;
  while ((match = FOREIGN_ID_RE.exec(source)) !== null) {
    banned.add(match[0]);
  }

  if (assertsGateTiers(source)) {
    banned.add("Quick/Full/Build tiers");
  }

  for (const { re, label } of PROCEDURE_DOC_PATTERNS) {
    if (re.test(source)) banned.add(label);
  }

  return { bannedMatches: [...banned].sort() };
}

/**
 * `.cursor/agents/**` role files — skills bans plus M## changelog voice
 * (agent-roles-sot.mdc): roles are present-tense, milestones live in ROADMAP.
 * @param {string} text
 * @returns {{ bannedMatches: string[] }}
 */
export function lintAgentRolesDoc(text) {
  const source = typeof text === "string" ? text : "";
  const banned = new Set(lintSkillsDoc(source).bannedMatches);

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

const OWN = "Ownership → .specs/codebase/DOC-OWNERSHIP.md";

export const ARCHITECTURE_SOT_CONTEXT = `ARCHITECTURE.md Design SoT (.cursor/rules/architecture-sot.mdc). Forbidden: M##, HOTSPOT-*, changelog voice. ${OWN}`;

export const CONCERNS_SOT_CONTEXT = `CONCERNS.md fragile-risk SoT (.cursor/rules/concerns-sot.mdc). Forbidden: M##, HOTSPOT-*, changelog voice. ${OWN}`;

export const INTEGRATIONS_SOT_CONTEXT = `INTEGRATIONS.md adapter SoT (.cursor/rules/integrations-sot.mdc). Forbidden: M##, HOTSPOT-*, changelog voice. ${OWN}`;

export const STACK_SOT_CONTEXT = `STACK.md technology-stack SoT (.cursor/rules/stack-sot.mdc). Forbidden: M##, HOTSPOT-*, changelog voice, adapter encyclopedias. ${OWN}`;

export const STRUCTURE_SOT_CONTEXT = `STRUCTURE.md layout/API SoT (.cursor/rules/structure-sot.mdc). Forbidden: M##, HOTSPOT-*, changelog voice, CLI laundry lists. ${OWN}`;

export const TESTING_SOT_CONTEXT = `TESTING.md testing-infra SoT (.cursor/rules/testing-sot.mdc). Forbidden: M##, HOTSPOT-*, changelog voice, exit-code tables. ${OWN}`;

export const CONVENTIONS_SOT_CONTEXT = `CONVENTIONS.md coding-conventions SoT (.cursor/rules/conventions-sot.mdc). Forbidden: M##, changelog voice. HOTSPOT-* naming prefix allowed. ${OWN}`;

export const PROJECT_SOT_CONTEXT = `PROJECT.md product-vision SoT (.cursor/rules/project-sot.mdc). Forbidden: M##, HOTSPOT-*, changelog voice, flag laundry lists. ${OWN}`;

export const ROADMAP_SOT_CONTEXT = `ROADMAP.md milestone-tracker SoT (.cursor/rules/roadmap-sot.mdc). Forbidden: Artifacts/HOTSPOT/Out of scope/Final gate/task checkboxes. M## allowed. ${OWN}`;

export const STATE_SOT_CONTEXT = `STATE.md session-memory SoT (.cursor/rules/state-sot.mdc). Forbidden: Execute complete / Specs Planned / Gate green / Next: M##. M## ok in locks. ${OWN}`;

export const AGENTS_SOT_CONTEXT = `AGENTS.md agent index only (.cursor/rules/agents-sot.mdc). Forbidden: M##, exit-code tables, normative gate/commit/YAGNI prose. Allowed: inventory + pointers to policy SoTs. ${OWN}`;

export const CONTRIBUTING_SOT_CONTEXT = `CONTRIBUTING.md contribute-guide SoT (.cursor/rules/contributing-sot.mdc). Forbidden: M##, directory trees, Coverage thresholds, exit-code tables, Architecture boundaries / Fragile areas dumps. ${OWN}`;

export const README_SOT_CONTEXT = `README.md adoption SoT (.cursor/rules/readme-sot.mdc). Forbidden: ## Advanced/Features, encyclopedia headings, M##, full flag lists. Exit codes SoT → docs/cli-reference.md. ${OWN}`;

export const DOC_OWNERSHIP_SOT_CONTEXT = `DOC-OWNERSHIP.md is the ownership-matrix SoT. Forbidden: M## changelog voice. Keep present-tense destination rows only.`;

export const DOCS_SOT_CONTEXT = `docs/* user docs (.cursor/rules/docs-sot.mdc). Forbidden: M## changelog voice. Roles: cli-reference encyclopedia + exit codes; recipes cookbooks; methodology; warning-codes. ${OWN}`;

export const SKILLS_SOT_CONTEXT = `.cursor/skills/** project procedures (.cursor/rules/skills-sot.mdc). Forbidden: requirement IDs other than HOTSPOT-*, Quick/Full/Build gate tiers, nonexistent tooling (Context7, mermaid-studio), generic web-app examples (React/.tsx). ${OWN}`;

export const AGENT_ROLES_SOT_CONTEXT = `.cursor/agents/** role files (.cursor/rules/agent-roles-sot.mdc). Forbidden: M## changelog voice, foreign requirement IDs, Quick/Full/Build gate tiers, nonexistent tooling. Keep role + triggers + pointers. ${OWN}`;

/**
 * Shared registry for pre/post edit guards (table-driven SoT lint).
 * @typedef {{
 *   id: string,
 *   isPath: (relPath: string | null | undefined) => boolean,
 *   relPath: string,
 *   lint: (text: string) => { bannedMatches: string[], lineCount?: number, overSize?: boolean },
 *   sotContext: string,
 *   bannedLabel: string,
 *   preEditAsk: (matches: string[]) => string,
 *   perFile?: boolean,
 *   liveDir?: string,
 *   liveRelPaths?: string[],
 *   lineWarn?: number,
 *   sizeHint?: string,
 * }} LivingSotEntry
 */

/** @type {LivingSotEntry[]} */
export const LIVING_SOT_ENTRIES = [
  {
    id: "architecture",
    isPath: isArchitectureDocPath,
    relPath: ARCHITECTURE_REL_PATH,
    lint: lintArchitectureDoc,
    sotContext: ARCHITECTURE_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `ARCHITECTURE.md edit introduces forbidden tags (${m.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
    lineWarn: LINE_WARN,
    sizeHint: "Slim UX/history; keep modules/pipelines/contracts only.",
  },
  {
    id: "concerns",
    isPath: isConcernsDocPath,
    relPath: CONCERNS_REL_PATH,
    lint: lintConcernsDoc,
    sotContext: CONCERNS_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `CONCERNS.md edit introduces forbidden tags (${m.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
  },
  {
    id: "integrations",
    isPath: isIntegrationsDocPath,
    relPath: INTEGRATIONS_REL_PATH,
    lint: lintIntegrationsDoc,
    sotContext: INTEGRATIONS_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `INTEGRATIONS.md edit introduces forbidden tags (${m.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
  },
  {
    id: "stack",
    isPath: isStackDocPath,
    relPath: STACK_REL_PATH,
    lint: lintStackDoc,
    sotContext: STACK_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `STACK.md edit introduces forbidden tags (${m.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
  },
  {
    id: "structure",
    isPath: isStructureDocPath,
    relPath: STRUCTURE_REL_PATH,
    lint: lintStructureDoc,
    sotContext: STRUCTURE_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `STRUCTURE.md edit introduces forbidden tags (${m.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
  },
  {
    id: "testing",
    isPath: isTestingDocPath,
    relPath: TESTING_REL_PATH,
    lint: lintTestingDoc,
    sotContext: TESTING_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `TESTING.md edit introduces forbidden tags (${m.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
  },
  {
    id: "conventions",
    isPath: isConventionsDocPath,
    relPath: CONVENTIONS_REL_PATH,
    lint: lintConventionsDoc,
    sotContext: CONVENTIONS_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `CONVENTIONS.md edit introduces forbidden tags (${m.join(", ")}). Remove milestone changelog voice or confirm intentional exception.`,
  },
  {
    id: "project",
    isPath: isProjectDocPath,
    relPath: PROJECT_REL_PATH,
    lint: lintProjectDoc,
    sotContext: PROJECT_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `PROJECT.md edit introduces forbidden tags (${m.join(", ")}). Remove milestone/HOTSPOT changelog voice or confirm intentional exception.`,
  },
  {
    id: "roadmap",
    isPath: isRoadmapDocPath,
    relPath: ROADMAP_REL_PATH,
    lint: lintRoadmapDoc,
    sotContext: ROADMAP_SOT_CONTEXT,
    bannedLabel: "Forbidden drift patterns still present",
    preEditAsk: (m) =>
      `ROADMAP.md edit introduces forbidden drift patterns (${m.join(", ")}). Use lean milestone template (roadmap-sot) or confirm intentional exception.`,
    lineWarn: ROADMAP_LINE_WARN,
    sizeHint:
      "Keep lean Archive entries (roadmap-sot); detail stays in .specs/features/.",
  },
  {
    id: "state",
    isPath: isStateDocPath,
    relPath: STATE_REL_PATH,
    lint: lintStateDoc,
    sotContext: STATE_SOT_CONTEXT,
    bannedLabel: "Forbidden execute-log drift still present",
    preEditAsk: (m) =>
      `STATE.md edit introduces forbidden execute-log drift (${m.join(", ")}). Keep lasting locks only (state-sot) or confirm intentional exception.`,
    lineWarn: STATE_LINE_WARN,
    sizeHint:
      "Keep lasting locks only (state-sot); Execute dumps → STATE-ARCHIVE.",
  },
  {
    id: "agents",
    isPath: isAgentsDocPath,
    relPath: AGENTS_REL_PATH,
    lint: lintAgentsDoc,
    sotContext: AGENTS_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `AGENTS.md edit introduces forbidden tags (${m.join(", ")}). Keep index-only (agents-sot) or confirm intentional exception.`,
    lineWarn: AGENTS_LINE_WARN,
    sizeHint:
      "Keep lean index only (agents-sot); policies → quality-gates / commit-policy / coding-guidelines / cli-reference.",
  },
  {
    id: "contributing",
    isPath: isContributingDocPath,
    relPath: CONTRIBUTING_REL_PATH,
    lint: lintContributingDoc,
    sotContext: CONTRIBUTING_SOT_CONTEXT,
    bannedLabel: "Forbidden SoT-mirror content still present",
    preEditAsk: (m) =>
      `CONTRIBUTING.md edit introduces forbidden SoT-mirror content (${m.join(", ")}). Link STRUCTURE/TESTING/INTEGRATIONS/CONCERNS/cli-reference instead or confirm intentional exception.`,
    lineWarn: CONTRIBUTING_LINE_WARN,
    sizeHint:
      "Keep thin contribute guide only (contributing-sot); detail → STRUCTURE / TESTING / INTEGRATIONS / CONCERNS / cli-reference.",
  },
  {
    id: "readme",
    isPath: isReadmeDocPath,
    relPath: README_REL_PATH,
    lint: lintReadmeDoc,
    sotContext: README_SOT_CONTEXT,
    bannedLabel: "Forbidden adoption-SoT drift still present",
    preEditAsk: (m) =>
      `README.md edit introduces forbidden adoption-SoT drift (${m.join(", ")}). Put encyclopedias in docs/cli-reference.md (workflows in docs/recipes.md) or confirm intentional exception.`,
    lineWarn: README_LINE_WARN,
    sizeHint:
      "Keep adoption/first-run only (readme-sot); encyclopedias → docs/cli-reference.md; cookbooks → docs/recipes.md.",
  },
  {
    id: "doc-ownership",
    isPath: isDocOwnershipDocPath,
    relPath: DOC_OWNERSHIP_REL_PATH,
    lint: lintDocOwnershipDoc,
    sotContext: DOC_OWNERSHIP_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `DOC-OWNERSHIP.md edit introduces forbidden tags (${m.join(", ")}). Keep present-tense ownership rows only or confirm intentional exception.`,
  },
  {
    id: "docs",
    isPath: isDocsUserDocPath,
    relPath: "docs/",
    lint: lintDocsUserDoc,
    sotContext: DOCS_SOT_CONTEXT,
    bannedLabel: "Forbidden tags still present",
    preEditAsk: (m) =>
      `docs/ edit introduces forbidden tags (${m.join(", ")}). Remove milestone changelog voice (docs-sot) or confirm intentional exception.`,
    perFile: true,
    liveRelPaths: [DOCS_CLI_REFERENCE_REL_PATH],
  },
  {
    id: "skills",
    isPath: isSkillDocPath,
    relPath: SKILLS_DIR_REL_PATH,
    lint: lintSkillsDoc,
    sotContext: SKILLS_SOT_CONTEXT,
    bannedLabel: "Forbidden procedure drift still present",
    preEditAsk: (m) =>
      `.cursor/skills edit introduces forbidden procedure drift (${m.join(", ")}). Use HOTSPOT-* IDs, the single project gate, and tooling that exists in this repo (skills-sot) or confirm intentional exception.`,
    perFile: true,
    liveDir: SKILLS_DIR_REL_PATH,
  },
  {
    id: "agent-roles",
    isPath: isAgentRoleDocPath,
    relPath: AGENT_ROLES_DIR_REL_PATH,
    lint: lintAgentRolesDoc,
    sotContext: AGENT_ROLES_SOT_CONTEXT,
    bannedLabel: "Forbidden role-file drift still present",
    preEditAsk: (m) =>
      `.cursor/agents edit introduces forbidden role-file drift (${m.join(", ")}). Keep role + triggers + pointers, no milestone voice (agent-roles-sot) or confirm intentional exception.`,
    perFile: true,
    liveDir: AGENT_ROLES_DIR_REL_PATH,
  },
];
