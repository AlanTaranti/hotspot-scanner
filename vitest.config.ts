import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#scan": resolve(__dirname, "src/scan.ts"),
      "#diagnostics": resolve(__dirname, "src/diagnostics/index.ts"),
      "#report": resolve(__dirname, "src/report/index.ts"),
      "#scoring": resolve(__dirname, "src/scoring/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "bin/**/*.test.ts"],
    exclude: ["tests/fixtures/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "bin/**/*.ts"],
      exclude: ["src/types/**", "**/*.test.ts", "**/*.d.ts"],
      thresholds: {
        perFile: true,
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 80
      }
    },
  },
});
