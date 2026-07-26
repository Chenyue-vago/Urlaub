import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./test/helpers/global-setup.ts",
    setupFiles: ["./test/helpers/setup.ts"],
    // Tests share a single Postgres test database and TRUNCATE between cases,
    // so files must NOT run concurrently against it.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
