#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { emptyOk } from "./lib/respond.mjs";
import { getWorkspaceRoot, loadState, readStdinJson } from "./lib/state.mjs";

const input = await readStdinJson();
const root = getWorkspaceRoot(input);
const state = loadState(input);

const handoffDir = path.join(root, ".specs");
const stamp = new Date().toISOString();
const snapshot = {
  date: stamp,
  activeSubagent: state.activeSubagent,
  orchestrated: state.orchestrated,
  codeTouched: state.codeTouched,
  gatePassedAt: state.gatePassedAt,
  touchedFragile: state.touchedFragile,
  touchedPaths: state.touchedPaths.slice(-20),
};

const checkpointPath = path.join(handoffDir, ".hooks-checkpoint.json");
try {
  fs.mkdirSync(handoffDir, { recursive: true });
  fs.writeFileSync(checkpointPath, JSON.stringify(snapshot, null, 2));
} catch {
  // best-effort checkpoint before compaction
}

emptyOk();
process.exit(0);
