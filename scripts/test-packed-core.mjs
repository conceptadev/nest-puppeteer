import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "nest-puppeteer-core-"));

try {
  execFileSync("pnpm", ["pack", "--pack-destination", temporaryDirectory], {
    cwd: root,
    stdio: "inherit",
  });

  const tarball = (await readdir(temporaryDirectory)).find((file) => file.endsWith(".tgz"));
  if (!tarball) throw new Error("pnpm pack did not create a tarball");

  await writeFile(
    join(temporaryDirectory, "package.json"),
    JSON.stringify({ name: "packed-core-consumer", private: true, type: "module" }),
  );
  await writeFile(
    join(temporaryDirectory, "consumer.mts"),
    `import {
      PuppeteerModule,
      PuppeteerService,
      type ScreenshotOptions,
    } from "puppeteer-nest/core";

    PuppeteerModule.forRoot({ enabled: false });
    export const screenshot = (service: PuppeteerService, options: ScreenshotOptions) =>
      service.screenshot(options);
    `,
  );
  await writeFile(
    join(temporaryDirectory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        strict: true,
        target: "ES2023",
        types: ["node"],
      },
      include: ["consumer.mts"],
    }),
  );

  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--legacy-peer-deps",
      "--no-audit",
      "--no-fund",
      join(temporaryDirectory, tarball),
      "@nestjs/common@12.0.1",
      "@nestjs/core@12.0.1",
      "@types/node@26.4.1",
      "puppeteer@25.10.0",
      "reflect-metadata@0.2.2",
      "rxjs@7.8.2",
      "typescript@7.0.2",
    ],
    {
      cwd: temporaryDirectory,
      env: {
        ...process.env,
        PUPPETEER_SKIP_DOWNLOAD: "true",
        npm_config_cache: join(temporaryDirectory, ".npm-cache"),
      },
      stdio: "inherit",
    },
  );

  execFileSync(process.execPath, ["--input-type=module", "--eval", "await import('puppeteer-nest/core')"], {
    cwd: temporaryDirectory,
    stdio: "inherit",
  });
  execFileSync(process.execPath, ["node_modules/typescript/bin/tsc"], {
    cwd: temporaryDirectory,
    stdio: "inherit",
  });
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
