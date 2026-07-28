#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { allow, deny, emptyOk } from "./lib/respond.mjs";
import {
  DRAFT_OR_PLANNED_STATUS_RE,
  tasksStatusMatches,
} from "./lib/feature-status.mjs";
import { getWorkspaceRoot, readStdinJson, saveState } from "./lib/state.mjs";

/**
 * @param {string} prompt
 * @param {string} workspaceRoot
 * @returns {string | null}
 */
function resolveTasksPathFromPrompt(prompt, workspaceRoot) {
  const explicit = prompt.match(
    /\.specs\/features\/[a-z0-9-]+\/tasks\.md/i,
  );
  if (explicit) {
    return path.join(workspaceRoot, explicit[0].replace(/^\//, ""));
  }

  const slugMatch = prompt.match(
    /(?:feature|Feature|slug)[:\s]+([a-z0-9-]+)/i,
  );
  if (slugMatch) {
    const candidate = path.join(
      workspaceRoot,
      ".specs/features",
      slugMatch[1],
      "tasks.md",
    );
    if (fs.existsSync(candidate)) return candidate;
  }

  const featuresDir = path.join(workspaceRoot, ".specs/features");
  if (!fs.existsSync(featuresDir)) return null;

  for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!prompt.includes(entry.name)) continue;
    const candidate = path.join(featuresDir, entry.name, "tasks.md");
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

const input = await readStdinJson();
const event = input.hook_event_name;

if (event === "subagentStart") {
  const subagentType =
    typeof input.subagent_type === "string"
      ? input.subagent_type
      : typeof input.agent_type === "string"
        ? input.agent_type
        : typeof input.subagentType === "string"
          ? input.subagentType
          : null;

  const prompt =
    typeof input.prompt === "string"
      ? input.prompt
      : typeof input.task === "string"
        ? input.task
        : typeof input.description === "string"
          ? input.description
          : "";

  const orchestrated = /orchestrated:\s*true/i.test(prompt);

  saveState(input, {
    activeSubagent: subagentType,
    orchestrated,
  });

  if (subagentType === "orchestrator-implementer" && prompt) {
    const workspaceRoot = getWorkspaceRoot(input);
    const tasksPath = resolveTasksPathFromPrompt(prompt, workspaceRoot);
    if (tasksPath) {
      const text = fs.readFileSync(tasksPath, "utf8");
      if (tasksStatusMatches(text, DRAFT_OR_PLANNED_STATUS_RE)) {
        deny(
          "Execute blocked: tasks.md is Draft or Planned. Promote Status to Approved/Ready for Execute before starting the orchestrator (Phase A).",
          "Planning session boundary — promote Status before orchestrator-implementer.",
        );
        process.exit(0);
      }
    }
  }

  allow();
  process.exit(0);
}

emptyOk();
process.exit(0);
