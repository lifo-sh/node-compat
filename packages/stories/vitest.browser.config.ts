import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "browser",
    include: ["src/__tests__/**/*.test.ts"],
    browser: {
      enabled: true,
      provider: "playwright",
      instances: [{ browser: "chromium" }],
    },
  },
});
