import { defineConfig } from "vitest/config";

export default defineConfig({
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
