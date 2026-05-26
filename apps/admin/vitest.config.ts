import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/lib/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/services/**"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/lib/test-setup.ts"],
      reporter: ["text", "lcov", "html"],
      thresholds: {
        // Current actual: lines ~40%, functions ~72%.
        // lines: 40 is a regression guard — raise toward 60% as service-layer
        // branch coverage improves (error paths, billing guards, cache miss branches).
        lines: 39,
        functions: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
