import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const compiledCli = join(repoRoot, "dist/bin/hotspot-scanner.js");

function assertCompiledCliExists(): void {
  if (!existsSync(compiledCli)) {
    throw new Error(
      `Compiled CLI not found at ${compiledCli}. Run pnpm build before pnpm test.`,
    );
  }
}

async function runCompiledHelp(subcommand: string): Promise<string> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [compiledCli, subcommand, "--help"],
    { cwd: repoRoot },
  );
  return stdout;
}

describe("compiled CLI smoke", () => {
  it("loads trend --help via dist/bin (exercises #trend)", async () => {
    assertCompiledCliExists();
    const stdout = await runCompiledHelp("trend");
    expect(stdout).toContain("indentation complexity");
    expect(stdout).toContain("meta.metricLegend");
  });

  it("loads scan --help via dist/bin (exercises #scan)", async () => {
    assertCompiledCliExists();
    const stdout = await runCompiledHelp("scan");
    expect(stdout).toContain("hotspot analysis");
  });

  it("loads doctor --help via dist/bin (exercises #doctor)", async () => {
    assertCompiledCliExists();
    const stdout = await runCompiledHelp("doctor");
    expect(stdout.length).toBeGreaterThan(0);
  });
});
