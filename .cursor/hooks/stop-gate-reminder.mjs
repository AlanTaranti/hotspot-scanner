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

if (state.codeTouched && gateStaleAfterEdits(workspaceRoot, state)) {
  followup(
    "Gate pendente antes de encerrar: execute `pnpm build && pnpm test` ou invoque verifier-quality-gates. Nenhuma tarefa é Done com gate falhando (quality-gates.mdc).",
  );
  process.exit(0);
}

emptyOk();
process.exit(0);
