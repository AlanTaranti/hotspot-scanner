#!/usr/bin/env node
/**
 * Smoke tests for hotspot-scanner Cursor hooks.
 * Run: pnpm hooks:smoke  (or: node .cursor/hooks/smoke-test.mjs)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARCHITECTURE_REL_PATH,
  CONCERNS_REL_PATH,
  CONVENTIONS_REL_PATH,
  INTEGRATIONS_REL_PATH,
  PROJECT_REL_PATH,
  ROADMAP_REL_PATH,
  STACK_REL_PATH,
  STRUCTURE_REL_PATH,
  TESTING_REL_PATH,
  lintArchitectureDoc,
  lintConcernsDoc,
  lintConventionsDoc,
  lintIntegrationsDoc,
  lintProjectDoc,
  lintRoadmapDoc,
  lintStackDoc,
  lintStructureDoc,
  lintTestingDoc,
} from "./lib/living-sot-doc.mjs";

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
    name: "gate allow after separate pnpm build and pnpm test",
    run() {
      cleanupState("smoke-2b");
      const touchPath = path.join(root, "src/index.ts");
      // Ensure file exists for mtime check (or use a real tracked file)
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
    name: "fixture path deny",
    run() {
      const { stdout } = runHook("shell-guards.mjs", {
        hook_event_name: "beforeShellExecution",
        command: "pnpm exec hotspot-scanner scan /nonexistent",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"deny"', "fixture deny");
    },
  },
  {
    name: "orchestrator deny when tasks Status Planned",
    run() {
      cleanupState("smoke-orch");
      const slug = "_smoke-orch-deny";
      const featureDir = path.join(root, ".specs/features", slug);
      const tasksAbs = path.join(featureDir, "tasks.md");
      fs.mkdirSync(featureDir, { recursive: true });
      fs.writeFileSync(
        tasksAbs,
        "# Smoke\n\n**Status**: `Planned`\n\n## Tasks\n\n- T1 placeholder\n",
      );
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
        fs.rmSync(featureDir, { recursive: true, force: true });
      }
      cleanupState("smoke-orch");
    },
  },
  {
    name: "hooks.json matchers cover Delete and EditNotebook",
    run() {
      const hooksPath = path.join(root, ".cursor/hooks.json");
      const config = JSON.parse(fs.readFileSync(hooksPath, "utf8"));
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
      const before = config.hooks?.beforeShellExecution ?? [];
      const shellEntry = before.find(
        (h) =>
          typeof h.command === "string" &&
          h.command.includes("shell-guards.mjs"),
      );
      if (!shellEntry) {
        throw new Error("wiring: no shell-guards.mjs in beforeShellExecution");
      }
      const matcher =
        typeof shellEntry.matcher === "string" ? shellEntry.matcher : "";
      if (!/hotspot-scanner|scan/.test(matcher)) {
        throw new Error(
          `wiring: beforeShellExecution shell-guards matcher must match hotspot-scanner/scan, got ${JSON.stringify(matcher)}`,
        );
      }
    },
  },
  {
    name: "architecture lint flags M## and HOTSPOT-*",
    run() {
      const dirty = lintArchitectureDoc(
        "# ARCHITECTURE\n\nRemoved in M71. See HOTSPOT-1042.\n",
      );
      if (!dirty.bannedMatches.includes("M71")) {
        throw new Error(
          `expected M71 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      if (!dirty.bannedMatches.some((m) => /^HOTSPOT-1042$/i.test(m))) {
        throw new Error(
          `expected HOTSPOT-1042 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      const clean = lintArchitectureDoc(
        "# ARCHITECTURE\n\nDesign SoT. ADR-2026-020. RT-001.\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live ARCHITECTURE.md has no banned milestone tags",
    run() {
      const text = fs.readFileSync(
        path.join(root, ARCHITECTURE_REL_PATH),
        "utf8",
      );
      const { bannedMatches } = lintArchitectureDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `ARCHITECTURE.md contains forbidden tags: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on ARCHITECTURE Write with M78",
    run() {
      cleanupState("smoke-arch");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/codebase/ARCHITECTURE.md"),
          contents: "## Pipeline (M78)\n",
        },
        conversation_id: "smoke-arch",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "architecture ask");
      assertIncludes(stdout, "M78", "architecture ask mentions M78");
      cleanupState("smoke-arch");
    },
  },
  {
    name: "concerns lint flags M## and HOTSPOT-*",
    run() {
      const dirty = lintConcernsDoc(
        "# CONCERNS\n\nSuperseded in M71. See HOTSPOT-1042.\n",
      );
      if (!dirty.bannedMatches.includes("M71")) {
        throw new Error(
          `expected M71 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      if (!dirty.bannedMatches.some((m) => /^HOTSPOT-1042$/i.test(m))) {
        throw new Error(
          `expected HOTSPOT-1042 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      const clean = lintConcernsDoc(
        "# CONCERNS\n\nFragile risks. RT-001. RT-005.\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live CONCERNS.md has no banned milestone tags",
    run() {
      const text = fs.readFileSync(path.join(root, CONCERNS_REL_PATH), "utf8");
      const { bannedMatches } = lintConcernsDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `CONCERNS.md contains forbidden tags: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on CONCERNS Write with M78",
    run() {
      cleanupState("smoke-concerns");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/codebase/CONCERNS.md"),
          contents: "## Hotspot assess (M78)\n",
        },
        conversation_id: "smoke-concerns",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "concerns ask");
      assertIncludes(stdout, "M78", "concerns ask mentions M78");
      cleanupState("smoke-concerns");
    },
  },
  {
    name: "integrations lint flags M## and HOTSPOT-*",
    run() {
      const dirty = lintIntegrationsDoc(
        "# INTEGRATIONS\n\nRemoved in M71. See HOTSPOT-1042.\n",
      );
      if (!dirty.bannedMatches.includes("M71")) {
        throw new Error(
          `expected M71 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      if (!dirty.bannedMatches.some((m) => /^HOTSPOT-1042$/i.test(m))) {
        throw new Error(
          `expected HOTSPOT-1042 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      const clean = lintIntegrationsDoc(
        "# INTEGRATIONS\n\nExternal adapters. Git spawn in src/git/.\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live INTEGRATIONS.md has no banned milestone tags",
    run() {
      const text = fs.readFileSync(
        path.join(root, INTEGRATIONS_REL_PATH),
        "utf8",
      );
      const { bannedMatches } = lintIntegrationsDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `INTEGRATIONS.md contains forbidden tags: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on INTEGRATIONS Write with M78",
    run() {
      cleanupState("smoke-integrations");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/codebase/INTEGRATIONS.md"),
          contents: "## Git (M78)\n",
        },
        conversation_id: "smoke-integrations",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "integrations ask");
      assertIncludes(stdout, "M78", "integrations ask mentions M78");
      cleanupState("smoke-integrations");
    },
  },
  {
    name: "stack lint flags M## and HOTSPOT-*",
    run() {
      const dirty = lintStackDoc(
        "# STACK\n\nPackage publish prep (M71). See HOTSPOT-1042.\n",
      );
      if (!dirty.bannedMatches.includes("M71")) {
        throw new Error(
          `expected M71 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      if (!dirty.bannedMatches.some((m) => /^HOTSPOT-1042$/i.test(m))) {
        throw new Error(
          `expected HOTSPOT-1042 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      const clean = lintStackDoc(
        "# STACK\n\nNode.js 22+. commander. picomatch.\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live STACK.md has no banned milestone tags",
    run() {
      const text = fs.readFileSync(path.join(root, STACK_REL_PATH), "utf8");
      const { bannedMatches } = lintStackDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `STACK.md contains forbidden tags: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on STACK Write with M78",
    run() {
      cleanupState("smoke-stack");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/codebase/STACK.md"),
          contents: "## Package publish (M78)\n",
        },
        conversation_id: "smoke-stack",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "stack ask");
      assertIncludes(stdout, "M78", "stack ask mentions M78");
      cleanupState("smoke-stack");
    },
  },
  {
    name: "structure lint flags M## and HOTSPOT-*",
    run() {
      const dirty = lintStructureDoc(
        "# STRUCTURE\n\n## Directory layout (M71). See HOTSPOT-1042.\n",
      );
      if (!dirty.bannedMatches.includes("M71")) {
        throw new Error(
          `expected M71 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      if (!dirty.bannedMatches.some((m) => /^HOTSPOT-1042$/i.test(m))) {
        throw new Error(
          `expected HOTSPOT-1042 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      const clean = lintStructureDoc(
        "# STRUCTURE\n\nDirectory layout and public API map.\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live STRUCTURE.md has no banned milestone tags",
    run() {
      const text = fs.readFileSync(path.join(root, STRUCTURE_REL_PATH), "utf8");
      const { bannedMatches } = lintStructureDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `STRUCTURE.md contains forbidden tags: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on STRUCTURE Write with M78",
    run() {
      cleanupState("smoke-structure");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/codebase/STRUCTURE.md"),
          contents: "## Module map (M78)\n",
        },
        conversation_id: "smoke-structure",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "structure ask");
      assertIncludes(stdout, "M78", "structure ask mentions M78");
      cleanupState("smoke-structure");
    },
  },
  {
    name: "testing lint flags M## and HOTSPOT-*",
    run() {
      const dirty = lintTestingDoc(
        "# TESTING\n\n## NCLOC regressions (M57). See HOTSPOT-1042.\n",
      );
      if (!dirty.bannedMatches.includes("M57")) {
        throw new Error(
          `expected M57 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      if (!dirty.bannedMatches.some((m) => /^HOTSPOT-1042$/i.test(m))) {
        throw new Error(
          `expected HOTSPOT-1042 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      const clean = lintTestingDoc(
        "# TESTING\n\nQuality gate and Vitest coverage thresholds.\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live TESTING.md has no banned milestone tags",
    run() {
      const text = fs.readFileSync(path.join(root, TESTING_REL_PATH), "utf8");
      const { bannedMatches } = lintTestingDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `TESTING.md contains forbidden tags: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on TESTING Write with M57",
    run() {
      cleanupState("smoke-testing");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/codebase/TESTING.md"),
          contents: "## NCLOC regressions (M57)\n",
        },
        conversation_id: "smoke-testing",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "testing ask");
      assertIncludes(stdout, "M57", "testing ask mentions M57");
      cleanupState("smoke-testing");
    },
  },
  {
    name: "conventions lint flags M## only (HOTSPOT naming allowed)",
    run() {
      const dirty = lintConventionsDoc(
        "# CONVENTIONS\n\n## Lint and format (M24)\n",
      );
      if (!dirty.bannedMatches.includes("M24")) {
        throw new Error(
          `expected M24 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      const clean = lintConventionsDoc(
        "# CONVENTIONS\n\nRequirement IDs: `HOTSPOT-*`\nADR-2026-021\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean sample (HOTSPOT naming allowed), got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live CONVENTIONS.md has no banned milestone tags",
    run() {
      const text = fs.readFileSync(
        path.join(root, CONVENTIONS_REL_PATH),
        "utf8",
      );
      const { bannedMatches } = lintConventionsDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `CONVENTIONS.md contains forbidden tags: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on CONVENTIONS Write with M24",
    run() {
      cleanupState("smoke-conventions");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/codebase/CONVENTIONS.md"),
          contents: "## Lint and format (M24)\n",
        },
        conversation_id: "smoke-conventions",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "conventions ask");
      assertIncludes(stdout, "M24", "conventions ask mentions M24");
      cleanupState("smoke-conventions");
    },
  },
  {
    name: "project lint flags M## and HOTSPOT-*",
    run() {
      const dirty = lintProjectDoc(
        "# PROJECT\n\nShipped through M78. See HOTSPOT-1042.\n",
      );
      if (!dirty.bannedMatches.includes("M78")) {
        throw new Error(
          `expected M78 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      if (!dirty.bannedMatches.some((m) => /^HOTSPOT-1042$/i.test(m))) {
        throw new Error(
          `expected HOTSPOT-1042 in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
        );
      }
      const clean = lintProjectDoc(
        "# PROJECT\n\nVision: local CLI. See ROADMAP.md.\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live PROJECT.md has no banned milestone tags",
    run() {
      const text = fs.readFileSync(path.join(root, PROJECT_REL_PATH), "utf8");
      const { bannedMatches } = lintProjectDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `PROJECT.md contains forbidden tags: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on PROJECT Write with M78",
    run() {
      cleanupState("smoke-project");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/project/PROJECT.md"),
          contents: "## Scope (through M78)\n",
        },
        conversation_id: "smoke-project",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "project ask");
      assertIncludes(stdout, "M78", "project ask mentions M78");
      cleanupState("smoke-project");
    },
  },
  {
    name: "roadmap lint flags drift patterns but allows M##",
    run() {
      const dirty = lintRoadmapDoc(
        "# ROADMAP\n\n## Milestone 1 — DONE\n\n**Artifacts:** [spec.md](x)\n\n- [x] task\n\nSee HOTSPOT-1. Final gate `pnpm test`.\n",
      );
      for (const label of ["Artifacts:", "HOTSPOT-*", "Final gate", "task checkbox"]) {
        if (!dirty.bannedMatches.includes(label)) {
          throw new Error(
            `expected ${label} in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
          );
        }
      }
      const clean = lintRoadmapDoc(
        "# ROADMAP\n\n## Current\n\n**Status** | **M78 Done**\n\n## Milestone 1 — Scaffold — DONE\n\n→ [spec.md](../features/scaffold/spec.md)\n\nPackage stub.\n\n- Build scripts\n",
      );
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `expected clean ROADMAP sample (M## allowed), got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  },
  {
    name: "live ROADMAP.md has no forbidden drift patterns",
    run() {
      const text = fs.readFileSync(path.join(root, ROADMAP_REL_PATH), "utf8");
      const { bannedMatches } = lintRoadmapDoc(text);
      if (bannedMatches.length > 0) {
        throw new Error(
          `ROADMAP.md contains forbidden drift patterns: ${bannedMatches.join(", ")}`,
        );
      }
    },
  },
  {
    name: "pre-edit ask on ROADMAP Write with Artifacts",
    run() {
      cleanupState("smoke-roadmap");
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, ".specs/project/ROADMAP.md"),
          contents: "## Milestone 99 — X — DONE\n\n**Artifacts:** [spec.md](x)\n",
        },
        conversation_id: "smoke-roadmap",
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', "roadmap ask");
      assertIncludes(stdout, "Artifacts:", "roadmap ask mentions Artifacts");
      cleanupState("smoke-roadmap");
    },
  },
];

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
