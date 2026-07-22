#!/usr/bin/env node
/**
 * Builds merge-heavy fixture: feature branch merge + file delete
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
    if (content === null) {
      try {
        git("rm", path);
      } catch {
        // file may not exist in index
      }
    } else {
      writeFile(path, content);
      git("add", path);
    }
  }
  const tree = git("write-tree");
  const hash = parent
    ? gitWithDate(date, "commit-tree", tree, "-p", parent, "-m", message)
    : gitWithDate(date, "commit-tree", tree, "-m", message);
  git("update-ref", "refs/heads/main", hash);
  return hash;
}

if (existsSync(join(__dirname, ".git"))) {
  execFileSync("rm", ["-rf", ".git"], { cwd: __dirname });
}

git("init", "-b", "main");
git("config", "user.email", "fixture@hotspot-scanner.test");
git("config", "user.name", "Fixture Builder");

let main = commitFiles(
  {
    "src/keep.ts": "export const keep = 1;\n",
    "src/remove.ts": "export const remove = 1;\n",
  },
  "initial files",
  null,
  "2026-02-01T10:00:00",
);

main = commitFiles(
  { "src/keep.ts": "export const keep = 2;\n" },
  "update keep",
  main,
  "2026-03-01T10:00:00",
);

// feature branch
git("update-ref", "refs/heads/feature", main);
let feature = commitFiles(
  { "src/feature.ts": "export const feature = 1;\n" },
  "feature work",
  main,
  "2026-04-01T10:00:00",
);

// merge feature into main (merge commit with two parents)
writeFile("src/feature.ts", "export const feature = 1;\n");
git("add", "src/feature.ts");
const featureTree = git("write-tree");
const mergeHash = gitWithDate(
  "2026-05-01T10:00:00",
  "commit-tree",
  featureTree,
  "-p",
  main,
  "-p",
  feature,
  "-m",
  "merge feature",
);
git("update-ref", "refs/heads/main", mergeHash);
main = mergeHash;

main = commitFiles(
  { "src/remove.ts": null, "src/keep.ts": "export const keep = 3;\n" },
  "delete remove.ts",
  main,
  "2026-06-01T10:00:00",
);

git("reset", "--hard", "HEAD");
console.log(git("log", "--oneline", "--graph"));
