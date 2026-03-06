import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/fs.ts",
    "src/fs/promises.ts",
    "src/path.ts",
    "src/events.ts",
    "src/buffer.ts",
    "src/process.ts",
    "src/util.ts",
    "src/timers.ts",
    "src/assert.ts",
    "src/os.ts",
    "src/stream.ts",
    "src/url.ts",
    "src/crypto.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
