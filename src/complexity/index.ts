import { stat } from "node:fs/promises";
import { relative, sep } from "node:path";
import type { PathScope } from "../paths/scope.js";
import type {
  ComplexityResult,
  FunctionComplexityResult,
} from "../types/index.js";
import { analyzeSourceFile } from "./analyze-file.js";
import { discoverSourceFiles } from "./discover.js";
import {
  createTsMorphProject,
  DEFAULT_BATCH_SIZE,
  type TsMorphProjectAdapter,
} from "./project.js";

export interface ComplexityAnalyzerOptions {
  repoPath: string;
  scope?: PathScope;
}

export interface ComplexityAnalyzerResult {
  results: ComplexityResult[];
  functions: FunctionComplexityResult[];
  warnings: string[];
}

export interface ComplexityAnalyzerDependencies {
  discoverSourceFiles?: typeof discoverSourceFiles;
  createTsMorphProject?: typeof createTsMorphProject;
}

export interface ComplexityAnalyzer {
  analyze(options: ComplexityAnalyzerOptions): Promise<ComplexityAnalyzerResult>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function validateRepoPath(repoPath: string): Promise<void> {
  try {
    const repoStat = await stat(repoPath);
    if (!repoStat.isDirectory()) {
      throw new Error(`repoPath is not a directory: ${repoPath}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("repoPath")) {
      throw error;
    }
    throw new Error(`repoPath does not exist or is not accessible: ${repoPath}`);
  }
}

function normalizeRelativePath(repoPath: string, absolutePath: string): string {
  return relative(repoPath, absolutePath).split(sep).join("/");
}

async function analyzeBatch(
  project: TsMorphProjectAdapter,
  repoPath: string,
  batch: string[],
): Promise<{
  results: ComplexityResult[];
  functions: FunctionComplexityResult[];
  warnings: string[];
}> {
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

export function createComplexityAnalyzer(
  deps: ComplexityAnalyzerDependencies = {},
): ComplexityAnalyzer {
  const discover = deps.discoverSourceFiles ?? discoverSourceFiles;
  const createProject = deps.createTsMorphProject ?? createTsMorphProject;

  return {
    async analyze({ repoPath, scope }) {
      await validateRepoPath(repoPath);

      const filePaths = await discover(repoPath, scope);
      const project = createProject({ repoPath });
      const results: ComplexityResult[] = [];
      const functions: FunctionComplexityResult[] = [];
      const warnings: string[] = [];

      for (const batch of chunk(filePaths, DEFAULT_BATCH_SIZE)) {
        const batchResult = await analyzeBatch(project, repoPath, batch);
        results.push(...batchResult.results);
        functions.push(...batchResult.functions);
        warnings.push(...batchResult.warnings);
      }

      return { results, functions, warnings };
    },
  };
}

export { discoverSourceFiles, ELIGIBLE_EXTENSIONS } from "./discover.js";
export { createTsMorphProject, DEFAULT_BATCH_SIZE } from "./project.js";
export { analyzeSourceFile } from "./analyze-file.js";
export { complexityForFunction, countDecisionNodes } from "./mccabe.js";
