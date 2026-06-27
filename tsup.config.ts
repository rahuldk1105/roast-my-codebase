import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  target: "node18",
  external: ["picomatch", "fast-glob"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
