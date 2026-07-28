#!/usr/bin/env node
import { followup, emptyOk } from "./lib/respond.mjs";
import {
  gateStaleAfterEdits,
  getWorkspaceRoot,
  loadState,
  readStdinJson,
} from "./lib/state.mjs";

const input = await readStdinJson();
const state = loadState(input);
const workspaceRoot = getWorkspaceRoot(input);

if (
  (state.codeTouched ||
    state.touchedPaths.length > 0) &&
  gateStaleAfterEdits(workspaceRoot, state)
) {
  followup(
    "Pending gate before stopping: run `pnpm verify` or invoke verifier-quality-gates. No task is Done with a failing gate (quality-gates.mdc).",
  );
  process.exit(0);
}

emptyOk();
process.exit(0);
