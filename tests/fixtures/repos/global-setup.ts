import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureFixtureRepo } from "./ensure-fixture-repo.js";

const reposDir = dirname(fileURLToPath(import.meta.url));

export default function globalSetup(): void {
  ensureFixtureRepo(join(reposDir, "small-ts"));
}
