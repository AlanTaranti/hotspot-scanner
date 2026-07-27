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
import { resolveMonorepoScanPath } from "../paths/index.js";
import {
  previewScanScope,
  type ScanScopePreview,
} from "../scan-preview.js";
import { probeSinceWindow } from "../git/probe-since.js";
import {
  resolveScanPipelineContext,
  validateGitRepository,
  type ScanPipelineContext,
} from "../scan.js";
import type { ScanOptions, ScanWarning } from "../types/index.js";

export type DoctorFindingId =
  | "node-engines"
  | "git-path"
  | "git-repo"
  | "config"
  | "since"
  | "tsconfig"
  | "scope";

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

export {
  formatDoctorJsonReport,
  type DoctorJsonReport,
} from "./format.js";

export interface RunDoctorOptions {
  targetPath: string;
  configPath?: string;
  enginesNode?: string;
  nodeVersion?: string;
  /** Forward-compat with M46; CLI when available */
  includeTests?: boolean;
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

function formatUnknownConfigKeysSuffix(unknownKeys: string[]): string {
  if (unknownKeys.length === 0) {
    return "";
  }
  return `; unknown config key(s) ignored: ${unknownKeys.join(", ")}`;
}

async function checkConfig(
  resolvedPath: string,
  configPath: string | undefined,
): Promise<DoctorFinding> {
  try {
    const loaded = configPath
      ? await loadHotspotScannerConfig(resolvedPath, { configPath })
      : await loadHotspotScannerConfig(resolvedPath);
    const unknownKeysSuffix = formatUnknownConfigKeysSuffix(loaded.unknownKeys);
    const status = loaded.unknownKeys.length > 0 ? "warn" : "pass";

    if (configPath) {
      return {
        id: "config",
        status,
        message: `Config file is valid: ${resolve(configPath)}${unknownKeysSuffix}`,
      };
    }

    if (loaded.config === null) {
      return {
        id: "config",
        status: "warn",
        message: `No ${HOTSPOT_SCANNER_CONFIG_FILENAME} found; scan will use CLI flags and defaults`,
      };
    }

    const discoveredPath = await findDiscoveredConfigPath(resolvedPath);
    return {
      id: "config",
      status,
      message: `Config file is valid: ${discoveredPath ?? HOTSPOT_SCANNER_CONFIG_FILENAME}${unknownKeysSuffix}`,
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

function buildScanOptions(options: RunDoctorOptions, resolvedPath: string): ScanOptions {
  return {
    repoPath: resolvedPath,
    configPath: options.configPath,
    includeTests: options.includeTests,
  };
}

function formatGitRepoPassMessage(context: ScanPipelineContext): string {
  let message = `Git repository: ${context.pipelineRepoPath}`;
  if (context.remountWarning) {
    message += ` (${context.remountWarning.message})`;
  }
  return message;
}

function formatPatternList(patterns: string[]): string {
  if (patterns.length === 0) {
    return "[]";
  }
  return JSON.stringify(patterns);
}

function formatScopeFindingMessage(
  preview: ScanScopePreview,
  remountWarning?: ScanWarning,
): string {
  const parts = [
    `repo: ${preview.repoPath}`,
    `include: ${formatPatternList(preview.include)}`,
    `exclude: ${formatPatternList(preview.exclude)}`,
    `eligible files: ${preview.eligibleFileCount}`,
  ];
  if (remountWarning) {
    parts.push(remountWarning.message);
  }
  return parts.join("; ");
}

async function checkSinceFinding(
  preludeContext: ScanPipelineContext,
): Promise<DoctorFinding> {
  const since = preludeContext.merged.since;
  const result = await probeSinceWindow({
    repoPath: preludeContext.pipelineRepoPath,
    since,
  });

  switch (result.status) {
    case "ok":
      return {
        id: "since",
        status: "pass",
        message: `Effective since "${since}" includes at least one commit`,
      };
    case "empty":
      return {
        id: "since",
        status: "warn",
        message: `No commits found for effective since "${since}". Next step: widen --since or fix the since value in config.`,
      };
    case "invalid":
      return {
        id: "since",
        status: "fail",
        message: `Git rejected since "${since}": ${result.message}`,
      };
  }
}

async function checkGitRepositoryFinding(
  resolvedPath: string,
  scanOptions: ScanOptions,
): Promise<{
  finding: DoctorFinding;
  preludeContext?: ScanPipelineContext;
}> {
  try {
    const preludeContext = await resolveScanPipelineContext(scanOptions);
    return {
      finding: {
        id: "git-repo",
        status: "pass",
        message: formatGitRepoPassMessage(preludeContext),
      },
      preludeContext,
    };
  } catch (error) {
    if (error instanceof ConfigError) {
      try {
        const resolved = await resolveMonorepoScanPath(resolvedPath);
        await validateGitRepository(resolved.repoPath);
        return {
          finding: {
            id: "git-repo",
            status: "pass",
            message: `Git repository: ${resolved.repoPath}`,
          },
        };
      } catch (gitError) {
        const message =
          gitError instanceof Error ? gitError.message : String(gitError);
        return {
          finding: {
            id: "git-repo",
            status: "fail",
            message,
          },
        };
      }
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      finding: {
        id: "git-repo",
        status: "fail",
        message,
      },
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
  let preludeContext: ScanPipelineContext | undefined;
  if (!targetValidation.ok) {
    findings.push({
      id: "git-repo",
      status: "fail",
      message: targetValidation.message,
    });
  } else {
    resolvedPath = targetValidation.resolvedPath;
    const scanOptions = buildScanOptions(options, resolvedPath);
    const gitCheck = await checkGitRepositoryFinding(resolvedPath, scanOptions);
    findings.push(gitCheck.finding);
    preludeContext = gitCheck.preludeContext;
  }

  if (resolvedPath) {
    findings.push(await checkConfig(resolvedPath, options.configPath));
    if (preludeContext) {
      findings.push(await checkSinceFinding(preludeContext));
      const preview = await previewScanScope(
        buildScanOptions(options, resolvedPath),
      );
      findings.push({
        id: "scope",
        status: "pass",
        message: formatScopeFindingMessage(
          preview,
          preludeContext.remountWarning,
        ),
      });
    }
    findings.push(checkTsConfig(resolvedPath));
  }

  return {
    findings,
    exitCode: aggregateExitCode(findings),
  };
}
