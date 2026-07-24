#!/usr/bin/env node
/**
 * Builds the small-ts fixture Git history using plumbing commands.
 * Run: node bootstrap-repo.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function git(...args) {
  return execFileSync("git", args, {
    cwd: __dirname,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: args.envDate ?? process.env.GIT_AUTHOR_DATE,
      GIT_COMMITTER_DATE: args.envDate ?? process.env.GIT_COMMITTER_DATE,
    },
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

function writeFile(rel, content) {
  const full = join(__dirname, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function createTree(files) {
  for (const [path, content] of Object.entries(files)) {
    writeFile(path, content);
    git("add", path);
  }
  return git("write-tree");
}

function createRef(tree, message, parent, date) {
  const args = parent
    ? ["commit-tree", tree, "-p", parent, "-m", message]
    : ["commit-tree", tree, "-m", message];
  const hash = gitWithDate(date, ...args);
  git("update-ref", "refs/heads/main", hash);
  return hash;
}

const lowTs = `export function low(): number {
  return 1;
}
`;

let lowTsMutable = lowTs;

let mediumTs = `export function medium(value: number): number {
  if (value > 0) {
    return value * 2;
  }
  if (value < 0) {
    return -value;
  }
  return 0;
}
`;

let highTs = `import { medium } from "./medium";

export function high(a: number, b: number, c: number): number {
  if (a > 0) {
    if (b > 0) {
      for (let i = 0; i < a; i++) {
        if (c > i) {
          b += i;
        }
      }
    } else if (b < 0) {
      while (b < 0) {
        b++;
      }
    }
  } else if (a < 0) {
    switch (c) {
      case 1:
        return a + b;
      case 2:
        return a - b;
      default:
        return a * b;
    }
  }
  return a && b ? a + b : (c ?? medium(0));
}
`;

if (existsSync(join(__dirname, ".git"))) {
  execFileSync("rm", ["-rf", ".git"], { cwd: __dirname });
}

git("init", "-b", "main");
git("config", "user.email", "fixture@hotspot-scanner.test");
git("config", "user.name", "Fixture Builder");

let parent;
parent = createRef(
  createTree({ "src/low.ts": lowTs }),
  "add low.ts",
  null,
  "2026-02-01T10:00:00",
);

parent = createRef(
  createTree({ "src/low.ts": lowTsMutable, "src/medium.ts": mediumTs }),
  "add medium.ts",
  parent,
  "2026-02-15T10:00:00",
);

parent = createRef(
  createTree({
    "src/low.ts": lowTsMutable,
    "src/medium.ts": mediumTs,
    "src/high.ts": highTs,
  }),
  "add high.ts",
  parent,
  "2026-03-01T10:00:00",
);

for (let i = 1; i <= 3; i++) {
  highTs += `\n// co-change ${i}\n`;
  const mediumWithCochange = mediumTs + `\n// co-change ${i}\n`;
  parent = createRef(
    createTree({
      "src/low.ts": lowTsMutable,
      "src/medium.ts": mediumWithCochange,
      "src/high.ts": highTs,
    }),
    `co-change high and medium (${i})`,
    parent,
    `2026-0${3 + i}-01T10:00:00`,
  );
  mediumTs = mediumWithCochange;
}

for (let i = 1; i <= 3; i++) {
  const lowWithCochange = lowTsMutable + `\n// medium-low co-change ${i}\n`;
  const mediumWithLowCochange = mediumTs + `\n// medium-low co-change ${i}\n`;
  parent = createRef(
    createTree({
      "src/low.ts": lowWithCochange,
      "src/medium.ts": mediumWithLowCochange,
      "src/high.ts": highTs,
    }),
    `co-change medium and low (${i})`,
    parent,
    `2026-0${6 + i}-01T10:00:00`,
  );
  lowTsMutable = lowWithCochange;
  mediumTs = mediumWithLowCochange;
}

highTs += "\n// extra churn on high\n";
parent = createRef(
  createTree({
    "src/low.ts": lowTsMutable,
    "src/medium.ts": mediumTs,
    "src/high.ts": highTs,
  }),
  "churn high only",
  parent,
  "2026-07-01T10:00:00",
);

git("reset", "--hard", "HEAD");
console.log(git("log", "--oneline"));
