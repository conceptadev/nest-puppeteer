import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/core.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: false,
  target: "es2022",
  outDir: "dist",
  external: ["@nestjs/common", "@nestjs/core", "@nestjs/swagger", "@nestjs/platform-express", "puppeteer", "rxjs", "class-validator", "class-transformer", "multer"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
