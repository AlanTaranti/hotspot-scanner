#!/usr/bin/env node
/**
 * Smoke tests for hotspot-scanner Cursor hooks.
 * Run: pnpm hooks:smoke  (or: node .cursor/hooks/smoke-test.mjs)
 *
 * Living-doc lint cases are generated from LIVING_SOT_ENTRIES + SOT_SAMPLES:
 * one lint case (dirty + clean sample), one live-file case, one pre-edit ask
 * case per entry. Hook behavior cases stay hand-written below.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIVING_SOT_ENTRIES } from "./lib/living-sot-doc.mjs";
import { liveFilesForEntry } from "./lib/live-sot-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hooksDir = path.join(root, ".cursor/hooks");
const stateDir = path.join(root, ".cursor/hooks-state");

function runHook(script, input) {
  const result = spawnSync("node", [path.join(hooksDir, script)], {
    input: JSON.stringify(input),
    encoding: "utf8",
    cwd: root,
  });
  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    status: result.status,
  };
}

function assertIncludes(stdout, needle, label) {
  if (!stdout.includes(needle)) {
    throw new Error(
      `${label}: expected stdout to include ${JSON.stringify(needle)}, got: ${stdout}`,
    );
  }
}

function cleanupState(id) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const file = path.join(stateDir, `${safe}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function readHooksConfig() {
  return JSON.parse(fs.readFileSync(path.join(root, ".cursor/hooks.json"), "utf8"));
}

/**
 * Create a temporary feature with the given tasks.md Status; returns a cleanup fn.
 */
function withFeature(slug, status) {
  const featureDir = path.join(root, ".specs/features", slug);
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(
    path.join(featureDir, "tasks.md"),
    `# Smoke\n\n**Status**: \`${status}\`\n\n## Tasks\n\n- T1 placeholder\n`,
  );
  return () => fs.rmSync(featureDir, { recursive: true, force: true });
}

/**
 * Per-entry lint samples keyed by LIVING_SOT_ENTRIES id.
 * `expect` lists labels the dirty sample must produce; `clean` must produce none.
 * @type {Record<string, { dirty: string, expect: string[], clean: string, editPath: string, editContents: string, askNeedle: string }>}
 */
