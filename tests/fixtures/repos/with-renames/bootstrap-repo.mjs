#!/usr/bin/env node
/**
 * Builds with-renames fixture: src/a.ts -> src/b.ts -> src/c.ts
 * Uses content-preserving git mv so find-renames (-M) emits rename metadata.
 * Run: node bootstrap-repo.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function git(...args) {
  return execFileSync("git", args, { cwd: __dirname, encoding: "utf8" }).trim();
}

function gitWithDate(date, ...args) {
  return execFileSync("git", args, {
    cwd: __dirname,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  }).trim();
}

function writeFile(rel, content) {
  const full = join(__dirname, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function stageSrc(...paths) {
  for (const path of paths) {
    git("add", path);
  }
}

function commitStaged(message, date) {
  return gitWithDate(date, "commit", "-m", message);
}

if (existsSync(join(__dirname, ".git"))) {
  execFileSync("rm", ["-rf", ".git"], { cwd: __dirname });
}
rmSync(join(__dirname, "src"), { recursive: true, force: true });

git("init", "-b", "main");
git("config", "user.email", "fixture@hotspot-scanner.test");
git("config", "user.name", "Fixture Builder");

writeFile("src/a.ts", "export const v = 1;\n");
stageSrc("src/a.ts");
commitStaged("add a.ts", "2026-03-01T10:00:00");

writeFile("src/a.ts", "export const v = 2;\n");
stageSrc("src/a.ts");
commitStaged("edit a.ts", "2026-04-01T10:00:00");

gitWithDate("2026-05-01T10:00:00", "mv", "src/a.ts", "src/b.ts");
commitStaged("rename a.ts to b.ts", "2026-05-01T10:00:00");

gitWithDate("2026-06-01T10:00:00", "mv", "src/b.ts", "src/c.ts");
commitStaged("rename b.ts to c.ts", "2026-06-01T10:00:00");

writeFile("src/c.ts", "export const v = 5;\n");
stageSrc("src/c.ts");
commitStaged("edit c.ts", "2026-07-01T10:00:00");

console.log(git("log", "--oneline", "-M", "--numstat"));
