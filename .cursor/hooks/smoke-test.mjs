#!/usr/bin/env node
/**
 * Smoke tests for hotspot-scanner Cursor hooks. Run: node .cursor/hooks/smoke-test.mjs
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
    throw new Error(`${label}: expected stdout to include ${JSON.stringify(needle)}, got: ${stdout}`);
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
      });
      assertIncludes(stdout, '"permission":"deny"', "planner deny");
      cleanupState("smoke-3");
    },
  },
  {
    name: "fragile area additional_context",
    run() {
      const { stdout } = runHook("post-edit-guard.mjs", {
        hook_event_name: "postToolUse",
        tool_input: { path: "src/git/GitMiner.ts" },
        conversation_id: "smoke-4",
      });
      assertIncludes(stdout, "additional_context", "fragile context");
      assertIncludes(stdout, "fragile-areas.mdc", "fragile context body");
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
      const touchPath = "src/index.ts";
      runHook("post-edit-guard.mjs", {
        hook_event_name: "postToolUse",
        tool_input: { path: touchPath },
        conversation_id: "smoke-2b",
        workspace_roots: [root],
      });
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
      assertIncludes(stdout, '"permission":"allow"', "gate allow split");
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
      });
      assertIncludes(stdout, '"permission":"ask"', "fragile ask");
      cleanupState("smoke-5");
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
