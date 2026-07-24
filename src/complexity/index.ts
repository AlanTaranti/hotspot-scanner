import { stat } from "node:fs/promises";
import type { PathScope } from "../paths/scope.js";
import type {
  ComplexityResult,
  FunctionComplexityResult,
} from "../types/index.js";
import type { BatchAnalysisOutput } from "./analyze-batch.js";
import { discoverSourceFiles } from "./discover.js";
import {
  createWorkerPool,
  DEFAULT_WORKER_CONCURRENCY,
  type WorkerPool,
} from "./pool.js";
import { DEFAULT_BATCH_SIZE } from "./project.js";

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
  createWorkerPool?: typeof createWorkerPool;
  concurrency?: number;
}

export interface ComplexityAnalyzer {
  analyze(
    options: ComplexityAnalyzerOptions,
  ): Promise<ComplexityAnalyzerResult>;
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
    throw new Error(
      `repoPath does not exist or is not accessible: ${repoPath}`,
    );
  }
}

function buildFilePathIndex(filePaths: string[]): Map<string, number> {
  const index = new Map<string, number>();
  for (let fileIndex = 0; fileIndex < filePaths.length; fileIndex += 1) {
    index.set(filePaths[fileIndex]!, fileIndex);
  }
  return index;
}

function parseWarningFilePath(warning: string): string {
  const prefix = "Failed to parse ";
  if (!warning.startsWith(prefix)) {
    return "";
  }
  const rest = warning.slice(prefix.length);
  const colonIndex = rest.indexOf(": ");
  return colonIndex === -1 ? rest : rest.slice(0, colonIndex);
}

function mergeBatchOutputs(
  batchOutputs: BatchAnalysisOutput[],
  filePathIndex: Map<string, number>,
): ComplexityAnalyzerResult {
  const results: ComplexityResult[] = [];
  const functions: FunctionComplexityResult[] = [];
  const warnings: string[] = [];

  for (const output of batchOutputs) {
    results.push(...output.results);
    functions.push(...output.functions);
    warnings.push(...output.warnings);
  }

  const discoveryIndex = (filePath: string): number =>
    filePathIndex.get(filePath) ?? Number.MAX_SAFE_INTEGER;

  results.sort(
    (left, right) =>
      discoveryIndex(left.filePath) - discoveryIndex(right.filePath),
  );

  functions.sort((left, right) => {
    const fileOrder =
      discoveryIndex(left.filePath) - discoveryIndex(right.filePath);
    if (fileOrder !== 0) {
      return fileOrder;
    }
    return left.line - right.line;
  });

  warnings.sort((left, right) => {
    const leftPath = parseWarningFilePath(left);
    const rightPath = parseWarningFilePath(right);
    return discoveryIndex(leftPath) - discoveryIndex(rightPath);
  });

  return { results, functions, warnings };
}

export function createComplexityAnalyzer(
  deps: ComplexityAnalyzerDependencies = {},
): ComplexityAnalyzer {
  const discover = deps.discoverSourceFiles ?? discoverSourceFiles;
  const poolFactory = deps.createWorkerPool ?? createWorkerPool;

  return {
    async analyze({ repoPath, scope }) {
      await validateRepoPath(repoPath);

      const filePaths = await discover(repoPath, scope);
      if (filePaths.length === 0) {
        return { results: [], functions: [], warnings: [] };
      }

      const batches = chunk(filePaths, DEFAULT_BATCH_SIZE);
      const filePathIndex = buildFilePathIndex(filePaths);
      const requestedConcurrency =
        deps.concurrency ?? DEFAULT_WORKER_CONCURRENCY;
      const effectiveConcurrency =
        batches.length <= 1 ? 1 : requestedConcurrency;

      const pool: WorkerPool = poolFactory({
        concurrency: effectiveConcurrency,
      });
      const batchOutputs = await pool.runBatches(repoPath, batches);

      return mergeBatchOutputs(batchOutputs, filePathIndex);
    },
  };
}

export { analyzeBatch } from "./analyze-batch.js";
export {
  createWorkerPool,
  DEFAULT_WORKER_CONCURRENCY,
  type WorkerPool,
} from "./pool.js";
export { discoverSourceFiles, ELIGIBLE_EXTENSIONS } from "./discover.js";
export { createTsMorphProject, DEFAULT_BATCH_SIZE } from "./project.js";
export { analyzeSourceFile } from "./analyze-file.js";
export { complexityForFunction, countDecisionNodes } from "./mccabe.js";
