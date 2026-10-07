import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Database integration tests share one schema and clean the same tables.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50
      }
    }
  }
});
