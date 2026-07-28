import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the living-doc SoT lint enforced by Cursor hooks
 * (`.cursor/hooks/lib/living-sot-doc.mjs`, registry `LIVING_SOT_ENTRIES`).
 * `pnpm hooks:smoke` covers hook wiring; this keeps the doc lint in the
 * project gate so drift fails CI even when hooks never run.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type LintResult = { bannedMatches: string[] };

type LivingSotEntry = {
  id: string;
  relPath: string;
  lint: (text: string) => LintResult;
};

const hookLib = async (file: string): Promise<any> =>
  import(pathToFileURL(path.join(root, ".cursor/hooks/lib", file)).href);

const { LIVING_SOT_ENTRIES } = (await hookLib("living-sot-doc.mjs")) as {
  LIVING_SOT_ENTRIES: LivingSotEntry[];
};
const { liveFilesForEntry } = (await hookLib("live-sot-files.mjs")) as {
  liveFilesForEntry: (workspaceRoot: string, entry: LivingSotEntry) => string[];
};

describe("living SoT docs", () => {
  it("registers at least the codebase and project docs", () => {
    expect(LIVING_SOT_ENTRIES.length).toBeGreaterThan(10);
  });

  for (const entry of LIVING_SOT_ENTRIES) {
    const files = liveFilesForEntry(root, entry);

    it(`${entry.id}: resolves live files`, () => {
      expect(files.length).toBeGreaterThan(0);
    });

    for (const rel of files) {
      it(`${entry.id}: ${rel} has no forbidden content`, () => {
        const abs = path.join(root, rel);
        expect(fs.existsSync(abs)).toBe(true);
        const { bannedMatches } = entry.lint(fs.readFileSync(abs, "utf8"));
        expect(bannedMatches).toEqual([]);
      });
    }
  }
});
