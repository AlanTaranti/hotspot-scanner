import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ComplexityResult, ScanWarning } from "../types/index.js";
import { analyzeSourceFile } from "./analyze-file.js";

export const DEFAULT_BATCH_SIZE = 50;

export interface BatchAnalysisInput {
  repoPath: string;
  batch: string[];
}

export interface BatchAnalysisOutput {
  results: ComplexityResult[];
  warnings: ScanWarning[];
}

function createReadFailedWarning(
  filePath: string,
  errorMessage: string,
): ScanWarning {
  return {
    code: "READ_FAILED",
    severity: "warning",
    message: `Failed to read ${filePath}: ${errorMessage}`,
  };
}

export async function analyzeBatch(
  input: BatchAnalysisInput,
): Promise<BatchAnalysisOutput> {
  const { repoPath, batch } = input;
  const results: ComplexityResult[] = [];
  const warnings: ScanWarning[] = [];

  for (const relativePath of batch) {
    const absolutePath = join(repoPath, relativePath);
    let source: string;
    try {
      source = await readFile(absolutePath, "utf8");
    } catch (error) {
      warnings.push(createReadFailedWarning(relativePath, String(error)));
      continue;
    }

    results.push(analyzeSourceFile(source, relativePath));
  }

  return { results, warnings };
}
