#!/usr/bin/env node
/**
 * Builds with-renames fixture: src/a.ts -> src/b.ts -> src/c.ts
 * Run: node bootstrap-repo.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
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

function commitFiles(files, message, parent, date) {
  for (const [path, content] of Object.entries(files)) {
    writeFile(path, content);
    git("add", path);
  }
  const tree = git("write-tree");
  const hash = parent
    ? gitWithDate(date, "commit-tree", tree, "-p", parent, "-m", message)
    : gitWithDate(date, "commit-tree", tree, "-m", message);
  git("update-ref", "refs/heads/main", hash);
  return hash;
}

function renameInTree(from, to, content, message, parent, date) {
  writeFile(to, content);
  git("rm", from);
  git("add", to);
  const tree = git("write-tree");
  const hash = gitWithDate(
    date,
    "commit-tree",
    tree,
    "-p",
    parent,
    "-m",
    message,
  );
  git("update-ref", "refs/heads/main", hash);
  return hash;
}

if (existsSync(join(__dirname, ".git"))) {
  execFileSync("rm", ["-rf", ".git"], { cwd: __dirname });
}

git("init", "-b", "main");
git("config", "user.email", "fixture@hotspot-scanner.test");
git("config", "user.name", "Fixture Builder");

let parent = commitFiles(
  { "src/a.ts": "export const v = 1;\n" },
  "add a.ts",
  null,
  "2026-03-01T10:00:00",
);

parent = commitFiles(
  { "src/a.ts": "export const v = 2;\n" },
  "edit a.ts",
  parent,
  "2026-04-01T10:00:00",
);

parent = renameInTree(
  "src/a.ts",
  "src/b.ts",
  "export const v = 3;\n",
  "rename a.ts to b.ts",
  parent,
  "2026-05-01T10:00:00",
);

parent = renameInTree(
  "src/b.ts",
  "src/c.ts",
  "export const v = 4;\n",
  "rename b.ts to c.ts",
  parent,
  "2026-06-01T10:00:00",
);

parent = commitFiles(
  { "src/c.ts": "export const v = 5;\n" },
  "edit c.ts",
  parent,
  "2026-07-01T10:00:00",
);

git("reset", "--hard", "HEAD");
console.log(git("log", "--oneline"));
