#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { allow, deny, additionalContext, emptyOk } from "./lib/respond.mjs";
import { getWorkspaceRoot, readStdinJson } from "./lib/state.mjs";

const input = await readStdinJson();
const event = input.hook_event_name;

if (event === "beforeShellExecution") {
  const command = typeof input.command === "string" ? input.command : "";
  const scanMatch = command.match(
    /(?:pnpm\s+(?:exec\s+)?)?hotspot-scanner\s+scan\s+(\S+)/,
  );
  if (!scanMatch) {
    allow();
    process.exit(0);
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
    process.exit(0);
  }

  allow();
  process.exit(0);
}

if (event === "afterShellExecution") {
  const command = typeof input.command === "string" ? input.command : "";
  if (!/\bpnpm\s+test\b/.test(command) || /\bpnpm\s+build\b/.test(command)) {
    emptyOk();
    process.exit(0);
  }

  const exitCode =
    typeof input.exit_code === "number"
      ? input.exit_code
      : typeof input.exitCode === "number"
        ? input.exitCode
        : 0;

  if (exitCode === 0) {
    emptyOk();
    process.exit(0);
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
      `pnpm test failed (exit ${exitCode}). Possible coverage below threshold:\n${hints.join("\n")}`,
    );
    process.exit(0);
  }
}

emptyOk();
process.exit(0);

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