const SOT_SAMPLES = {
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

/** @type {{ name: string, run: () => void }[]} */
const tests = [
  {
    name: "commit deny without user flag",
    run() {
      cleanupState("smoke-1");
      const { stdout } = runHook("commit-policy.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "git commit -m test",
        conversation_id: "smoke-1",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"deny"', "commit deny");
    },
  },
  {
    name: "commit allow after user prompt contains commit",
    run() {
      cleanupState("smoke-1");
      runHook("commit-policy.mjs", {
        hook_event_name: "beforeSubmitPrompt",
        prompt: "please commit these changes",
        conversation_id: "smoke-1",
      });
      const { stdout } = runHook("commit-policy.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "git commit -m test",
        conversation_id: "smoke-1",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"allow"', "commit allow");
      cleanupState("smoke-1");
    },
  },
  {
    name: "sticky commit survives non-commit follow-up prompt",
    run() {
      cleanupState("smoke-sticky");
      runHook("commit-policy.mjs", {
        hook_event_name: "beforeSubmitPrompt",
        prompt: "please commit these changes",
        conversation_id: "smoke-sticky",
      });
      runHook("commit-policy.mjs", {
        hook_event_name: "beforeSubmitPrompt",
        prompt: "also fix the typo in the README",
        conversation_id: "smoke-sticky",
      });
      const first = runHook("commit-policy.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "git commit -m test",
        conversation_id: "smoke-sticky",
        workspace_roots: [root],
      });
      assertIncludes(first.stdout, '"permission":"allow"', "sticky allow");
      const second = runHook("commit-policy.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "git commit -m again",
        conversation_id: "smoke-sticky",
        workspace_roots: [root],
      });
      assertIncludes(second.stdout, '"permission":"deny"', "cleared after allow");
      cleanupState("smoke-sticky");
    },
  },
  {
    name: "commit allow with Portuguese commite keyword",
    run() {
      cleanupState("smoke-1b");
      runHook("commit-policy.mjs", {
        hook_event_name: "beforeSubmitPrompt",
        prompt: "por favor commite essas mudanças",
        conversation_id: "smoke-1b",
      });
      const { stdout } = runHook("commit-policy.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "git commit -m test",
        conversation_id: "smoke-1b",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"allow"', "commit allow pt");
      cleanupState("smoke-1b");
    },
  },
  {
    name: "gate deny when code touched without gate",
    run() {
      cleanupState("smoke-2");
      runHook("track-edit.mjs", {
        hook_event_name: "afterFileEdit",
        file_path: "src/index.ts",
        conversation_id: "smoke-2",
        workspace_roots: [root],
      });
      const { stdout } = runHook("gate-before-commit.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "git commit -m x",
        conversation_id: "smoke-2",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"deny"', "gate deny");
      cleanupState("smoke-2");
    },
  },
  {
    name: "gate deny when absolute path code touched",
    run() {
      cleanupState("smoke-abs");
      const abs = path.join(root, "src/git/GitMiner.ts");
      runHook("track-edit.mjs", {
        hook_event_name: "afterFileEdit",
        file_path: abs,
        conversation_id: "smoke-abs",
        workspace_roots: [root],
      });
      const stateFile = path.join(stateDir, "smoke-abs.json");
      const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      if (!state.codeTouched) {
        throw new Error(
          `absolute track: expected codeTouched true, got ${JSON.stringify(state)}`,
        );
      }
      if (!state.touchedPaths.includes("src/git/GitMiner.ts")) {
        throw new Error(
          `absolute track: expected relative touchedPaths, got ${JSON.stringify(state.touchedPaths)}`,
        );
      }
      const { stdout } = runHook("gate-before-commit.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "git commit -m x",
        conversation_id: "smoke-abs",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"deny"', "abs gate deny");
      cleanupState("smoke-abs");
    },
  },
  {
    name: "gate allow after separate pnpm build and pnpm test",
    run() {
      cleanupState("smoke-2b");
      const touchPath = path.join(root, "src/index.ts");
      const realTouch = fs.existsSync(touchPath)
        ? touchPath
        : path.join(root, "src/scan.ts");
      const rel = path.relative(root, realTouch).replace(/\\/g, "/");
      runHook("post-edit-guard.mjs", {
        hook_event_name: "postToolUse",
        tool_input: { path: realTouch },
        conversation_id: "smoke-2b",
        workspace_roots: [root],
      });
      // Bump gate timestamps after edit mtime
      const afterEdit = Date.now();
      while (Date.now() <= afterEdit) {
        /* spin ~1ms */
      }
      runHook("record-gate-pass.mjs", {
        hook_event_name: "afterShellExecution",
        command: "pnpm build",
        exit_code: 0,
        conversation_id: "smoke-2b",
        workspace_roots: [root],
      });
      runHook("record-gate-pass.mjs", {
        hook_event_name: "afterShellExecution",
        command: "pnpm test",
        exit_code: 0,
        conversation_id: "smoke-2b",
        workspace_roots: [root],
      });
      runHook("commit-policy.mjs", {
        hook_event_name: "beforeSubmitPrompt",
        prompt: "commit changes",
        conversation_id: "smoke-2b",
      });
      const { stdout } = runHook("gate-before-commit.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "git commit -m x",
        conversation_id: "smoke-2b",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"allow"', `gate allow split (${rel})`);
      cleanupState("smoke-2b");
    },
  },
  {
    name: "failed pnpm test clears testPassedAt",
    run() {
      cleanupState("smoke-test-fail");
      runHook("record-gate-pass.mjs", {
        hook_event_name: "afterShellExecution",
        command: "pnpm test",
        exit_code: 1,
        conversation_id: "smoke-test-fail",
        workspace_roots: [root],
      });
      const state = JSON.parse(
        fs.readFileSync(path.join(stateDir, "smoke-test-fail.json"), "utf8"),
      );
      if (state.testPassedAt !== null) {
        throw new Error(
          `expected testPassedAt null after failure, got ${JSON.stringify(state.testPassedAt)}`,
        );
      }
      cleanupState("smoke-test-fail");
    },
  },
  {
    name: "schemas path marks codeTouched",
    run() {
      cleanupState("smoke-schemas");
      runHook("track-edit.mjs", {
        hook_event_name: "afterFileEdit",
        file_path: "schemas/scan-result.json",
        conversation_id: "smoke-schemas",
        workspace_roots: [root],
      });
      const state = JSON.parse(
        fs.readFileSync(path.join(stateDir, "smoke-schemas.json"), "utf8"),
      );
      if (!state.codeTouched) {
        throw new Error("schemas track: expected codeTouched true");
      }
      cleanupState("smoke-schemas");
    },
  },
  {
    name: "fragile area ask on first production edit",
    run() {
      cleanupState("smoke-5");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_input: { path: "src/complexity/McCabe.ts" },
        conversation_id: "smoke-5",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "fragile ask");
      cleanupState("smoke-5");
    },
  },
  {
    name: "fragile ask on absolute production path",
    run() {
      cleanupState("smoke-abs-fragile");
      const abs = path.join(root, "src/complexity/McCabe.ts");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_input: { path: abs },
        conversation_id: "smoke-abs-fragile",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "abs fragile ask");
      cleanupState("smoke-abs-fragile");
    },
  },
  {
    name: "fragile area additional_context",
    run() {
      cleanupState("smoke-4");
      const { stdout } = runHook("post-edit-guard.mjs", {
        hook_event_name: "postToolUse",
        tool_input: { path: "src/git/GitMiner.ts" },
        conversation_id: "smoke-4",
        workspace_roots: [root],
      });
      assertIncludes(stdout, "additional_context", "fragile context");
      assertIncludes(stdout, "fragile-areas.mdc", "fragile context body");
      cleanupState("smoke-4");
    },
  },
  {
    name: "planner boundary deny src edit",
    run() {
      cleanupState("smoke-3");
      runHook("subagent-start.mjs", {
        hook_event_name: "subagentStart",
        subagent_type: "planner-feature",
        conversation_id: "smoke-3",
      });
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_input: { path: "src/foo.ts" },
        conversation_id: "smoke-3",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"deny"', "planner deny");
      cleanupState("smoke-3");
    },
  },
  {
    name: "main agent ask on src edit while a feature is Planned",
    run() {
      cleanupState("smoke-boundary");
      const cleanupFeature = withFeature("_smoke-boundary-ask", "Planned");
      try {
        const { stdout } = runHook("pre-edit-guard.mjs", {
          hook_event_name: "preToolUse",
          tool_input: { path: "src/foo.ts" },
          conversation_id: "smoke-boundary",
          workspace_roots: [root],
        });
        assertIncludes(stdout, '"permission":"ask"', "boundary ask");
        assertIncludes(stdout, "_smoke-boundary-ask", "boundary ask names slug");
      } finally {
        cleanupFeature();
      }
      cleanupState("smoke-boundary");
    },
  },
  {
    name: "planning boundary ask is not repeated after the first edit",
    run() {
      cleanupState("smoke-boundary-ack");
      const cleanupFeature = withFeature("_smoke-boundary-ack", "Planned");
      try {
        runHook("post-edit-guard.mjs", {
          hook_event_name: "postToolUse",
          tool_input: { path: "src/foo.ts" },
          conversation_id: "smoke-boundary-ack",
          workspace_roots: [root],
        });
        const { stdout } = runHook("pre-edit-guard.mjs", {
          hook_event_name: "preToolUse",
          tool_input: { path: "src/foo.ts" },
          conversation_id: "smoke-boundary-ack",
          workspace_roots: [root],
        });
        assertIncludes(stdout, '"permission":"allow"', "boundary acked allow");
      } finally {
        cleanupFeature();
      }
      cleanupState("smoke-boundary-ack");
    },
  },
  {
    name: "implementer subagent is not blocked by the planning boundary",
    run() {
      cleanupState("smoke-boundary-impl");
      const cleanupFeature = withFeature("_smoke-boundary-impl", "Planned");
      try {
        runHook("subagent-start.mjs", {
          hook_event_name: "subagentStart",
          subagent_type: "implementer",
          conversation_id: "smoke-boundary-impl",
        });
        const { stdout } = runHook("pre-edit-guard.mjs", {
          hook_event_name: "preToolUse",
          tool_input: { path: "src/foo.ts" },
          conversation_id: "smoke-boundary-impl",
          workspace_roots: [root],
        });
        assertIncludes(stdout, '"permission":"allow"', "implementer allow");
      } finally {
        cleanupFeature();
      }
      cleanupState("smoke-boundary-impl");
    },
  },
  {
    name: "orchestrator deny when tasks Status Planned",
    run() {
      cleanupState("smoke-orch");
      const slug = "_smoke-orch-deny";
      const cleanupFeature = withFeature(slug, "Planned");
      try {
        const { stdout } = runHook("subagent-start.mjs", {
          hook_event_name: "subagentStart",
          subagent_type: "orchestrator-implementer",
          prompt: `Execute .specs/features/${slug}/tasks.md`,
          conversation_id: "smoke-orch",
          workspace_roots: [root],
        });
        assertIncludes(stdout, '"permission":"deny"', "orchestrator deny");
      } finally {
        cleanupFeature();
      }
      cleanupState("smoke-orch");
    },
  },
  {
    name: "orchestrator allow when header Status is promoted",
    run() {
      cleanupState("smoke-orch-ok");
      const slug = "_smoke-orch-allow";
      const cleanupFeature = withFeature(slug, "Ready for Execute");
      try {
        const { stdout } = runHook("subagent-start.mjs", {
          hook_event_name: "subagentStart",
          subagent_type: "orchestrator-implementer",
          prompt: `Execute .specs/features/${slug}/tasks.md`,
          conversation_id: "smoke-orch-ok",
          workspace_roots: [root],
        });
        assertIncludes(stdout, '"permission":"allow"', "orchestrator allow");
      } finally {
        cleanupFeature();
      }
      cleanupState("smoke-orch-ok");
    },
  },
  {
    name: "hooks.json matchers cover Delete and EditNotebook",
    run() {
      const config = readHooksConfig();
      for (const key of ["preToolUse", "postToolUse"]) {
        const entry = (config.hooks?.[key] ?? []).find(
          (h) =>
            typeof h.command === "string" &&
            h.command.includes("edit-guard.mjs"),
        );
        if (!entry) throw new Error(`wiring: missing edit-guard in ${key}`);
        const matcher = typeof entry.matcher === "string" ? entry.matcher : "";
        if (!matcher.includes("Delete") || !matcher.includes("EditNotebook")) {
          throw new Error(
            `wiring: ${key} matcher must include Delete|EditNotebook, got ${JSON.stringify(matcher)}`,
          );
        }
      }
    },
  },
  {
    name: "hooks.json wiring: subagentStop unfiltered, commit denies failClosed",
    run() {
      const config = readHooksConfig();
      const stopEntry = (config.hooks?.subagentStop ?? []).find(
        (h) =>
          typeof h.command === "string" &&
          h.command.includes("subagent-stop.mjs"),
      );
      if (!stopEntry) {
        throw new Error("wiring: missing subagent-stop.mjs in subagentStop");
      }
      if (stopEntry.matcher !== undefined) {
        throw new Error(
          `wiring: subagentStop must have no matcher so state clears for every subagent, got ${JSON.stringify(stopEntry.matcher)}`,
        );
      }
      const before = config.hooks?.beforeShellExecution ?? [];
      for (const script of ["commit-policy.mjs", "gate-before-commit.mjs"]) {
        const entry = before.find(
          (h) =>
            typeof h.command === "string" &&
            h.command.includes(script) &&
            h.matcher === "git commit",
        );
        if (!entry) {
          throw new Error(
            `wiring: missing ${script} with "git commit" matcher in beforeShellExecution`,
          );
        }
        if (entry.failClosed !== true) {
          throw new Error(
            `wiring: ${script} must set failClosed: true, got ${JSON.stringify(entry.failClosed)}`,
          );
        }
      }
    },
  },
  {
    name: "hooks.json wiring: record-gate-pass filtered to pnpm build/test with short timeout",
    run() {
      const config = readHooksConfig();
      const entry = (config.hooks?.afterShellExecution ?? []).find(
        (h) =>
          typeof h.command === "string" &&
          h.command.includes("record-gate-pass.mjs"),
      );
      if (!entry) {
        throw new Error("wiring: missing record-gate-pass.mjs in afterShellExecution");
      }
      const matcher = typeof entry.matcher === "string" ? entry.matcher : "";
      if (!matcher) {
        throw new Error(
          "wiring: record-gate-pass must set a matcher so it only runs for gate commands",
        );
      }
      for (const command of ["pnpm build", "pnpm test", "pnpm build && pnpm test"]) {
        if (!new RegExp(matcher).test(command)) {
          throw new Error(
            `wiring: record-gate-pass matcher ${JSON.stringify(matcher)} must match ${JSON.stringify(command)}`,
          );
        }
      }
      if (typeof entry.timeout !== "number" || entry.timeout > 15) {
        throw new Error(
          `wiring: record-gate-pass timeout must be short (<=15s), got ${JSON.stringify(entry.timeout)}`,
        );
      }
    },
  },
  {
    name: "hooks.json wiring: no preCompact / shell-guards, every command exists",
    run() {
      const config = readHooksConfig();
      if (config.hooks?.preCompact !== undefined) {
        throw new Error("wiring: preCompact hook must be removed");
      }
      const raw = JSON.stringify(config);
      if (raw.includes("shell-guards")) {
        throw new Error("wiring: shell-guards.mjs must be removed from hooks.json");
      }
      for (const [event, entries] of Object.entries(config.hooks ?? {})) {
        for (const entry of entries) {
          const script = String(entry.command ?? "").match(/\.cursor\/hooks\/\S+\.mjs/);
          if (!script) {
            throw new Error(`wiring: ${event} command is not a hook script: ${entry.command}`);
          }
          if (!fs.existsSync(path.join(root, script[0]))) {
            throw new Error(`wiring: ${event} references missing script ${script[0]}`);
          }
        }
      }
      for (const orphan of ["pre-compact.mjs", "shell-guards.mjs"]) {
        if (fs.existsSync(path.join(hooksDir, orphan))) {
          throw new Error(`wiring: ${orphan} should have been deleted`);
        }
      }
    },
  },
];

for (const entry of LIVING_SOT_ENTRIES) {
  const sample = SOT_SAMPLES[entry.id];
  if (!sample) {
    throw new Error(
      `smoke: LIVING_SOT_ENTRIES entry "${entry.id}" has no SOT_SAMPLES case — add one`,
    );
  }

  tests.push({
    name: `${entry.id} lint flags forbidden patterns`,
    run() {
      const dirty = entry.lint(sample.dirty);
      for (const label of sample.expect) {
        const hit = dirty.bannedMatches.some(
          (m) => m === label || m.toLowerCase() === label.toLowerCase(),
        );
        if (!hit) {
          throw new Error(
            `${entry.id}: expected ${label} in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
          );
        }
      }
      const clean = entry.lint(sample.clean);
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `${entry.id}: expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  });

  const liveFiles = liveFilesForEntry(root, entry);
  tests.push({
    name: `live ${entry.relPath} passes ${entry.id} lint (${liveFiles.length} file(s))`,
    run() {
      if (liveFiles.length === 0) {
        throw new Error(`${entry.id}: no live files resolved for ${entry.relPath}`);
      }
      const offenders = [];
      for (const rel of liveFiles) {
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) {
          throw new Error(`${entry.id}: missing live file ${rel}`);
        }
        const { bannedMatches } = entry.lint(fs.readFileSync(abs, "utf8"));
        if (bannedMatches.length > 0) {
          offenders.push(`${rel}: ${bannedMatches.join(", ")}`);
        }
      }
      if (offenders.length > 0) {
        throw new Error(
          `${entry.id}: live files contain forbidden content:\n${offenders.join("\n")}`,
        );
      }
    },
  });

  tests.push({
    name: `pre-edit ask on ${sample.editPath}`,
    run() {
      const id = `smoke-sot-${entry.id}`;
      cleanupState(id);
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, sample.editPath),
          contents: sample.editContents,
        },
        conversation_id: id,
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', `${entry.id} ask`);
      assertIncludes(stdout, sample.askNeedle, `${entry.id} ask mentions match`);
      cleanupState(id);
    },
  });
}

let passed = 0;
for (const t of tests) {
  try {
    t.run();
    console.log(`PASS: ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${t.name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

console.log(`\n${passed}/${tests.length} smoke tests passed`);
