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

const isVerify = /\bpnpm\s+verify\b/.test(command);
const hasBuild = /\bpnpm\s+build\b/.test(command);
const hasTest = /\bpnpm\s+test\b/.test(command);
const hasLint = /\bpnpm\s+lint\b/.test(command);
const hasFormatCheck = /\bpnpm\s+format:check\b/.test(command);

const isFullGate =
  isVerify || (hasBuild && hasTest && hasLint && hasFormatCheck);

if (event === "afterShellExecution") {
  const now = new Date().toISOString();

  if (isFullGate && exitCode === 0) {
    saveState(input, {
      gatePassedAt: now,
      buildPassedAt: now,
      testPassedAt: now,
      lintPassedAt: now,
      formatCheckPassedAt: now,
    });
    emptyOk();
    process.exit(0);
  }

  /** @type {Record<string, string | null>} */
  const patch = {};
  if (hasBuild && exitCode === 0) patch.buildPassedAt = now;
  if (hasTest) patch.testPassedAt = exitCode === 0 ? now : null;
  if (hasLint) patch.lintPassedAt = exitCode === 0 ? now : null;
  if (hasFormatCheck) patch.formatCheckPassedAt = exitCode === 0 ? now : null;

  if (Object.keys(patch).length > 0) {
    saveState(input, patch);
  }
}

emptyOk();
process.exit(0);
