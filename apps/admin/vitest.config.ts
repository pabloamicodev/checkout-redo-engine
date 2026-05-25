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
        lines: 30,
        functions: 45,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
