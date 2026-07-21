#!/usr/bin/env node
import { allow, deny, ask } from "./lib/respond.mjs";
import {
  extractEditContent,
  extractEditPath,
  FRAGILE_CONTEXT,
  isFragilePath,
  OWNERSHIP_PATH_RE,
  PLANNER_BLOCKED_RE,
  tsconfigAddsBinInclude,
  TSCONFIG_RE,
} from "./lib/paths.mjs";
import { loadState, readStdinJson } from "./lib/state.mjs";

const input = await readStdinJson();
const state = loadState(input);
const relPath = extractEditPath(input.tool_input);

if (!relPath) {
  allow();
  process.exit(0);
}

if (
  state.activeSubagent === "implementer" &&
  state.orchestrated &&
  OWNERSHIP_PATH_RE.test(relPath)
) {
  deny(
    "Implementer orquestrado não pode editar tasks.md nem ROADMAP.md — apenas o orchestrator-implementer atualiza Status e roadmap.",
    "Ver orchestrated-implementer.md e roadmap-sync.md.",
  );
  process.exit(0);
}

if (state.activeSubagent === "planner-feature" && PLANNER_BLOCKED_RE.test(relPath)) {
  deny(
    "Sessão de planejamento: planner-feature não edita src/, bin/ ou tests/. Artefatos ficam em .specs/features/ (planning-session-boundary.md).",
    "Planning session boundary — Status Planned, sem Execute nesta sessão.",
  );
  process.exit(0);
}

if (TSCONFIG_RE.test(relPath)) {
  const content = extractEditContent(input.tool_input);
  if (tsconfigAddsBinInclude(content)) {
    deny(
      "Proibido adicionar bin/ ao include do tsconfig.json sem reconciliar tsconfig.bin.json — causa output duplicado (bin-build.mdc).",
      "bin/ compila via tsconfig.bin.json, não via tsconfig.json root.",
    );
    process.exit(0);
  }
}

const isProductionFragile =
  isFragilePath(relPath) && !/\.test\.ts$/.test(relPath);
const fragileAckPaths = state.fragileAckPaths ?? [];

if (isProductionFragile && !fragileAckPaths.includes(relPath)) {
  ask(
    `Edição em área frágil (${relPath}). Confirme que atualizará testes Vitest co-localizados antes de marcar Complete.`,
    `Fragile scanner area. ${FRAGILE_CONTEXT} Path: ${relPath}`,
  );
  process.exit(0);
}

allow();
process.exit(0);
