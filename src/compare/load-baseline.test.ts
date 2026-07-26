import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BaselineError,
  loadBaseline,
  parseScanResult,
} from "./load-baseline.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../tests/fixtures/report/sample-result.json",
);

function loadFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Record<
    string,
    unknown
  >;
}

describe("parseScanResult", () => {
  it("accepts valid 2.0 ScanResult JSON", () => {
    const raw = loadFixture();
    const result = parseScanResult(raw);

    expect(result.version).toBe("2.0");
    expect(result.hotspots).toHaveLength(3);
    expect(result.meta.granularity).toBe("file");
    expect(result.meta.warnings).toEqual([]);
    expect(result.meta.timings).toBeUndefined();
  });

  it("parses optional meta.timings", () => {
    const raw = loadFixture();
    const result = parseScanResult({
      ...raw,
      meta: {
        ...(raw.meta as Record<string, unknown>),
        timings: {
          gitMs: 100,
          complexityMs: 200,
          totalMs: 250,
        },
      },
    });

    expect(result.meta.timings).toEqual({
      gitMs: 100,
      complexityMs: 200,
      totalMs: 250,
    });
  });

  it("parses function-mode meta.timings with functionChurnMs", () => {
    const raw = loadFixture();
    const result = parseScanResult({
      ...raw,
      meta: {
        ...(raw.meta as Record<string, unknown>),
        timings: {
          gitMs: 100,
          complexityMs: 200,
          functionChurnMs: 50,
          totalMs: 300,
        },
      },
    });

    expect(result.meta.timings).toEqual({
      gitMs: 100,
      complexityMs: 200,
      functionChurnMs: 50,
      totalMs: 300,
    });
  });

  it("rejects invalid meta.timings", () => {
    const raw = loadFixture();

    expect(() =>
      parseScanResult({
        ...raw,
        meta: {
          ...(raw.meta as Record<string, unknown>),
          timings: { gitMs: 10, complexityMs: 20 },
        },
      }),
    ).toThrow(/meta.timings is missing required field: totalMs/);

    expect(() =>
      parseScanResult({
        ...raw,
        meta: {
          ...(raw.meta as Record<string, unknown>),
          timings: { gitMs: -1, complexityMs: 20, totalMs: 30 },
        },
      }),
    ).toThrow(/meta.timings.gitMs must be a non-negative integer/);
  });

  it("parses structured meta.warnings", () => {
    const raw = loadFixture();
    const result = parseScanResult({
      ...raw,
      meta: {
        ...(raw.meta as Record<string, unknown>),
        warnings: [
          {
            severity: "warning",
            message: "parse failed for src/bad.ts",
            code: "PARSE_FAILED",
          },
        ],
      },
    });

    expect(result.meta.warnings).toEqual([
      {
        severity: "warning",
        message: "parse failed for src/bad.ts",
        code: "PARSE_FAILED",
      },
    ]);
  });

  it("rejects invalid meta.warnings", () => {
    const raw = loadFixture();

    expect(() =>
      parseScanResult({
        ...raw,
        meta: { ...(raw.meta as Record<string, unknown>), warnings: "none" },
      }),
    ).toThrow(/meta.warnings must be an array/);

    expect(() =>
      parseScanResult({
        ...raw,
        meta: {
          ...(raw.meta as Record<string, unknown>),
          warnings: [{ severity: "critical", message: "bad" }],
        },
      }),
    ).toThrow(/meta.warnings\[0\]\.severity must be one of/);

    expect(() =>
      parseScanResult({
        ...raw,
        meta: {
          ...(raw.meta as Record<string, unknown>),
          warnings: [{ severity: "info", message: 42 }],
        },
      }),
    ).toThrow(/meta.warnings\[0\]\.message must be a string/);
  });

  it("rejects malformed JSON root", () => {
    expect(() => parseScanResult(null)).toThrow(BaselineError);
    expect(() => parseScanResult(null)).toThrow(/must be an object/);
  });

  it("rejects version 1.0 baselines with re-scan hint", () => {
    const raw = loadFixture();
    expect(() => parseScanResult({ ...raw, version: "1.0" })).toThrow(
      /Unsupported baseline version: "1.0"/,
    );
    expect(() => parseScanResult({ ...raw, version: "1.0" })).toThrow(
      /Re-scan/,
    );
  });

  it("rejects unsupported version", () => {
    const raw = loadFixture();
    expect(() => parseScanResult({ ...raw, version: "3.0" })).toThrow(
      /Unsupported baseline version/,
    );
    expect(() => parseScanResult({ ...raw, version: "3.0" })).toThrow(
      /Hint:.*JSON contract/,
    );
  });

  it("rejects baseline with top-level coupling key", () => {
    const raw = loadFixture();
    expect(() =>
      parseScanResult({
        ...raw,
        coupling: [],
      }),
    ).toThrow(/unsupported field "coupling"/);
    expect(() =>
      parseScanResult({
        ...raw,
        coupling: [],
      }),
    ).toThrow(/Re-scan/);
  });

  it("rejects spoofed 2.0 with coupling property", () => {
    const raw = loadFixture();
    expect(() =>
      parseScanResult({
        ...raw,
        version: "2.0",
        coupling: [
          {
            fileA: "a.ts",
            fileB: "b.ts",
            coChangeCount: 1,
            couplingStrength: 0.5,
          },
        ],
      }),
    ).toThrow(/unsupported field "coupling"/);
  });

  it("rejects missing required keys", () => {
    const raw = loadFixture();
    const { hotspots: _hotspots, ...withoutHotspots } = raw;
    expect(() => parseScanResult(withoutHotspots)).toThrow(/hotspots/);

    const { functions: _functions, ...withoutFunctions } = raw;
    expect(() => parseScanResult(withoutFunctions)).toThrow(/functions/);

    const { meta: _meta, ...withoutMeta } = raw;
    expect(() => parseScanResult(withoutMeta)).toThrow(/meta/);
  });

  it("rejects invalid meta fields", () => {
    const raw = loadFixture();
    expect(() =>
      parseScanResult({
        ...raw,
        meta: { ...(raw.meta as Record<string, unknown>), since: 12 },
      }),
    ).toThrow(/meta.since must be a string/);

    expect(() =>
      parseScanResult({
        ...raw,
        meta: { ...(raw.meta as Record<string, unknown>), scannedAt: null },
      }),
    ).toThrow(/meta.scannedAt must be a string/);
  });

  it("rejects invalid granularity", () => {
    const raw = loadFixture();
    expect(() =>
      parseScanResult({
        ...raw,
        meta: {
          ...(raw.meta as Record<string, unknown>),
          granularity: "module",
        },
      }),
    ).toThrow(/Invalid baseline meta.granularity/);
  });

  it("rejects invalid hotspot items", () => {
    const raw = loadFixture();
    const hotspots = [...(raw.hotspots as unknown[])];

    hotspots[0] = "not-an-object";
    expect(() => parseScanResult({ ...raw, hotspots })).toThrow(
      /hotspots\[0\] must be an object/,
    );

    hotspots[0] = { ...(raw.hotspots as Record<string, unknown>[])[0] };
    delete (hotspots[0] as Record<string, unknown>).filePath;
    expect(() => parseScanResult({ ...raw, hotspots })).toThrow(
      /hotspots\[0\] is missing required field: filePath/,
    );

    hotspots[0] = {
      ...(raw.hotspots as Record<string, unknown>[])[0],
      hotspotScore: "high",
    };
    expect(() => parseScanResult({ ...raw, hotspots })).toThrow(
      /hotspots\[0\]\.hotspotScore must be a number/,
    );

    hotspots[0] = {
      ...(raw.hotspots as Record<string, unknown>[])[0],
      commitCount: 1.5,
    };
    expect(() => parseScanResult({ ...raw, hotspots })).toThrow(
      /hotspots\[0\]\.commitCount must be an integer/,
    );

    hotspots[0] = { ...(raw.hotspots as Record<string, unknown>[])[0] };
    delete (hotspots[0] as Record<string, unknown>).parseFailed;
    expect(() => parseScanResult({ ...raw, hotspots })).toThrow(
      /hotspots\[0\] is missing required field: parseFailed/,
    );
    expect(() => parseScanResult({ ...raw, hotspots })).toThrow(/Hint:/);
  });

  it("rejects invalid function items", () => {
    const raw = loadFixture();
    const functions = [
      {
        filePath: "src/foo.ts",
        functionName: "bar",
        line: 10,
        complexity: 3,
        complexityNormalized: 0.5,
        churnNormalized: 0.4,
        hotspotScore: 0.45,
        commitCount: 2,
        linesChanged: 20,
        authorCount: 1,
      },
    ];

    functions[0] = { ...functions[0], line: "ten" };
    expect(() => parseScanResult({ ...raw, functions })).toThrow(
      /functions\[0\]\.line must be an integer/,
    );

    const incomplete = { ...functions[0], line: 10 };
    delete (incomplete as Record<string, unknown>).functionName;
    expect(() => parseScanResult({ ...raw, functions: [incomplete] })).toThrow(
      /functions\[0\] is missing required field: functionName/,
    );
  });
});

