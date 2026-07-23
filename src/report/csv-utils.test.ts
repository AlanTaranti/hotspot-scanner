import { describe, expect, it } from "vitest";
import { escapeCsvField, formatCsvRow } from "./csv-utils.js";

describe("escapeCsvField", () => {
  it("returns plain values unquoted", () => {
    expect(escapeCsvField("src/hot.ts")).toBe("src/hot.ts");
    expect(escapeCsvField("plain")).toBe("plain");
  });

  it("quotes fields containing commas", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("quotes fields containing double quotes and doubles internal quotes", () => {
    expect(escapeCsvField('"quoted"')).toBe('"""quoted"""');
  });

  it("quotes fields containing line breaks", () => {
    expect(escapeCsvField("line\nbreak")).toBe('"line\nbreak"');
    expect(escapeCsvField("line\r\nbreak")).toBe('"line\r\nbreak"');
    expect(escapeCsvField("line\rbreak")).toBe('"line\rbreak"');
  });

  it("handles combined special characters", () => {
    expect(escapeCsvField('path,"weird",\nfile')).toBe(
      '"path,""weird"",\nfile"',
    );
  });

  it("preserves unicode characters", () => {
    expect(escapeCsvField("src/日本語.ts")).toBe("src/日本語.ts");
    expect(escapeCsvField("café,path")).toBe('"café,path"');
  });
});

describe("formatCsvRow", () => {
  it("joins escaped fields with commas and no trailing comma", () => {
    expect(formatCsvRow(["a", "b", "c"])).toBe("a,b,c");
    expect(formatCsvRow(["plain", "a,b", "c"])).toBe('plain,"a,b",c');
  });
});
