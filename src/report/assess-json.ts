import type { AssessResult } from "../assess/types.js";
import { HOTSPOT_ASSESS_SCHEMA_URL } from "./schema-urls.js";

export function renderAssessJson(result: AssessResult): string {
  const payload = {
    $schema: HOTSPOT_ASSESS_SCHEMA_URL,
    ...result,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
