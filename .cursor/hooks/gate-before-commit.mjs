#!/usr/bin/env node
import { allow, deny } from "./lib/respond.mjs";
import {
  gateStaleAfterEdits,
  getWorkspaceRoot,
  loadState,
  readStdinJson,
} from "./lib/state.mjs";

const input = await readStdinJson();
const state = loadState(input);
const workspaceRoot = getWorkspaceRoot(input);

if (gateStaleAfterEdits(workspaceRoot, state)) {
  deny(
    "Commit blocked: code changed without a recent gate. Run `pnpm verify` or invoke verifier-quality-gates before committing.",
    "Required quality gate (quality-gates.mdc). Run pnpm verify, then retry the commit.",
  );
  process.exit(0);
}

allow();
process.exit(0);
