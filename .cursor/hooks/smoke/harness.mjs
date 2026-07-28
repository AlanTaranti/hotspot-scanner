/**
 * Shared harness for hooks smoke tests.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
export const hooksDir = path.join(root, ".cursor/hooks");
export const stateDir = path.join(root, ".cursor/hooks-state");

export function runHook(script, input) {
  const result = spawnSync("node", [path.join(hooksDir, script)], {
    input: JSON.stringify(input),
    encoding: "utf8",
    cwd: root,
  });
  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    status: result.status,
  };
}

export function assertIncludes(stdout, needle, label) {
  if (!stdout.includes(needle)) {
    throw new Error(
      `${label}: expected stdout to include ${JSON.stringify(needle)}, got: ${stdout}`,
    );
  }
}

export function cleanupState(id) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const file = path.join(stateDir, `${safe}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function readHooksConfig() {
  return JSON.parse(fs.readFileSync(path.join(root, ".cursor/hooks.json"), "utf8"));
}

/**
 * Create a temporary feature with the given tasks.md Status; returns a cleanup fn.
 */
export function withFeature(slug, status) {
  const featureDir = path.join(root, ".specs/features", slug);
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(
    path.join(featureDir, "tasks.md"),
    `# Smoke\n\n**Status**: \`${status}\`\n\n## Tasks\n\n- T1 placeholder\n`,
  );
  return () => fs.rmSync(featureDir, { recursive: true, force: true });
}
