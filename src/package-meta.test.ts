import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileSyncMock } = vi.hoisted(() => ({
  readFileSyncMock: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (readFileSyncMock.getMockImplementation() !== undefined) {
        return readFileSyncMock(...args);
      }
      return actual.readFileSync(...args);
    },
  };
});

describe("getPackageVersion", () => {
  beforeEach(() => {
    readFileSyncMock.mockReset();
    vi.resetModules();
  });

  it("returns package.json version and caches on second call", async () => {
    const { getPackageVersion } = await import("./package-meta.js");

    const first = getPackageVersion();
    const second = getPackageVersion();

    expect(first).toBe("1.0.0");
    expect(second).toBe(first);
  });

  it("throws when package.json version is missing or empty", async () => {
    readFileSyncMock.mockReturnValue("{}");
    const { getPackageVersion } = await import("./package-meta.js");

    expect(() => getPackageVersion()).toThrow(/missing a non-empty "version"/);
  });
});
