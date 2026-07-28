#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { additionalContext } from "./lib/respond.mjs";
import { getWorkspaceRoot, readStdinJson } from "./lib/state.mjs";

const STATE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.resolve(__dirname, "..", "hooks-state");

/**
 * Best-effort prune of stale session state files (mtime older than TTL).
 */
function pruneStaleStateFiles() {
  try {
    if (!fs.existsSync(STATE_DIR)) return;
    const cutoff = Date.now() - STATE_TTL_MS;
    for (const name of fs.readdirSync(STATE_DIR)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(STATE_DIR, name);
      try {
        const stat = fs.statSync(file);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(file);
      } catch {
        // ignore per-file errors
      }
    }
  } catch {
    // best-effort
  }
}

const input = await readStdinJson();
pruneStaleStateFiles();

const root = getWorkspaceRoot(input);

const parts = [
  "@vitals/hotspot-scanner — required gate: pnpm build && pnpm test",
  "Before implementing: .specs/codebase/CONVENTIONS.md, TESTING.md; features under .specs/features/",
  "Pipeline: git → complexity → scoring → report",
];

const roadmapPath = path.join(root, ".specs/project/ROADMAP.md");
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, "utf8");
  const inProgress = findFeaturesByStatus(root, /Status:\s*`?In Progress`?/i);
  const planned = findFeaturesByStatus(root, /Status:\s*`?Planned`?/i);
  const milestone = extractCurrentMilestone(roadmap, inProgress);
  if (milestone) parts.push(`ROADMAP active milestone: ${milestone}`);
  if (inProgress.length > 0) {
    parts.push(`Features In Progress: ${inProgress.join(", ")}`);
  }
  if (planned.length > 0) {
    parts.push(
      `Features Status Planned (no Execute / no src|bin|tests impl in this session until Status promoted): ${planned.join(", ")}`,
    );
  }
}

additionalContext(parts.join("\n"));
process.exit(0);

/**
 * Prefer a milestone that mentions an In Progress feature, else the last
 * Milestone heading that still has open checkbox items, else the first heading.
 * @param {string} roadmap
 * @param {string[]} inProgress
 */
function extractCurrentMilestone(roadmap, inProgress) {
  const sections = [];
  const re = /^##\s+(Milestone\s+\d+[^\n]*)/gim;
  let match;
  while ((match = re.exec(roadmap)) !== null) {
    sections.push({ title: match[1].trim(), index: match.index });
  }
  if (sections.length === 0) return null;

  const bodyOf = (i) => {
    const start = sections[i].index;
    const end =
      i + 1 < sections.length ? sections[i + 1].index : roadmap.length;
    return roadmap.slice(start, end);
  };

  for (let i = 0; i < sections.length; i++) {
    const body = bodyOf(i);
    if (inProgress.some((slug) => body.includes(slug))) {
      return sections[i].title;
    }
  }

  for (let i = sections.length - 1; i >= 0; i--) {
    const body = bodyOf(i);
    if (/\[[ \t]\]/.test(body) || /\bTODO\b|\bIn Progress\b/i.test(body)) {
      return sections[i].title;
    }
  }

  return sections[0].title;
}

/**
 * @param {string} root
 * @param {RegExp} statusRe
 * @returns {string[]}
 */
function findFeaturesByStatus(root, statusRe) {
  const featuresDir = path.join(root, ".specs/features");
  if (!fs.existsSync(featuresDir)) return [];

  const slugs = [];
  for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tasksPath = path.join(featuresDir, entry.name, "tasks.md");
    if (!fs.existsSync(tasksPath)) continue;
    const text = fs.readFileSync(tasksPath, "utf8");
    if (statusRe.test(text)) {
      slugs.push(entry.name);
    }
  }
  return slugs;
}
