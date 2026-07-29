#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function git(...args) {
  return execFileSync("git", args, {
    cwd: __dirname,
    encoding: "utf8",
  }).trim();
}

function gitWithDate(date, ...args) {
  return execFileSync("git", args, {
    cwd: __dirname,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
  }).trim();
}

function writeRepoFile(rel, content) {
  const full = join(__dirname, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function commitFile(rel, content, message, date, parent) {
  writeRepoFile(rel, content);
  git("add", rel);
  const args = parent
    ? ["commit", "-m", message, "--allow-empty"]
    : ["commit", "-m", message, "--allow-empty"];
  if (parent) {
    gitWithDate(date, "commit", "-m", message);
  } else {
    gitWithDate(date, "commit", "-m", message);
  }
  return git("rev-parse", "HEAD");
}

if (existsSync(join(__dirname, ".git"))) {
  execFileSync("rm", ["-rf", ".git"], { cwd: __dirname });
}

git("init", "-b", "main");
git("config", "user.email", "fixture@hotspot-scanner.test");
git("config", "user.name", "Fixture Builder");

const file = "src/trend.ts";

writeRepoFile(file, "export const flat = 1;\n");
git("add", file);
gitWithDate("2024-01-01T10:00:00", "commit", "-m", "flat file");

writeRepoFile(
  file,
  `export function one() {
    return 1;
}
`,
);
git("add", file);
gitWithDate("2024-02-01T10:00:00", "commit", "-m", "one level indent");

writeRepoFile(
  file,
  `export function one() {
    if (true) {
        return 1;
    }
    return 0;
}
`,
);
git("add", file);
gitWithDate("2024-03-01T10:00:00", "commit", "-m", "nested indent");

writeRepoFile(
  file,
  `export function one() {
    if (true) {
        if (false) {
            return 2;
        }
        return 1;
    }
    return 0;
}
`,
);
git("add", file);
gitWithDate("2024-04-01T10:00:00", "commit", "-m", "deeper indent");

git("reset", "--hard", "HEAD");
console.log(git("log", "--oneline"));
