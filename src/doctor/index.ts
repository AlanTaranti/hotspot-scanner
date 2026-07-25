import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConfigError,
  HOTSPOT_SCANNER_CONFIG_FILENAME,
  loadHotspotScannerConfig,
} from "../config/load-config.js";
import { validateGitRepository } from "../scan.js";

export type DoctorFindingId =
  | "node-engines"
  | "git-path"
  | "git-repo"
  | "config"
  | "tsconfig";

export type DoctorFindingStatus = "pass" | "warn" | "fail";

export interface DoctorFinding {
  id: DoctorFindingId;
  status: DoctorFindingStatus;
  message: string;
}

export interface DoctorResult {
  findings: DoctorFinding[];
  exitCode: 0 | 1 | 2;
}

export interface RunDoctorOptions {
  targetPath: string;
  configPath?: string;
  enginesNode?: string;
  nodeVersion?: string;
}

const TSCONFIG_NAMES = ["tsconfig.json", "jsconfig.json"] as const;

let cachedEnginesNode: string | undefined;

async function readDefaultEnginesNode(): Promise<string> {
  if (cachedEnginesNode !== undefined) {
    return cachedEnginesNode;
  }

  const packageJsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../package.json",
  );
  const raw = await readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { engines?: { node?: string } };
  cachedEnginesNode = parsed.engines?.node ?? ">=22";
  return cachedEnginesNode;
}

export function parseNodeMajor(version: string): number {
  const match = version.replace(/^v/, "").match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function satisfiesEnginesNode(
  enginesNode: string,
  nodeVersion: string,
): boolean {
  const major = parseNodeMajor(nodeVersion);
  const geMatch = enginesNode.trim().match(/^>=\s*(\d+)/);
  if (geMatch) {
    return major >= Number.parseInt(geMatch[1], 10);
  }
  return false;
}

export function isGitOnPath(): boolean {
  const result = spawnSync("git", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0;
}

async function validateTargetPath(
  targetPath: string,
): Promise<{ ok: true; resolvedPath: string } | { ok: false; message: string }> {
  try {
    const resolvedPath = resolve(targetPath);
    const targetStat = await stat(resolvedPath);
    if (!targetStat.isDirectory()) {
      return {
        ok: false,
        message: `Target path is not a directory: ${resolvedPath}`,
      };
    }
    return { ok: true, resolvedPath };
  } catch {
    return {
      ok: false,
      message: `Target path does not exist or is not accessible: ${resolve(targetPath)}`,
    };
  }
}

async function findDiscoveredConfigPath(
  repoPath: string,
): Promise<string | null> {
  let dir = resolve(repoPath);
  while (true) {
    const candidatePath = join(dir, HOTSPOT_SCANNER_CONFIG_FILENAME);
    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      // continue walk
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export function findNearestTsConfigPath(targetPath: string): string | null {
  let dir = resolve(targetPath);
  while (true) {
    for (const configName of TSCONFIG_NAMES) {
      const candidate = join(dir, configName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

export function aggregateExitCode(
  findings: DoctorFinding[],
): 0 | 1 | 2 {
  const failures = findings.filter((finding) => finding.status === "fail");
  if (failures.length === 0) {
    return 0;
  }

  const hasNonConfigFailure = failures.some(
    (finding) => finding.id !== "config",
  );
  return hasNonConfigFailure ? 1 : 2;
}

async function checkConfig(
  resolvedPath: string,
  configPath: string | undefined,
): Promise<DoctorFinding> {
  try {
    if (configPath) {
      await loadHotspotScannerConfig(resolvedPath, { configPath });
      return {
        id: "config",
        status: "pass",
        message: `Config file is valid: ${resolve(configPath)}`,
      };
    }

    const config = await loadHotspotScannerConfig(resolvedPath);
    if (config === null) {
      return {
        id: "config",
        status: "warn",
        message: `No ${HOTSPOT_SCANNER_CONFIG_FILENAME} found; scan will use CLI flags and defaults`,
      };
    }

    const discoveredPath = await findDiscoveredConfigPath(resolvedPath);
    return {
      id: "config",
      status: "pass",
      message: `Config file is valid: ${discoveredPath ?? HOTSPOT_SCANNER_CONFIG_FILENAME}`,
    };
  } catch (error) {
    const message =
      error instanceof ConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      id: "config",
      status: "fail",
      message,
    };
  }
}

function checkTsConfig(resolvedPath: string): DoctorFinding {
  const tsConfigPath = findNearestTsConfigPath(resolvedPath);
  if (tsConfigPath) {
    return {
      id: "tsconfig",
      status: "pass",
      message: `TypeScript/JavaScript config found: ${tsConfigPath}`,
    };
  }

  return {
    id: "tsconfig",
    status: "warn",
    message:
      "No tsconfig.json or jsconfig.json found under the target path (informational)",
  };
}

export async function runDoctor(
  options: RunDoctorOptions,
): Promise<DoctorResult> {
  const findings: DoctorFinding[] = [];
  const enginesNode =
    options.enginesNode ?? (await readDefaultEnginesNode());
  const nodeVersion = options.nodeVersion ?? process.version;

  if (satisfiesEnginesNode(enginesNode, nodeVersion)) {
    findings.push({
      id: "node-engines",
      status: "pass",
      message: `Node ${nodeVersion} satisfies engines.node (${enginesNode})`,
    });
  } else {
    findings.push({
      id: "node-engines",
      status: "fail",
      message: `Node ${nodeVersion} does not satisfy engines.node (${enginesNode})`,
    });
  }

  if (isGitOnPath()) {
    findings.push({
      id: "git-path",
      status: "pass",
      message: "git is available on PATH",
    });
  } else {
    findings.push({
      id: "git-path",
      status: "fail",
      message: "git executable not found on PATH",
    });
  }

  const targetValidation = await validateTargetPath(options.targetPath);
  let resolvedPath: string | undefined;
  if (!targetValidation.ok) {
    findings.push({
      id: "git-repo",
      status: "fail",
      message: targetValidation.message,
    });
  } else {
    resolvedPath = targetValidation.resolvedPath;
    try {
      await validateGitRepository(resolvedPath);
      findings.push({
        id: "git-repo",
        status: "pass",
        message: `Git repository: ${resolvedPath}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      findings.push({
        id: "git-repo",
        status: "fail",
        message,
      });
    }
  }

  if (resolvedPath) {
    findings.push(await checkConfig(resolvedPath, options.configPath));
    findings.push(checkTsConfig(resolvedPath));
  }

  return {
    findings,
    exitCode: aggregateExitCode(findings),
  };
}
