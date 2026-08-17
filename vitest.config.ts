import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The leaderboard file store is written by API tests — keep it in a temp
    // dir so the real .data/leaderboard.json is never touched.
    env: {
      LEADERBOARD_FILE: path.join(__dirname, ".data", "test-leaderboard.json"),
    },
  },
});
