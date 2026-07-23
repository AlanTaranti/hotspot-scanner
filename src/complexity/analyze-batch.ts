import { relative, sep } from "node:path";
import type {
  ComplexityResult,
  FunctionComplexityResult,
} from "../types/index.js";
import { analyzeSourceFile } from "./analyze-file.js";
import { createTsMorphProject } from "./project.js";

export interface BatchAnalysisInput {
  repoPath: string;
  batch: string[];
}

export interface BatchAnalysisOutput {
  results: ComplexityResult[];
  functions: FunctionComplexityResult[];
  warnings: string[];
}

function normalizeRelativePath(repoPath: string, absolutePath: string): string {
  return relative(repoPath, absolutePath).split(sep).join("/");
}

export async function analyzeBatch(
  input: BatchAnalysisInput,
): Promise<BatchAnalysisOutput> {
  const { repoPath, batch } = input;
  const project = createTsMorphProject({ repoPath });
  const results: ComplexityResult[] = [];
  const functions: FunctionComplexityResult[] = [];
  const warnings: string[] = [];
  const sourceFiles = await project.loadBatch(batch);

  for (const sourceFile of sourceFiles) {
    const filePath = normalizeRelativePath(repoPath, sourceFile.getFilePath());
    const analysis = analyzeSourceFile(sourceFile, filePath);
    results.push(analysis.file);
    functions.push(...analysis.functions);
  }

  for (const failure of project.getParseFailures()) {
    warnings.push(`Failed to parse ${failure.filePath}: ${failure.message}`);
  }

  return { results, functions, warnings };
}
