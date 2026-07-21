import type { CoChangeEvent, FileChangeStats } from "../types/index.js";

export interface GitMinerOptions {
  repoPath: string;
  since?: string;
}

export interface GitMinerResult {
  fileStats: Map<string, FileChangeStats>;
  coChangeEvents: CoChangeEvent[];
}

export interface GitMiner {
  mine(options: GitMinerOptions): Promise<GitMinerResult>;
}

export function createGitMiner(): GitMiner {
  throw new Error("GitMiner not implemented — see Milestone 2");
}
