import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.js"],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
