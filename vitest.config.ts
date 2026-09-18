import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
    // Booting an in-process Postgres per file is a few seconds.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