describe("loadBaseline", () => {
  it("reads valid fixture file", async () => {
    const result = await loadBaseline(fixturePath);
    expect(result.version).toBe("2.0");
    expect(result.hotspots[0]?.filePath).toBe("src/hot.ts");
  });

  it("throws on missing file", async () => {
    const invalidPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../tests/fixtures/report/sample-result-missing.json",
    );
    await expect(loadBaseline(invalidPath)).rejects.toThrow(BaselineError);
    await expect(loadBaseline(invalidPath)).rejects.toThrow(
      /Failed to read baseline file/,
    );
  });

  it("throws on malformed JSON file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const invalidPath = join(tempDir, "invalid.json");
    await writeFile(invalidPath, "{ not json", "utf8");
    try {
      await expect(loadBaseline(invalidPath)).rejects.toThrow(BaselineError);
      await expect(loadBaseline(invalidPath)).rejects.toThrow(
        /Failed to parse baseline JSON/,
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("throws on baseline with coupling key", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "hotspot-scanner-test-"));
    const invalidPath = join(tempDir, "legacy-baseline.json");
    const raw = loadFixture();
    await writeFile(
      invalidPath,
      JSON.stringify({ ...raw, coupling: [] }),
      "utf8",
    );
    try {
      await expect(loadBaseline(invalidPath)).rejects.toThrow(BaselineError);
      await expect(loadBaseline(invalidPath)).rejects.toThrow(/coupling/);
      await expect(loadBaseline(invalidPath)).rejects.toThrow(/Re-scan/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
