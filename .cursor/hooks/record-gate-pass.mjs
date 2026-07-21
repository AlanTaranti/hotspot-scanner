#!/usr/bin/env node
import { emptyOk } from "./lib/respond.mjs";
import { readStdinJson, saveState } from "./lib/state.mjs";

const input = await readStdinJson();
const event = input.hook_event_name;
const command = typeof input.command === "string" ? input.command : "";
const exitCode =
  typeof input.exit_code === "number"
    ? input.exit_code
    : typeof input.exitCode === "number"
      ? input.exitCode
      : 0;
const output =
  typeof input.output === "string"
    ? input.output
    : typeof input.stdout === "string"
      ? input.stdout
      : "";

const isFullGate =
  /pnpm\s+build\s*&&\s*pnpm\s+test/.test(command) ||
  (/\bpnpm\s+build\b/.test(command) && /\bpnpm\s+test\b/.test(command));

const isBuildOnly = /\bpnpm\s+build\b/.test(command) && !/\bpnpm\s+test\b/.test(command);
const isTestOnly = /\bpnpm\s+test\b/.test(command) && !/\bpnpm\s+build\b/.test(command);

if (event === "afterShellExecution") {
  const now = new Date().toISOString();

  if (isFullGate && exitCode === 0) {
    saveState(input, {
      gatePassedAt: now,
      buildPassedAt: now,
      testPassedAt: now,
      lastTestExitCode: 0,
      lastTestOutput: output.slice(-8000),
    });
    emptyOk();
    process.exit(0);
  }

  if (isBuildOnly && exitCode === 0) {
    saveState(input, { buildPassedAt: now });
  }

  if (isTestOnly) {
    saveState(input, {
      ...(exitCode === 0 ? { testPassedAt: now } : { testPassedAt: null }),
      lastTestExitCode: exitCode,
      lastTestOutput: output.slice(-8000),
    });
  }
}

emptyOk();
process.exit(0);
