#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { additionalContext } from "./lib/respond.mjs";
import { getWorkspaceRoot, readStdinJson } from "./lib/state.mjs";

const input = await readStdinJson();
const root = getWorkspaceRoot(input);

const parts = [
  "@vitals/hotspot-scanner — gate obrigatório: pnpm build && pnpm test",
  "Antes de implementar: .specs/codebase/CONVENTIONS.md, TESTING.md; features em .specs/features/",
  "Pipeline: git → complexity → scoring → report",
];

const roadmapPath = path.join(root, ".specs/project/ROADMAP.md");
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, "utf8");
  const inProgress = findInProgressFeatures(root);
  const milestone = extractCurrentMilestone(roadmap);
  if (milestone) parts.push(`ROADMAP milestone ativo: ${milestone}`);
  if (inProgress.length > 0) {
    parts.push(`Features In Progress: ${inProgress.join(", ")}`);
  }
}

additionalContext(parts.join("\n"));
process.exit(0);

/**
 * @param {string} roadmap
 */
function extractCurrentMilestone(roadmap) {
  const match = roadmap.match(/##\s+Milestone\s+(\d+)[^\n]*/i);
  return match ? match[0].trim() : null;
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function findInProgressFeatures(root) {
  const featuresDir = path.join(root, ".specs/features");
  if (!fs.existsSync(featuresDir)) return [];

  const slugs = [];
  for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tasksPath = path.join(featuresDir, entry.name, "tasks.md");
    if (!fs.existsSync(tasksPath)) continue;
    const text = fs.readFileSync(tasksPath, "utf8");
    if (/Status:\s*`?In Progress`?/i.test(text)) {
      slugs.push(entry.name);
    }
  }
  return slugs;
}
