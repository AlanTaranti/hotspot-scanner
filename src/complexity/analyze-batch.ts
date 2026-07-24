import { relative, sep } from "node:path";
import type {
  ComplexityResult,
  FunctionComplexityResult,
  ScanWarning,
} from "../types/index.js";
import { analyzeSourceFile } from "./analyze-file.js";
import {
  createTsMorphProject,
  type TsMorphProjectAdapter,
} from "./project.js";

export interface BatchAnalysisInput {
  repoPath: string;
  batch: string[];
}

export interface BatchAnalysisOutput {
  results: ComplexityResult[];
  functions: FunctionComplexityResult[];
  warnings: ScanWarning[];
}

function createParseFailedWarning(
  filePath: string,
  errorMessage: string,
): ScanWarning {
  return {
    code: "PARSE_FAILED",
    severity: "warning",
    message: `Failed to parse ${filePath}: ${errorMessage}`,
  };
}

function normalizeRelativePath(repoPath: string, absolutePath: string): string {
  return relative(repoPath, absolutePath).split(sep).join("/");
}

export async function analyzeBatch(
  input: BatchAnalysisInput,
  project?: TsMorphProjectAdapter,
): Promise<BatchAnalysisOutput> {
  const { repoPath, batch } = input;
  const adapter = project ?? createTsMorphProject({ repoPath });
  const results: ComplexityResult[] = [];
  const functions: FunctionComplexityResult[] = [];
  const warnings: ScanWarning[] = [];
  const sourceFiles = await adapter.loadBatch(batch);

  for (const sourceFile of sourceFiles) {
    const filePath = normalizeRelativePath(repoPath, sourceFile.getFilePath());
    const analysis = analyzeSourceFile(sourceFile, filePath);
    results.push(analysis.file);
    functions.push(...analysis.functions);
  }

  for (const failure of adapter.getParseFailures()) {
    warnings.push(
      createParseFailedWarning(failure.filePath, failure.message),
    );
  }

  return { results, functions, warnings };
}
