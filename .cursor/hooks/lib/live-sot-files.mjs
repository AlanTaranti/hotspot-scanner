/**
 * Resolves which live repo files each `LIVING_SOT_ENTRIES` entry lints.
 * Kept out of `living-sot-doc.mjs` so the lint helpers stay pure (no fs).
 * Consumers: `smoke-test.mjs` and `tests/living-sot-docs.test.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { LIVING_SOT_ENTRIES } from "./living-sot-doc.mjs";

/**
 * @param {string} workspaceRoot
 * @param {string} relDir
 * @returns {string[]}
 */
function walkMarkdown(workspaceRoot, relDir) {
  const absDir = path.join(workspaceRoot, relDir);
  if (!fs.existsSync(absDir)) return [];

  const found = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...walkMarkdown(workspaceRoot, rel));
    } else if (entry.name.endsWith(".md")) {
      found.push(rel);
    }
  }
  return found.sort();
}

/**
 * @param {string} workspaceRoot
 * @param {import('./living-sot-doc.mjs').LivingSotEntry} entry
 * @returns {string[]}
 */
export function liveFilesForEntry(workspaceRoot, entry) {
  if (entry.liveRelPaths) return [...entry.liveRelPaths];
  if (entry.liveDir) return walkMarkdown(workspaceRoot, entry.liveDir);
  return [entry.relPath];
}

/**
 * @param {string} workspaceRoot
 * @returns {{ entry: import('./living-sot-doc.mjs').LivingSotEntry, files: string[] }[]}
 */
export function resolveLiveSotFiles(workspaceRoot) {
  return LIVING_SOT_ENTRIES.map((entry) => ({
    entry,
    files: liveFilesForEntry(workspaceRoot, entry),
  }));
}
