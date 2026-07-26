#!/usr/bin/env node
import { allow, deny, emptyOk } from "./lib/respond.mjs";
import { loadState, readStdinJson, saveState } from "./lib/state.mjs";

const COMMIT_REQUEST_RE = /\b(commit|commite|comitar|versionar)\b/i;

const input = await readStdinJson();
const event = input.hook_event_name;

if (event === "beforeSubmitPrompt") {
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const state = loadState(input);
  const userAllowedCommit =
    state.userAllowedCommit || COMMIT_REQUEST_RE.test(prompt);
  saveState(input, { userAllowedCommit });
  emptyOk();
  process.exit(0);
}

if (event === "beforeShellExecution") {
  const command = typeof input.command === "string" ? input.command : "";
  if (!/\bgit\s+commit\b/.test(command)) {
    allow();
    process.exit(0);
  }

  const state = loadState(input);
  if (!state.userAllowedCommit) {
    deny(
      "Commit blocked: the user did not explicitly ask to commit in this session. Include commit, commite, comitar, or versionar in the message.",
      "AGENTS.md: do not commit unless the user asks. Message must include: commit | commite | comitar | versionar.",
    );
    process.exit(0);
  }

  saveState(input, { userAllowedCommit: false });
  allow();
  process.exit(0);
}

allow();
process.exit(0);
