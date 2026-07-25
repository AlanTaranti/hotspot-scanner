#!/usr/bin/env node
/**
 * Wall-clock benchmark harness for hotspot-scanner scan.
 * Not part of CI / pnpm test (HOTSPOT-725).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const ELIGIBLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, "..");
const defaultCli = join(projectRoot, "dist/bin/hotspot-scanner.js");
const defaultRepo = join(projectRoot, "tests/fixtures/repos/small-ts");

function printHelp() {
  process.stdout.write(`Usage: pnpm bench [--] [options]

Run scan wall-clock benchmark (requires pnpm build).

Options:
  --repo <path>       Repository to scan (default: tests/fixtures/repos/small-ts)
  --since <expr>      Git since window (default: "12 months ago")
  --sequential        Run with --sequential only (no overlap A/B)
  --compare-modes     Run default overlap then --sequential (A/B)
  --help              Show this help

Output lines: mode=<overlap|sequential> wall_ms=<n> commits=<n> files=<n>

Not part of CI or pnpm test. No duration fail policy.
`);
}

function parseArgs(argv) {
  const cleaned = argv[0] === "--" ? argv.slice(1) : argv;
  const args = {
    repo: defaultRepo,
    since: "12 months ago",
    sequentialOnly: false,
    compareModes: false,
    help: false,
  };

  for (let i = 0; i < cleaned.length; i++) {
    const arg = cleaned[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--repo") {
      const value = cleaned[++i];
      if (!value) {
        console.error("--repo requires a path");
        process.exit(1);
      }
      args.repo = resolve(value);
    } else if (arg === "--since") {
      const value = cleaned[++i];
      if (!value) {
        console.error("--since requires a value");
        process.exit(1);
      }
      args.since = value;
    } else if (arg === "--sequential") {
      args.sequentialOnly = true;
    } else if (arg === "--compare-modes") {
      args.compareModes = true;
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  if (args.sequentialOnly && args.compareModes) {
    console.error("Use either --sequential or --compare-modes, not both.");
    process.exit(1);
  }

  return args;
}

function runGit(repo, gitArgs) {
  return spawnSync("git", ["-C", repo, ...gitArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function countCommits(repo, since) {
  const gitArgs = ["rev-list", "--count", "HEAD"];
  if (since) gitArgs.push(`--since=${since}`);
  const result = runGit(repo, gitArgs);
  if (result.status !== 0) return null;
  const n = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function hasEligibleExtension(filePath) {
  return ELIGIBLE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

function countEligibleFiles(repo) {
  const result = runGit(repo, ["ls-files", "-z"]);
  if (result.status !== 0) return null;
  const paths = result.stdout.split("\0").filter(Boolean);
  return paths.filter(hasEligibleExtension).length;
}

function runScan({ repo, since, sequential }) {
  const scanArgs = [
    "exec",
    "hotspot-scanner",
    "scan",
    repo,
    "--format",
    "json",
    "--quiet",
    "--since",
    since,
  ];
  if (sequential) scanArgs.push("--sequential");

  const start = performance.now();
  const result = spawnSync("pnpm", scanArgs, {
    encoding: "utf8",
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 100 * 1024 * 1024,
  });
  const wallMs = Math.round(performance.now() - start);

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "scan failed\n");
    process.exit(result.status ?? 1);
  }

  return { wallMs };
}

function printRow({ mode, wallMs, commits, files }) {
  console.log(
    `mode=${mode} wall_ms=${wallMs} commits=${commits ?? "n/a"} files=${files ?? "n/a"}`,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!existsSync(defaultCli)) {
    console.error(`Built CLI not found at ${defaultCli}. Run: pnpm build`);
    process.exit(1);
  }

  if (!existsSync(args.repo)) {
    console.error(`Repository not found: ${args.repo}`);
    process.exit(1);
  }

  const commits = countCommits(args.repo, args.since);
  const files = countEligibleFiles(args.repo);

  const modes = args.compareModes
    ? [
        { mode: "overlap", sequential: false },
        { mode: "sequential", sequential: true },
      ]
    : args.sequentialOnly
      ? [{ mode: "sequential", sequential: true }]
      : [{ mode: "overlap", sequential: false }];

  for (const { mode, sequential } of modes) {
    const { wallMs } = runScan({
      repo: args.repo,
      since: args.since,
      sequential,
    });
    printRow({ mode, wallMs, commits, files });
  }
}

main();
