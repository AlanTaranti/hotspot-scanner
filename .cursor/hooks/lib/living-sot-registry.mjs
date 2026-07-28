/**
 * Living SoT registry — context strings and `LIVING_SOT_ENTRIES` for pre/post edit guards.
 */

import {
  lintAgentRolesDoc,
  lintAgentsDoc,
  lintArchitectureDoc,
  lintConcernsDoc,
  lintConventionsDoc,
  lintContributingDoc,
  lintDocOwnershipDoc,
  lintDocsUserDoc,
  lintIntegrationsDoc,
  lintProjectDoc,
  lintReadmeDoc,
  lintRoadmapDoc,
  lintSkillsDoc,
  lintStackDoc,
  lintStateDoc,
  lintStructureDoc,
  lintTestingDoc,
} from "./living-sot-lints.mjs";
import {
  AGENT_ROLES_DIR_REL_PATH,
  AGENTS_LINE_WARN,
  AGENTS_REL_PATH,
  ARCHITECTURE_REL_PATH,
  CONCERNS_REL_PATH,
  CONTRIBUTING_LINE_WARN,
  CONTRIBUTING_REL_PATH,
  CONVENTIONS_REL_PATH,
  DOC_OWNERSHIP_REL_PATH,
  DOCS_CLI_REFERENCE_REL_PATH,
  INTEGRATIONS_REL_PATH,
  isAgentRoleDocPath,
  isAgentsDocPath,
  isArchitectureDocPath,
  isConcernsDocPath,
  isConventionsDocPath,
  isContributingDocPath,
  isDocOwnershipDocPath,
  isDocsUserDocPath,
  isIntegrationsDocPath,
  isProjectDocPath,
  isReadmeDocPath,
  isRoadmapDocPath,
  isSkillDocPath,
  isStackDocPath,
  isStateDocPath,
  isStructureDocPath,
  isTestingDocPath,
  LINE_WARN,
  PROJECT_REL_PATH,
  README_LINE_WARN,
  README_REL_PATH,
  ROADMAP_LINE_WARN,
  ROADMAP_REL_PATH,
  SKILLS_DIR_REL_PATH,
  STACK_REL_PATH,
  STATE_LINE_WARN,
  STATE_REL_PATH,
  STRUCTURE_REL_PATH,
  TESTING_REL_PATH,
} from "./living-sot-paths.mjs";

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
