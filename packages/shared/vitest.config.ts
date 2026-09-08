import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    isolate: false,
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**", "components/**"],
      exclude: ["components/ui/**"],
    },
  },
});
