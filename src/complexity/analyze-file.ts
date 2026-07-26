import type { ComplexityResult } from "../types/index.js";
import { countNcloc } from "./ncloc.js";

export function analyzeSourceFile(
  source: string,
  filePath: string,
): ComplexityResult {
  return {
    filePath,
    ncloc: countNcloc(source),
  };
}
