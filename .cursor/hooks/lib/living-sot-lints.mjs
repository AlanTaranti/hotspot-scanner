/**
 * Lint helpers for living SoT docs. Ownership matrix SoT:
 * `.specs/codebase/DOC-OWNERSHIP.md`. Per-file Forbidden patterns: `*-sot.mdc` / `docs-sot.mdc`.
 */

import {
  AGENTS_LINE_WARN,
  CONTRIBUTING_LINE_WARN,
  LINE_WARN,
  README_LINE_WARN,
  ROADMAP_LINE_WARN,
  STATE_LINE_WARN,
} from "./living-sot-paths.mjs";

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
