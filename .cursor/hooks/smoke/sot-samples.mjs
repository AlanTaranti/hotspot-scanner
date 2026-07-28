/**
 * Per-entry lint samples keyed by LIVING_SOT_ENTRIES id.
 * `expect` lists labels the dirty sample must produce; `clean` must produce none.
 * @type {Record<string, { dirty: string, expect: string[], clean: string, editPath: string, editContents: string, askNeedle: string }>}
 */
export const SOT_SAMPLES = {
  architecture: {
    dirty: "# ARCHITECTURE\n\nRemoved in M71. See HOTSPOT-1042.\n",
    expect: ["M71", "HOTSPOT-1042"],
    clean: "# ARCHITECTURE\n\nDesign SoT. ADR-2026-020. RT-001.\n",
    editPath: ".specs/codebase/ARCHITECTURE.md",
    editContents: "## Pipeline (M78)\n",
    askNeedle: "M78",
  },
  concerns: {
    dirty: "# CONCERNS\n\nSuperseded in M71. See HOTSPOT-1042.\n",
    expect: ["M71", "HOTSPOT-1042"],
    clean: "# CONCERNS\n\nFragile risks. RT-001. RT-005.\n",
    editPath: ".specs/codebase/CONCERNS.md",
    editContents: "## Hotspot assess (M78)\n",
    askNeedle: "M78",
  },
  integrations: {
    dirty: "# INTEGRATIONS\n\nRemoved in M71. See HOTSPOT-1042.\n",
    expect: ["M71", "HOTSPOT-1042"],
    clean: "# INTEGRATIONS\n\nExternal adapters. Git spawn in src/git/.\n",
    editPath: ".specs/codebase/INTEGRATIONS.md",
    editContents: "## Git (M78)\n",
    askNeedle: "M78",
  },
  stack: {
    dirty: "# STACK\n\nPackage publish prep (M71). See HOTSPOT-1042.\n",
    expect: ["M71", "HOTSPOT-1042"],
    clean: "# STACK\n\nNode.js 22+. commander. picomatch.\n",
    editPath: ".specs/codebase/STACK.md",
    editContents: "## Package publish (M78)\n",
    askNeedle: "M78",
  },
  structure: {
    dirty: "# STRUCTURE\n\n## Directory layout (M71). See HOTSPOT-1042.\n",
    expect: ["M71", "HOTSPOT-1042"],
    clean: "# STRUCTURE\n\nDirectory layout and public API map.\n",
    editPath: ".specs/codebase/STRUCTURE.md",
    editContents: "## Module map (M78)\n",
    askNeedle: "M78",
  },
  testing: {
    dirty: "# TESTING\n\n## NCLOC regressions (M57). See HOTSPOT-1042.\n",
    expect: ["M57", "HOTSPOT-1042"],
    clean: "# TESTING\n\nQuality gate and Vitest coverage thresholds.\n",
    editPath: ".specs/codebase/TESTING.md",
    editContents: "## NCLOC regressions (M57)\n",
    askNeedle: "M57",
  },
  conventions: {
    dirty: "# CONVENTIONS\n\n## Lint and format (M24)\n",
    expect: ["M24"],
    clean: "# CONVENTIONS\n\nRequirement IDs: `HOTSPOT-*`\nADR-2026-021\n",
    editPath: ".specs/codebase/CONVENTIONS.md",
    editContents: "## Lint and format (M24)\n",
    askNeedle: "M24",
  },
  project: {
    dirty: "# PROJECT\n\nShipped through M78. See HOTSPOT-1042.\n",
    expect: ["M78", "HOTSPOT-1042"],
    clean: "# PROJECT\n\nVision: local CLI. See ROADMAP.md.\n",
    editPath: ".specs/project/PROJECT.md",
    editContents: "## Scope (through M78)\n",
    askNeedle: "M78",
  },
  roadmap: {
    dirty:
      "# ROADMAP\n\n## Milestone 1 — DONE\n\n**Artifacts:** [spec.md](x)\n\n- [x] task\n\nSee HOTSPOT-1. Final gate `pnpm test`.\n",
    expect: ["Artifacts:", "HOTSPOT-*", "Final gate", "task checkbox"],
    clean:
      "# ROADMAP\n\n## Current\n\n**Status** | **M78 Done**\n\n## Milestone 1 — Scaffold — DONE\n\n→ [spec.md](../features/scaffold/spec.md)\n\nPackage stub.\n\n- Build scripts\n",
    editPath: ".specs/project/ROADMAP.md",
    editContents: "## Milestone 99 — X — DONE\n\n**Artifacts:** [spec.md](x)\n",
    askNeedle: "Artifacts:",
  },
  state: {
    dirty:
      "# STATE\n\n## Active\n\n**M7–M78 Done**.\n\n## Deferred\n\n- Residual — **M67 Done**\n\n## Decisions\n\n| Date | Decision | Rationale |\n| --- | --- | --- |\n| 2026-07-26 | M58 Execute complete | Gate green (795 tests). Next: M59. HOTSPOT-950. Specs Planned. Superseded by M58 Done. |\n",
    expect: [
      "Execute complete",
      "Specs Planned",
      "Gate green",
      "Next: M##",
      "Superseded by M## Done",
      "HOTSPOT-*",
      "Deferred M## Done leftover",
    ],
    clean:
      "# STATE\n\n## Active\n\n**M7–M78 Done**. See ROADMAP Current.\n\n## Deferred\n\n- npm publish — future backlog\n\n## Decisions\n\n| Date | Decision | Rationale |\n| --- | --- | --- |\n| 2026-07-26 | Hard cut: remove temporal coupling (M56) | No coupling in product |\n",
    editPath: ".specs/project/STATE.md",
    editContents:
      "# STATE\n\n## Decisions\n\n| Date | Decision | Rationale |\n| --- | --- | --- |\n| 2026-07-28 | M99 Execute complete | shipped |\n",
    askNeedle: "Execute complete",
  },
  agents: {
    dirty:
      "# AGENTS\n\nCompare/baseline removed in M71.\n\n| Exit code | Meaning |\n| ---- | ------- |\n| `0` | ok |\n",
    expect: ["M71", "Exit code table"],
    clean:
      "# AGENTS\n\nPrefix **`HOTSPOT-*`** (e.g. `HOTSPOT-01`). Exit codes → docs/cli-reference.md.\n",
    editPath: "AGENTS.md",
    editContents: "## Quality gate (M78)\n",
    askNeedle: "M78",
  },
  contributing: {
    dirty: `# Contributing

## Coverage thresholds

| Exit code | Meaning |
| --------- | ------- |
| \`0\` | ok |
| \`!= 0\` | fail |

## Architecture boundaries

## Fragile areas

\`\`\`
hotspot-scanner/
├── bin/
└── src/
\`\`\`

Shipped in M71.
`,
    expect: [
      "!= 0 exit",
      "Architecture boundaries",
      "Coverage thresholds",
      "Exit code table",
      "Fragile areas",
      "M71",
      "directory tree",
    ],
    clean:
      "# Contributing\n\nUse `HOTSPOT-*` IDs in spec.md. Exit codes: see AGENTS.md.\n\n| Fragile areas | CONCERNS.md |\n",
    editPath: "CONTRIBUTING.md",
    editContents: "## Architecture boundaries\n\n",
    askNeedle: "Architecture boundaries",
  },
  readme: {
    dirty: `# hotspot-scanner

## Advanced

## Features

### Pipeline detail

### Performance and diagnostics

### Rename confidence

### Command synopsis and flags

Shipped in M71. HOTSPOT-999 is fine to mention.
`,
    expect: [
      "## Advanced",
      "## Features",
      "Command synopsis",
      "M71",
      "Performance and diagnostics",
      "Pipeline detail",
      "Rename confidence",
    ],
    clean:
      "# hotspot-scanner\n\n## Essential flags\n\nSee docs/cli-reference.md. Requirement IDs use `HOTSPOT-*` in specs.\n",
    editPath: "README.md",
    editContents: "## Advanced\n\n",
    askNeedle: "## Advanced",
  },
  "doc-ownership": {
    dirty: "# DOC-OWNERSHIP\n\nUpdated after M12 delivery.\n",
    expect: ["M12"],
    clean:
      "# DOC-OWNERSHIP\n\n| Change type | Destination |\n| --- | --- |\n| Modules | ARCHITECTURE.md |\n",
    editPath: ".specs/codebase/DOC-OWNERSHIP.md",
    editContents: "# DOC-OWNERSHIP\n\nUpdated after M12 delivery.\n",
    askNeedle: "M12",
  },
  docs: {
    dirty: "# CLI\n\nChanged in M5.\n",
    expect: ["M5"],
    clean: "# CLI\n\n`--top <n>` limits rows. Exit codes below.\n",
    editPath: "docs/cli-reference.md",
    editContents: "# CLI\n\nChanged in M5.\n",
    askNeedle: "M5",
  },
  skills: {
    dirty:
      "# Skill\n\nUse Quick / Full / Build tiers. IDs like AUTH-01. Look it up with Context7. Render `.tsx` in React.\n",
    expect: [
      ".tsx",
      "AUTH-01",
      "Context7",
      "Quick/Full/Build tiers",
      "React",
    ],
    clean:
      "# Skill\n\nOne gate: `pnpm build && pnpm test`. There are **no**\nQuick / Full / Build tiers. IDs use `HOTSPOT-1010`. Milestone M75 bookkeeping → ROADMAP.\n",
    editPath: ".cursor/skills/vitals-common/SKILL.md",
    editContents: "## Gate tiers\n\nRun the Quick / Full / Build tier for the task.\n",
    askNeedle: "Quick/Full/Build tiers",
  },
  "agent-roles": {
    dirty: "# Agent\n\nRole shipped in M71. Requirement AUTH-01.\n",
    expect: ["AUTH-01", "M71"],
    clean:
      "# Agent\n\n**Role:** run the project gate. Anti-trigger: planning → `planner-feature`. IDs: `HOTSPOT-1010`.\n",
    editPath: ".cursor/agents/implementer.md",
    editContents: "## Changelog\n\nRole rewritten in M71.\n",
    askNeedle: "M71",
  },
};
