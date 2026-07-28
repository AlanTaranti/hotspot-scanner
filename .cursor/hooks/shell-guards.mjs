#!/usr/bin/env node
/**
 * Shell guards for hotspot-scanner Cursor hooks.
 * Two concerns in one script (matched separately in hooks.json):
 *   - beforeShellExecution + hotspot-scanner → scanPathGuard
 *   - afterShellExecution + pnpm test → testFailureHints (heuristic only)
 */
import fs from "node:fs";
import path from "node:path";
import { allow, deny, additionalContext, emptyOk } from "./lib/respond.mjs";
import { getWorkspaceRoot, readStdinJson } from "./lib/state.mjs";

const input = await readStdinJson();
const event = input.hook_event_name;

if (event === "beforeShellExecution") {
  scanPathGuard(input);
  process.exit(0);
}

if (event === "afterShellExecution") {
  testFailureHints(input);
  process.exit(0);
}

emptyOk();
process.exit(0);

/**
 * Deny `hotspot-scanner scan <path>` when the path does not exist.
 * @param {Record<string, unknown>} input
 */
function scanPathGuard(input) {
  const command = typeof input.command === "string" ? input.command : "";
  const scanMatch = command.match(
    /(?:pnpm\s+(?:exec\s+)?)?hotspot-scanner\s+scan\s+(\S+)/,
  );
  if (!scanMatch) {
    allow();
    return;
  }

  const pathArg = scanMatch[1].replace(/^['"]|['"]$/g, "");
  const workspaceRoot = getWorkspaceRoot(input);
  const absPath = path.isAbsolute(pathArg)
    ? pathArg
    : path.resolve(workspaceRoot, pathArg);

  if (!fs.existsSync(absPath)) {
    deny(
      `Invalid fixture/path: ${pathArg} does not exist. Use tests/fixtures/repos/<slug> or invoke fixture-builder.`,
      `CLI validation (vitals-cli-validation): scan path must point to an existing directory. Tried: ${absPath}`,
    );
    return;
  }

  allow();
}

/**
 * Soft coverage hints after failed `pnpm test`. Heuristic only — not a SoT;
 * thresholds live in TESTING.md / vitest.config.ts.
 * @param {Record<string, unknown>} input
 */
function testFailureHints(input) {
  const command = typeof input.command === "string" ? input.command : "";
  if (!/\bpnpm\s+test\b/.test(command) || /\bpnpm\s+build\b/.test(command)) {
    emptyOk();
    return;
  }

  const exitCode =
    typeof input.exit_code === "number"
      ? input.exit_code
      : typeof input.exitCode === "number"
        ? input.exitCode
        : 0;

  if (exitCode === 0) {
    emptyOk();
    return;
  }

  const output =
    typeof input.output === "string"
      ? input.output
      : typeof input.stdout === "string"
        ? input.stdout
        : "";

  const hints = parseCoverageHints(output);
  if (hints.length > 0) {
    additionalContext(
      `pnpm test failed (exit ${exitCode}). Possible coverage below threshold (heuristic — confirm against TESTING.md):\n${hints.join("\n")}`,
    );
    return;
  }

  emptyOk();
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function parseCoverageHints(text) {
  const hints = [];
  for (const line of text.split("\n")) {
    const pct = line.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pct && Number(pct[1]) < 80) {
      hints.push(line.trim());
    }
  }
  return [...new Set(hints)].slice(0, 12);
}
