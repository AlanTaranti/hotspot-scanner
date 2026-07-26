#!/usr/bin/env node
/**
 * Smoke tests for hotspot-scanner Cursor hooks.
 * Run: pnpm hooks:smoke  (or: node .cursor/hooks/smoke-test.mjs)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
