import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTsMorphProject } from "./project.js";

const tempDirs: string[] = [];

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "complexity-project-"));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(dir, relativePath);
    await mkdir(join(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("createTsMorphProject", () => {
  it("loads valid source files", async () => {
    const repoPath = await createTempRepo({
      "valid.ts": "export function ok() { return 1; }",
    });
    const project = createTsMorphProject({ repoPath });

    const sourceFiles = await project.loadBatch(["valid.ts"]);

    expect(sourceFiles).toHaveLength(1);
    expect(project.getParseFailures()).toEqual([]);
  });

  it("records parse failures for invalid syntax", async () => {
    const repoPath = await createTempRepo({
      "invalid.ts": "export function broken( { return; }",
    });
    const project = createTsMorphProject({ repoPath });

    const sourceFiles = await project.loadBatch(["invalid.ts"]);

    expect(sourceFiles).toHaveLength(0);
    expect(project.getParseFailures()).toHaveLength(1);
    expect(project.getParseFailures()[0]).toMatchObject({
      filePath: "invalid.ts",
    });
    expect(project.getParseFailures()[0]?.message.length).toBeGreaterThan(0);
  });

  it("records parse failures for missing files", async () => {
    const repoPath = await createTempRepo({});
    const project = createTsMorphProject({ repoPath });

    const sourceFiles = await project.loadBatch(["missing.ts"]);

    expect(sourceFiles).toHaveLength(0);
    expect(project.getParseFailures()).toHaveLength(1);
    expect(project.getParseFailures()[0]?.filePath).toBe("missing.ts");
  });

  it("reuses one Project across sequential loadBatch calls", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
    });
    const adapter = createTsMorphProject({ repoPath });

    const firstBatch = await adapter.loadBatch(["a.ts"]);
    expect(firstBatch).toHaveLength(1);
    expect(firstBatch[0]?.getBaseName()).toBe("a.ts");
    const sharedProject = firstBatch[0]?.getProject();

    const secondBatch = await adapter.loadBatch(["b.ts"]);
    expect(secondBatch).toHaveLength(1);
    expect(secondBatch[0]?.getBaseName()).toBe("b.ts");
    expect(secondBatch[0]?.getProject()).toBe(sharedProject);
  });

  it("clears prior batch source files before loading the next batch", async () => {
    const repoPath = await createTempRepo({
      "a.ts": "export const a = 1;",
      "b.ts": "export const b = 2;",
    });
    const adapter = createTsMorphProject({ repoPath });

    const firstBatch = await adapter.loadBatch(["a.ts"]);
    await adapter.loadBatch(["b.ts"]);

    const liveSourceFiles = firstBatch[0]
      ?.getProject()
      .getSourceFiles()
      .map((sourceFile) => sourceFile.getBaseName());

    expect(liveSourceFiles).toEqual(["b.ts"]);
  });

  it("uses syntactic diagnostics only for parse gating", async () => {
    const repoPath = await createTempRepo({
      "valid.ts": "export function ok() { return 1; }",
    });
    const { Project } = await import("ts-morph");
    const programProto = Object.getPrototypeOf(new Project().getProgram());
    const syntacticSpy = vi.spyOn(programProto, "getSyntacticDiagnostics");
    const semanticSpy = vi.spyOn(programProto, "getSemanticDiagnostics");
    const preEmitSpy = vi.spyOn(Project.prototype, "getPreEmitDiagnostics");
    const adapter = createTsMorphProject({ repoPath });

    try {
      await adapter.loadBatch(["valid.ts"]);

      expect(syntacticSpy).toHaveBeenCalled();
      expect(semanticSpy).not.toHaveBeenCalled();
      expect(preEmitSpy).not.toHaveBeenCalled();
    } finally {
      syntacticSpy.mockRestore();
      semanticSpy.mockRestore();
      preEmitSpy.mockRestore();
    }
  });

  it("records non-Error values from addSourceFileAtPath failures", async () => {
    const repoPath = await createTempRepo({});
    const project = createTsMorphProject({ repoPath });

    const { Project } = await import("ts-morph");
    const addSpy = vi
      .spyOn(Project.prototype, "addSourceFileAtPath")
      .mockImplementation(() => {
        throw "broken path";
      });

    try {
      const sourceFiles = await project.loadBatch(["throws-string.ts"]);
      expect(sourceFiles).toHaveLength(0);
      expect(project.getParseFailures()[0]?.message).toBe("broken path");
    } finally {
      addSpy.mockRestore();
    }
  });
});
