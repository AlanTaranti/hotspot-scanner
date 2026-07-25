import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOTSPOT_SCANNER_CONFIG_FILENAME,
} from "../config/load-config.js";

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawnSync: (...args: Parameters<typeof actual.spawnSync>) => {
      const mocked = spawnSyncMock(...args);
      if (mocked !== undefined) {
        return mocked;
      }
      return actual.spawnSync(...args);
    },
  };
});

import {
  aggregateExitCode,
  findNearestTsConfigPath,
  isGitOnPath,
  parseNodeMajor,
  runDoctor,
  satisfiesEnginesNode,
  type DoctorFinding,
} from "./index.js";

const smallTsFixture = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../tests/fixtures/repos/small-ts",
);

async function withTempDir(
  run: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "hotspot-doctor-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withGitRepo(
  files: Record<string, string>,
  run: (repoPath: string) => Promise<void>,
): Promise<void> {
  await withTempDir(async (repoPath) => {
    await mkdir(join(repoPath, ".git"), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      const filePath = join(repoPath, name);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
    }
    await run(repoPath);
  });
}

function healthyDoctorOptions(targetPath: string) {
  return {
    targetPath,
    enginesNode: ">=22",
    nodeVersion: "v22.0.0",
  };
}

describe("satisfiesEnginesNode", () => {
  it("accepts node versions meeting >= constraint", () => {
    expect(satisfiesEnginesNode(">=22", "v22.1.0")).toBe(true);
    expect(satisfiesEnginesNode(">=22", "23.0.0")).toBe(true);
  });

  it("rejects node versions below >= constraint", () => {
    expect(satisfiesEnginesNode(">=22", "v21.9.0")).toBe(false);
  });

  it("returns false for unsupported engines.node patterns", () => {
    expect(satisfiesEnginesNode("22", "v22.0.0")).toBe(false);
    expect(satisfiesEnginesNode("^22", "v22.0.0")).toBe(false);
  });
});

describe("parseNodeMajor", () => {
  it("parses major from v-prefixed and plain versions", () => {
    expect(parseNodeMajor("v22.4.1")).toBe(22);
    expect(parseNodeMajor("21.0.0")).toBe(21);
  });

  it("returns 0 when no leading major version is present", () => {
    expect(parseNodeMajor("invalid")).toBe(0);
  });
});

describe("aggregateExitCode", () => {
  it("returns 0 when there are no failures", () => {
    const findings: DoctorFinding[] = [
      { id: "config", status: "warn", message: "missing" },
      { id: "tsconfig", status: "warn", message: "missing" },
    ];
    expect(aggregateExitCode(findings)).toBe(0);
  });

  it("returns 2 when only config failures exist", () => {
    const findings: DoctorFinding[] = [
      { id: "config", status: "fail", message: "invalid" },
    ];
    expect(aggregateExitCode(findings)).toBe(2);
  });

  it("returns 1 when non-config failures exist", () => {
    const findings: DoctorFinding[] = [
      { id: "config", status: "fail", message: "invalid" },
      { id: "git-repo", status: "fail", message: "not a repo" },
    ];
    expect(aggregateExitCode(findings)).toBe(1);
  });
});

describe("findNearestTsConfigPath", () => {
  it("finds tsconfig in the target directory", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "tsconfig.json"), "{}", "utf8");
      expect(findNearestTsConfigPath(dir)).toBe(join(dir, "tsconfig.json"));
    });
  });

  it("walks upward to find jsconfig.json", async () => {
    await withTempDir(async (dir) => {
      const nested = join(dir, "packages", "app");
      await mkdir(nested, { recursive: true });
      await writeFile(join(dir, "jsconfig.json"), "{}", "utf8");
      expect(findNearestTsConfigPath(nested)).toBe(join(dir, "jsconfig.json"));
    });
  });

  it("returns null when no tsconfig or jsconfig exists on the walk", async () => {
    await withTempDir(async (dir) => {
      expect(findNearestTsConfigPath(dir)).toBeNull();
    });
  });
});

describe("isGitOnPath", () => {
  it("returns true when git responds on PATH", () => {
    expect(isGitOnPath()).toBe(true);
  });
});

