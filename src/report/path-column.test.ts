import { describe, expect, it } from "vitest";
import {
  FALLBACK_FILE_COLUMN_WIDTH,
  formatFileColumn,
  MAX_FILE_COLUMN_WIDTH,
  MIN_FILE_COLUMN_WIDTH,
  PATH_ELLIPSIS,
  resolveFileColumnWidth,
} from "./path-column.js";

describe("resolveFileColumnWidth", () => {
  it("falls back to 24 when columns are missing or invalid", () => {
    expect(resolveFileColumnWidth(undefined)).toBe(FALLBACK_FILE_COLUMN_WIDTH);
    expect(resolveFileColumnWidth(0)).toBe(FALLBACK_FILE_COLUMN_WIDTH);
    expect(resolveFileColumnWidth(-1)).toBe(FALLBACK_FILE_COLUMN_WIDTH);
    expect(resolveFileColumnWidth(Number.NaN)).toBe(FALLBACK_FILE_COLUMN_WIDTH);
  });

  it("preserves 80-column scan layout budget", () => {
    expect(resolveFileColumnWidth(80)).toBe(24);
  });

  it("derives width from larger terminals up to max", () => {
    expect(resolveFileColumnWidth(100)).toBe(44);
    expect(resolveFileColumnWidth(200)).toBe(MAX_FILE_COLUMN_WIDTH);
  });

  it("clamps to minimum on tiny terminals", () => {
    expect(resolveFileColumnWidth(50)).toBe(MIN_FILE_COLUMN_WIDTH);
  });
});

describe("formatFileColumn", () => {
  it("returns full path when it fits", () => {
    expect(formatFileColumn("src/hot.ts", 24)).toBe("src/hot.ts              ");
    expect(formatFileColumn("src/hot.ts", 10)).toBe("src/hot.ts");
  });

  it("uses middle-ellipsis with prefix and basename", () => {
    const path = "src/api/v1/models/schema.ts";
    const cell = formatFileColumn(path, 24);

    expect(cell).toHaveLength(24);
    expect(cell).toContain(PATH_ELLIPSIS);
    expect(cell).toContain("schema.ts");
    expect(cell).not.toBe(path.slice(0, 24));
    expect(cell).not.toContain(path);
  });

  it("handles paths without slashes", () => {
    const path = "verylongfilenamewithoutslash.ts";
    const cell = formatFileColumn(path, 16);

    expect(cell).toHaveLength(16);
    expect(cell).toContain(PATH_ELLIPSIS);
  });

  it("handles basename longer than width", () => {
    const path = "src/abcdefghijklmnopqrstuvwxyz.ts";
    const cell = formatFileColumn(path, 16);

    expect(cell).toHaveLength(16);
    expect(cell.endsWith(".ts")).toBe(true);
  });

  it("pads short paths to exact width", () => {
    expect(formatFileColumn("a.ts", 10)).toBe("a.ts      ");
  });
});
