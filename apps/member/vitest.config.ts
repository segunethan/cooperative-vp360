import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    pool: "threads",
    isolate: false,
    environment: "happy-dom",
    globals: true,
    setupFiles: ["../../packages/shared/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/components/**", "src/context/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
