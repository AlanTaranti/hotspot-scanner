import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedPackageVersion: string | undefined;

/** Sync cached read of package.json "version" for meta emission. */
export function getPackageVersion(): string {
  if (cachedPackageVersion !== undefined) {
    return cachedPackageVersion;
  }

  const packageJsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../package.json",
  );
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  const version = parsed.version;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`package.json at ${packageJsonPath} is missing a non-empty "version"`);
  }
  cachedPackageVersion = version;
  return cachedPackageVersion;
}
