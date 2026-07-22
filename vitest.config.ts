import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#scan": resolve(__dirname, "dist/scan.js"),
      "#diagnostics": resolve(__dirname, "dist/diagnostics/index.js"),
      "#report": resolve(__dirname, "dist/report/index.js"),
      "#scoring": resolve(__dirname, "dist/scoring/index.js"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "bin/**/*.test.ts"],
    exclude: ["tests/fixtures/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "bin/**/*.ts"],
      exclude: ["src/types/**", "**/*.test.ts", "**/*.d.ts"],
    },
  },
});
