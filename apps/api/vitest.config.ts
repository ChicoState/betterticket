import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
