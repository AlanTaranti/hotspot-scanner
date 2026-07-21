#!/usr/bin/env node
import { runScan } from "#scan";
const USAGE = "Usage: hotspot-scanner scan <path>";

async function main(): Promise<void> {
  const [, , command, repoPath] = process.argv;

  if (command !== "scan" || !repoPath) {
    console.error(USAGE);
    process.exit(2);
  }

  await runScan({ repoPath });
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
