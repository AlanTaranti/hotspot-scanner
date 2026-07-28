/**
 * If dist outputs are missing but incremental cache remains, plain/composite tsc
 * no-ops (exit 0) and the bin project then fails with TS6305.
 * Invalidate the cache so the next build actually emits.
 */
import { existsSync, unlinkSync } from "node:fs";

const BUILDINFO = "tsconfig.tsbuildinfo";
const CANARY = "dist/index.js";

if (!existsSync(CANARY) && existsSync(BUILDINFO)) {
  unlinkSync(BUILDINFO);
}
