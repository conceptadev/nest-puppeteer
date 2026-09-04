import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/core.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  dts: true,
  sourcemap: true,
  clean: true,
  fixedExtension: true,
  treeshake: true,
  deps: {
    neverBundle: [
      /^@nestjs\//,
      "puppeteer",
      "rxjs",
      "class-validator",
      "class-transformer",
      "multer",
    ],
  },
});
