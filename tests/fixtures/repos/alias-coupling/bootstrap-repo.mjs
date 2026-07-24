#!/usr/bin/env node
/**
 * Builds alias-coupling fixture: consumer imports provider via tsconfig paths alias.
 * Co-change history mirrors small-ts (consumer↔provider linked, consumer↔orphan not).
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

const tsconfig = JSON.stringify(
  {
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "@app/*": ["src/*"],
      },
    },
  },
  null,
  2,
);

let orphanTs = `export function orphan(): number {
  return 1;
}
`;

let providerTs = `export function provide(): number {
  return 42;
}
`;

let consumerTs = `import { provide } from "@app/provider";

export function consume(): number {
  return provide();
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
  createTree({ "tsconfig.json": tsconfig, "src/orphan.ts": orphanTs }),
  "add orphan.ts and tsconfig",
  null,
  "2026-02-01T10:00:00",
);

parent = createRef(
  createTree({
    "tsconfig.json": tsconfig,
    "src/orphan.ts": orphanTs,
    "src/provider.ts": providerTs,
  }),
  "add provider.ts",
  parent,
  "2026-02-15T10:00:00",
);

parent = createRef(
  createTree({
    "tsconfig.json": tsconfig,
    "src/orphan.ts": orphanTs,
    "src/provider.ts": providerTs,
    "src/consumer.ts": consumerTs,
  }),
  "add consumer.ts with alias import",
  parent,
  "2026-03-01T10:00:00",
);

for (let i = 1; i <= 3; i++) {
  consumerTs += `\n// co-change ${i}\n`;
  const providerWithCochange = providerTs + `\n// co-change ${i}\n`;
  parent = createRef(
    createTree({
      "tsconfig.json": tsconfig,
      "src/orphan.ts": orphanTs,
      "src/provider.ts": providerWithCochange,
      "src/consumer.ts": consumerTs,
    }),
    `co-change consumer and provider (${i})`,
    parent,
    `2026-0${3 + i}-01T10:00:00`,
  );
  providerTs = providerWithCochange;
}

for (let i = 1; i <= 3; i++) {
  const orphanWithCochange = orphanTs + `\n// consumer-orphan co-change ${i}\n`;
  const consumerWithOrphanCochange =
    consumerTs + `\n// consumer-orphan co-change ${i}\n`;
  parent = createRef(
    createTree({
      "tsconfig.json": tsconfig,
      "src/orphan.ts": orphanWithCochange,
      "src/provider.ts": providerTs,
      "src/consumer.ts": consumerWithOrphanCochange,
    }),
    `co-change consumer and orphan (${i})`,
    parent,
    `2026-0${6 + i}-01T10:00:00`,
  );
  orphanTs = orphanWithCochange;
  consumerTs = consumerWithOrphanCochange;
}

consumerTs += "\n// extra churn on consumer\n";
parent = createRef(
  createTree({
    "tsconfig.json": tsconfig,
    "src/orphan.ts": orphanTs,
    "src/provider.ts": providerTs,
    "src/consumer.ts": consumerTs,
  }),
  "churn consumer only",
  parent,
  "2026-07-01T10:00:00",
);

git("reset", "--hard", "HEAD");
console.log(git("log", "--oneline"));
