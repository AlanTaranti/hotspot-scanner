#!/usr/bin/env node
/**
 * Smoke tests for hotspot-scanner Cursor hooks.
 * Run: pnpm hooks:smoke  (or: node .cursor/hooks/smoke-test.mjs)
 *
 * Living-doc lint cases are generated from LIVING_SOT_ENTRIES + SOT_SAMPLES:
 * one lint case (dirty + clean sample), one live-file case, one pre-edit ask
 * case per entry. Hook behavior cases live in smoke/cases.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { LIVING_SOT_ENTRIES } from "./lib/living-sot-doc.mjs";
import { liveFilesForEntry } from "./lib/live-sot-files.mjs";
import { manualCases } from "./smoke/cases.mjs";
import {
  assertIncludes,
  cleanupState,
  root,
  runHook,
} from "./smoke/harness.mjs";
import { SOT_SAMPLES } from "./smoke/sot-samples.mjs";

/** @type {{ name: string, run: () => void }[]} */
const tests = [...manualCases];

for (const entry of LIVING_SOT_ENTRIES) {
  const sample = SOT_SAMPLES[entry.id];
  if (!sample) {
    throw new Error(
      `smoke: LIVING_SOT_ENTRIES entry "${entry.id}" has no SOT_SAMPLES case — add one`,
    );
  }

  tests.push({
    name: `${entry.id} lint flags forbidden patterns`,
    run() {
      const dirty = entry.lint(sample.dirty);
      for (const label of sample.expect) {
        const hit = dirty.bannedMatches.some(
          (m) => m === label || m.toLowerCase() === label.toLowerCase(),
        );
        if (!hit) {
          throw new Error(
            `${entry.id}: expected ${label} in bannedMatches, got ${JSON.stringify(dirty.bannedMatches)}`,
          );
        }
      }
      const clean = entry.lint(sample.clean);
      if (clean.bannedMatches.length !== 0) {
        throw new Error(
          `${entry.id}: expected clean sample, got ${JSON.stringify(clean.bannedMatches)}`,
        );
      }
    },
  });

  const liveFiles = liveFilesForEntry(root, entry);
  tests.push({
    name: `live ${entry.relPath} passes ${entry.id} lint (${liveFiles.length} file(s))`,
    run() {
      if (liveFiles.length === 0) {
        throw new Error(`${entry.id}: no live files resolved for ${entry.relPath}`);
      }
      const offenders = [];
      for (const rel of liveFiles) {
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) {
          throw new Error(`${entry.id}: missing live file ${rel}`);
        }
        const { bannedMatches } = entry.lint(fs.readFileSync(abs, "utf8"));
        if (bannedMatches.length > 0) {
          offenders.push(`${rel}: ${bannedMatches.join(", ")}`);
        }
      }
      if (offenders.length > 0) {
        throw new Error(
          `${entry.id}: live files contain forbidden content:\n${offenders.join("\n")}`,
        );
      }
    },
  });

  tests.push({
    name: `pre-edit ask on ${sample.editPath}`,
    run() {
      const id = `smoke-sot-${entry.id}`;
      cleanupState(id);
      const { stdout } = runHook("pre-edit-guard.mjs", {
        hook_event_name: "preToolUse",
        tool_name: "Write",
        tool_input: {
          path: path.join(root, sample.editPath),
          contents: sample.editContents,
        },
        conversation_id: id,
        workspace_roots: [root],
      });
      assertIncludes(stdout, '"permission":"ask"', `${entry.id} ask`);
      assertIncludes(stdout, sample.askNeedle, `${entry.id} ask mentions match`);
      cleanupState(id);
    },
  });
}

let passed = 0;
for (const t of tests) {
  try {
    t.run();
    console.log(`PASS: ${t.name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL: ${t.name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

console.log(`\n${passed}/${tests.length} smoke tests passed`);
