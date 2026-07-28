import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#scan": resolve(__dirname, "src/scan.ts"),
      "#diagnostics": resolve(__dirname, "src/diagnostics/index.ts"),
      "#report": resolve(__dirname, "src/report/index.ts"),
      "#scoring": resolve(__dirname, "src/scoring/index.ts"),
      "#config": resolve(__dirname, "src/config/index.ts"),
      "#doctor": resolve(__dirname, "src/doctor/index.ts"),
      "#git": resolve(__dirname, "src/git/index.ts"),
      "#trend": resolve(__dirname, "src/trend/index.ts"),
      "#assess": resolve(__dirname, "src/assess/index.ts"),
      "#types": resolve(__dirname, "src/types/index.ts"),
    },
  },
  test: {
    globalSetup: ["tests/fixtures/repos/global-setup.ts"],
    include: [
      "src/**/*.test.ts",
      "bin/**/*.test.ts",
      "tests/contract/**/*.test.ts",
      "tests/compiled-cli.smoke.test.ts",
      "tests/living-sot-docs.test.ts",
    ],
    exclude: ["tests/fixtures/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "bin/**/*.ts"],
      exclude: [
        "src/types/**",
        "src/complexity/worker.ts",
        "**/*.test.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        perFile: true,
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 80,
      },
    },
  },
});
