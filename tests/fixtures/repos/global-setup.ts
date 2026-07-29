import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureFixtureRepo } from "./ensure-fixture-repo.js";

const reposDir = dirname(fileURLToPath(import.meta.url));

export default function globalSetup(): void {
  ensureFixtureRepo(join(reposDir, "small-ts"));
  ensureFixtureRepo(join(reposDir, "merge-heavy"));
  ensureFixtureRepo(join(reposDir, "with-renames"));
  ensureFixtureRepo(join(reposDir, "monorepo-nested"));
  ensureFixtureRepo(join(reposDir, "trend-indent"));
}
