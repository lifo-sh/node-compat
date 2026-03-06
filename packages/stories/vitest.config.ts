import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "node",
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
});
