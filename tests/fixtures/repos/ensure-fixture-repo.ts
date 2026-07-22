import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function ensureFixtureRepo(fixturePath: string): void {
  if (!existsSync(join(fixturePath, ".git"))) {
    execFileSync("node", ["bootstrap-repo.mjs"], { cwd: fixturePath });
  }
}
