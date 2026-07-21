import type { ComplexityResult } from "../types/index.js";

export interface ComplexityAnalyzerOptions {
  repoPath: string;
}

export interface ComplexityAnalyzer {
  analyze(options: ComplexityAnalyzerOptions): Promise<ComplexityResult[]>;
}

export function createComplexityAnalyzer(): ComplexityAnalyzer {
  throw new Error("ComplexityAnalyzer not implemented — see Milestone 3");
}