describe("runDoctor", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exits 1 when node engines are not satisfied", async () => {
    await withGitRepo({}, async (repoPath) => {
      const result = await runDoctor({
        ...healthyDoctorOptions(repoPath),
        nodeVersion: "v20.0.0",
      });

      expect(result.exitCode).toBe(1);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          id: "node-engines",
          status: "fail",
        }),
      );
    });
  });

  it("exits 1 when git is missing from PATH", async () => {
    spawnSyncMock.mockImplementation((command: string) => {
      if (command === "git") {
        return { status: 1 };
      }
      return undefined;
    });

    await withGitRepo({}, async (repoPath) => {
      const result = await runDoctor(healthyDoctorOptions(repoPath));

      expect(result.exitCode).toBe(1);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          id: "git-path",
          status: "fail",
        }),
      );
    });
  });

  it("exits 1 when the target path does not exist", async () => {
    const missingPath = join(tmpdir(), `hotspot-doctor-missing-${Date.now()}`);
    const result = await runDoctor({
      ...healthyDoctorOptions(missingPath),
    });

    expect(result.exitCode).toBe(1);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        id: "git-repo",
        status: "fail",
        message: expect.stringMatching(/does not exist/i),
      }),
    );
  });

  it("exits 1 when the target path is not a git repository", async () => {
    await withTempDir(async (repoPath) => {
      const result = await runDoctor(healthyDoctorOptions(repoPath));

      expect(result.exitCode).toBe(1);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          id: "git-repo",
          status: "fail",
          message: expect.stringMatching(/not a git repository/i),
        }),
      );
    });
  });

  it("exits 1 when the target path is a file, not a directory", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "not-a-dir.txt");
      await writeFile(filePath, "x", "utf8");
      const result = await runDoctor(healthyDoctorOptions(filePath));

      expect(result.exitCode).toBe(1);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          id: "git-repo",
          status: "fail",
          message: expect.stringMatching(/not a directory/i),
        }),
      );
    });
  });

  it("warns and exits 0 when discovered config is missing but repo is healthy", async () => {
    await withGitRepo({}, async (repoPath) => {
      const result = await runDoctor(healthyDoctorOptions(repoPath));

      expect(result.exitCode).toBe(0);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          id: "config",
          status: "warn",
          message: expect.stringMatching(/No .*\.hotspot-scanner\.json found/i),
        }),
      );
    });
  });

  it("exits 2 when explicit config path is missing", async () => {
    await withGitRepo({}, async (repoPath) => {
      const missingConfig = join(repoPath, "missing-config.json");
      const result = await runDoctor({
        ...healthyDoctorOptions(repoPath),
        configPath: missingConfig,
      });

      expect(result.exitCode).toBe(2);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          id: "config",
          status: "fail",
          message: expect.stringMatching(/Config file not found/i),
        }),
      );
    });
  });

  it("exits 2 when discovered config is invalid", async () => {
    await withGitRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: "{ invalid json",
      },
      async (repoPath) => {
        const result = await runDoctor(healthyDoctorOptions(repoPath));

        expect(result.exitCode).toBe(2);
        expect(result.findings).toContainEqual(
          expect.objectContaining({
            id: "config",
            status: "fail",
            message: expect.stringMatching(/Invalid JSON/i),
          }),
        );
      },
    );
  });

  it("passes when discovered config is valid", async () => {
    await withGitRepo(
      {
        [HOTSPOT_SCANNER_CONFIG_FILENAME]: JSON.stringify({
          since: "12 months ago",
        }),
      },
      async (repoPath) => {
        const result = await runDoctor(healthyDoctorOptions(repoPath));

        expect(result.exitCode).toBe(0);
        expect(result.findings).toContainEqual(
          expect.objectContaining({
            id: "config",
            status: "pass",
            message: expect.stringMatching(/Config file is valid/i),
          }),
        );
      },
    );
  });

  it("passes when explicit config path is valid", async () => {
    await withGitRepo(
      {
        "custom-config.json": JSON.stringify({ since: "6 months ago" }),
      },
      async (repoPath) => {
        const configPath = join(repoPath, "custom-config.json");
        const result = await runDoctor({
          ...healthyDoctorOptions(repoPath),
          configPath,
        });

        expect(result.exitCode).toBe(0);
        expect(result.findings).toContainEqual(
          expect.objectContaining({
            id: "config",
            status: "pass",
            message: expect.stringMatching(/Config file is valid:.*custom-config\.json/),
          }),
        );
      },
    );
  });

  it("discovers config via parent-directory walk for nested targets", async () => {
    await withTempDir(async (workspaceDir) => {
      const repoPath = join(workspaceDir, "repo");
      await mkdir(join(repoPath, ".git"), { recursive: true });
      await writeFile(
        join(workspaceDir, HOTSPOT_SCANNER_CONFIG_FILENAME),
        JSON.stringify({ since: "12 months ago" }),
        "utf8",
      );

      const result = await runDoctor(healthyDoctorOptions(repoPath));

      expect(result.exitCode).toBe(0);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          id: "config",
          status: "pass",
          message: expect.stringMatching(/Config file is valid/i),
        }),
      );
    });
  });

  it("reports tsconfig presence as informational pass", async () => {
    await withGitRepo(
      {
        "tsconfig.json": JSON.stringify({ compilerOptions: {} }),
      },
      async (repoPath) => {
        const result = await runDoctor(healthyDoctorOptions(repoPath));

        expect(result.findings).toContainEqual(
          expect.objectContaining({
            id: "tsconfig",
            status: "pass",
            message: expect.stringMatching(/tsconfig\.json|jsconfig\.json/i),
          }),
        );
      },
    );
  });

  it("reports missing tsconfig as informational warn without failing", async () => {
    await withGitRepo({}, async (repoPath) => {
      const result = await runDoctor(healthyDoctorOptions(repoPath));

      expect(result.exitCode).toBe(0);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          id: "tsconfig",
          status: "warn",
          message: expect.stringMatching(/No tsconfig\.json or jsconfig\.json/i),
        }),
      );
    });
  });

  it("prints all findings before aggregating exit code", async () => {
    await withTempDir(async (repoPath) => {
      const result = await runDoctor({
        targetPath: repoPath,
        enginesNode: ">=22",
        nodeVersion: "v20.0.0",
      });

      expect(result.findings.map((finding) => finding.id)).toEqual([
        "node-engines",
        "git-path",
        "git-repo",
        "config",
        "tsconfig",
      ]);
      expect(result.exitCode).toBe(1);
    });
  });

  it("exits 0 on a healthy fixture repository", async () => {
    const result = await runDoctor(healthyDoctorOptions(smallTsFixture));

    expect(result.exitCode).toBe(0);
    expect(result.findings.filter((finding) => finding.status === "fail")).toEqual(
      [],
    );
  });

  it("reads engines.node from package.json when not overridden", async () => {
    await withGitRepo({}, async (repoPath) => {
      const first = await runDoctor({ targetPath: repoPath });
      const second = await runDoctor({ targetPath: repoPath });

      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(0);
      expect(first.findings).toContainEqual(
        expect.objectContaining({
          id: "node-engines",
          status: "pass",
          message: expect.stringMatching(/satisfies engines\.node/),
        }),
      );
    });
  });
});
