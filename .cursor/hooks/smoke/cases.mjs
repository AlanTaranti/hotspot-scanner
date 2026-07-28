/**
 * Hand-written hook behavior cases for smoke tests.
 */
import fs from "node:fs";
import path from "node:path";
import {
  assertIncludes,
  cleanupState,
  hooksDir,
  readHooksConfig,
  root,
  runHook,
  stateDir,
  withFeature,
} from "./harness.mjs";

/** @type {{ name: string, run: () => void }[]} */
export const manualCases = [
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
