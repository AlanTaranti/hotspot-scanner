import type { ComplexityTrendResult } from "../trend/types.js";
import { COMPLEXITY_TREND_SCHEMA_URL } from "./schema-urls.js";

export function renderTrendJson(result: ComplexityTrendResult): string {
  const payload = {
    $schema: COMPLEXITY_TREND_SCHEMA_URL,
    ...result,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
