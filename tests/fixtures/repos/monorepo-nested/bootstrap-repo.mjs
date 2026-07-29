#!/usr/bin/env node
/**
 * Builds monorepo-nested fixture: git root with packages/api and packages/other.
 * Run: node bootstrap-repo.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

function readRepoFile(rel) {
  return readFileSync(join(__dirname, rel), "utf8");
}

function writeRepoFile(rel, content) {
  const full = join(__dirname, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function commitFiles(files, message, parent, date) {
  for (const [path, content] of Object.entries(files)) {
    writeRepoFile(path, content);
    git("add", path);
  }
  const tree = git("write-tree");
  const hash = parent
    ? gitWithDate(date, "commit-tree", tree, "-p", parent, "-m", message)
    : gitWithDate(date, "commit-tree", tree, "-m", message);
  git("update-ref", "refs/heads/main", hash);
  return hash;
}

const lowTs = readRepoFile("packages/api/src/low.ts");
const mediumTs = readRepoFile("packages/api/src/medium.ts");
const highTs = readRepoFile("packages/api/src/high.ts");
const otherTs = readRepoFile("packages/other/src/other.ts");

if (existsSync(join(__dirname, ".git"))) {
  execFileSync("rm", ["-rf", ".git"], { cwd: __dirname });
}

git("init", "-b", "main");
git("config", "user.email", "fixture@hotspot-scanner.test");
git("config", "user.name", "Fixture Builder");

let main = commitFiles(
  {
    "packages/api/src/low.ts": lowTs,
    "packages/other/src/other.ts": otherTs,
  },
  "init api and other packages",
  null,
  "2026-02-01T19:26:30",
);

main = commitFiles(
  {
    "packages/api/src/low.ts": lowTs,
    "packages/api/src/medium.ts": mediumTs,
    "packages/other/src/other.ts": otherTs,
  },
  "add api medium.ts",
  main,
  "2026-02-15T23:27:15",
);

main = commitFiles(
  {
    "packages/api/src/high.ts": highTs,
    "packages/api/src/low.ts": lowTs,
    "packages/api/src/medium.ts": mediumTs,
    "packages/other/src/other.ts": otherTs,
  },
  "add api high.ts",
  main,
  "2026-03-01T21:28:00",
);

let highMutable = highTs;
let mediumMutable = mediumTs;
for (let i = 1; i <= 3; i++) {
  highMutable += `\n// api co-change ${i}\n`;
  mediumMutable += `\n// api co-change ${i}\n`;
  main = commitFiles(
    {
      "packages/api/src/high.ts": highMutable,
      "packages/api/src/low.ts": lowTs,
      "packages/api/src/medium.ts": mediumMutable,
      "packages/other/src/other.ts": otherTs,
    },
    `api co-change high and medium (${i})`,
    main,
    `2026-0${3 + i}-01T10:00:00`,
  );
}

let otherMutable = otherTs;
for (let i = 1; i <= 2; i++) {
  otherMutable += `\n// other churn ${i}\n`;
  main = commitFiles(
    {
      "packages/api/src/high.ts": highMutable,
      "packages/api/src/low.ts": lowTs,
      "packages/api/src/medium.ts": mediumMutable,
      "packages/other/src/other.ts": otherMutable,
    },
    `other package churn (${i})`,
    main,
    i === 1 ? "2026-07-01T19:02:44" : "2026-08-01T22:35:13",
  );
}

highMutable += "\n// extra churn on api high\n";
main = commitFiles(
  {
    "packages/api/src/high.ts": highMutable,
    "packages/api/src/low.ts": lowTs,
    "packages/api/src/medium.ts": mediumMutable,
    "packages/other/src/other.ts": otherMutable,
  },
  "api high only churn",
  main,
  "2026-07-01T20:35:58",
);

git("reset", "--hard", "HEAD");
console.log(git("log", "--oneline"));
