import { describe, expect, it } from "vitest";
import type { CouplingPair } from "../types/index.js";
import {
  couplingEnrichmentCsvValues,
  formatDirection,
  formatKinds,
  formatStaticDep,
} from "./coupling-format.js";

function makePair(overrides: Partial<CouplingPair> = {}): CouplingPair {
  return {
    fileA: "src/a.ts",
    fileB: "src/b.ts",
    coChangeCount: 1,
    couplingStrength: 0.5,
    hasStaticDependency: false,
    staticDependencyDirection: "none",
    hasRuntimeStaticDependency: false,
    hasTypeOnlyStaticDependency: false,
    hasReExportStaticDependency: false,
    ...overrides,
  };
}

describe("coupling-format", () => {
  it("formatStaticDep maps boolean to yes/no", () => {
    expect(formatStaticDep(true)).toBe("yes");
    expect(formatStaticDep(false)).toBe("no");
  });

  it("formatDirection maps internal values to display arrows", () => {
    expect(formatDirection("none")).toBe("none");
    expect(formatDirection("a-to-b")).toBe("a→b");
    expect(formatDirection("b-to-a")).toBe("b→a");
    expect(formatDirection("both")).toBe("both");
  });

  it("formatKinds lists present flags or em dash when empty", () => {
    expect(formatKinds(makePair())).toBe("—");
    expect(
      formatKinds(makePair({ hasRuntimeStaticDependency: true })),
    ).toBe("runtime");
    expect(
      formatKinds(
        makePair({
          hasTypeOnlyStaticDependency: true,
          hasReExportStaticDependency: true,
        }),
      ),
    ).toBe("type,re-export");
    expect(
      formatKinds(
        makePair({
          hasRuntimeStaticDependency: true,
          hasTypeOnlyStaticDependency: true,
        }),
      ),
    ).toBe("runtime,type");
  });

  it("couplingEnrichmentCsvValues emits raw field values", () => {
    expect(
      couplingEnrichmentCsvValues(
        makePair({
          staticDependencyDirection: "a-to-b",
          hasRuntimeStaticDependency: true,
        }),
      ),
    ).toEqual(["a-to-b", "true", "false", "false"]);
  });
});
