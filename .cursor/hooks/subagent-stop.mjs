#!/usr/bin/env node
import { followup, emptyOk } from "./lib/respond.mjs";
import { loadState, readStdinJson, saveState } from "./lib/state.mjs";

const input = await readStdinJson();
const state = loadState(input);

saveState(input, {
  activeSubagent: null,
  orchestrated: false,
});

const subagentType =
  typeof input.subagent_type === "string"
    ? input.subagent_type
    : typeof input.agent_type === "string"
      ? input.agent_type
      : "";

const messages = [];

if (state.codeTouched) {
  messages.push(
    "Before marking Done: invoke verifier-quality-gates and confirm `pnpm verify` PASS (orchestrator Phase E).",
  );
}

if (
  messages.length > 0 &&
  /implementer|orchestrator-implementer/.test(subagentType)
) {
  followup(messages.join("\n\n"));
  process.exit(0);
}

emptyOk();
process.exit(0);
