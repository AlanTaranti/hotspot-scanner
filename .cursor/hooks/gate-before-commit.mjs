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
    "Commit bloqueado: código foi alterado sem gate recente. Execute `pnpm build && pnpm test` ou invoque verifier-quality-gates antes de commitar.",
    "Quality gate obrigatório (quality-gates.mdc). Rode pnpm build && pnpm test e só então tente o commit.",
  );
  process.exit(0);
}

allow();
process.exit(0);
