import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { afterEach, describe, it, mock } from "node:test";
import { Test } from "@nestjs/testing";
import {
  getBrowserToken,
  PuppeteerModule,
  PuppeteerService,
  PuppeteerUnavailableError,
} from "../dist/core.js";
import { PuppeteerModule as RestPuppeteerModule } from "../dist/index.js";

const modules = [];

afterEach(async () => {
  await Promise.all(modules.splice(0).map((moduleRef) => moduleRef.close()));
});

describe("core module", () => {
  it("boots without launching Chromium when disabled", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PuppeteerModule.forRoot({ enabled: false, isGlobal: false })],
    })
      .compile();
    modules.push(moduleRef);

    const service = moduleRef.get(PuppeteerService);
    await assert.rejects(
      service.screenshot({ url: "https://example.com" }),
      PuppeteerUnavailableError,
    );
  });

  it("supports async disabled configuration", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PuppeteerModule.forRootAsync({
          isGlobal: false,
          useFactory: () => ({ enabled: false }),
        }),
      ],
    }).compile();
    modules.push(moduleRef);

    await assert.rejects(
      moduleRef.get(PuppeteerService).screenshot({ url: "https://example.com" }),
      PuppeteerUnavailableError,
    );
  });

  it("closes an injected browser only once during Nest shutdown", async () => {
    const close = mock.fn(async () => undefined);
    const browser = { connected: true, close };
    const moduleRef = await Test.createTestingModule({
      imports: [PuppeteerModule.forRoot({ isGlobal: false })],
    })
      .overrideProvider(getBrowserToken())
      .useValue(browser)
      .compile();

    await moduleRef.close();
    assert.equal(close.mock.callCount(), 1);
  });

  it("keeps optional REST dependencies out of the core bundle", async () => {
    const distribution = new URL("../dist/", import.meta.url);
    const files = (await readdir(distribution)).filter(
      (file) => file === "core.js" || (file.startsWith("chunk-") && file.endsWith(".js")),
    );
    const source = (
      await Promise.all(files.map((file) => readFile(new URL(file, distribution), "utf8")))
    ).join("\n");
    for (const dependency of [
      "@nestjs/platform-express",
      "@nestjs/swagger",
      "class-transformer",
      "class-validator",
    ]) {
      assert.doesNotMatch(source, new RegExp(dependency));
    }
  });
});

describe("root module", () => {
  it("boots its REST-capable NestJS 12 module without Chromium when disabled", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RestPuppeteerModule.forRoot({ enabled: false, isGlobal: false })],
    }).compile();
    modules.push(moduleRef);

    await assert.rejects(
      moduleRef.get(PuppeteerService).screenshot({ url: "https://example.com" }),
      PuppeteerUnavailableError,
    );
  });
});

describe("PuppeteerService", () => {
  it("returns a Buffer, forwards capture options, and closes the page", async () => {
    const page = {
      setViewport: mock.fn(async () => undefined),
      setExtraHTTPHeaders: mock.fn(async () => undefined),
      goto: mock.fn(async () => null),
      screenshot: mock.fn(async () => Uint8Array.from([1, 2, 3])),
      close: mock.fn(async () => undefined),
    };
    const browser = { newPage: mock.fn(async () => page) };
    const service = new PuppeteerService(browser);

    const result = await service.screenshot({
      url: "http://127.0.0.1:3002/a/artifact-1/",
      viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
      setExtraHTTPHeaders: { "x-artifact-st": "token" },
      gotoOptions: { waitUntil: "networkidle2", timeout: 15_000 },
      waitForTimeout: 1,
      type: "png",
      clip: { x: 0, y: 0, width: 1280, height: 800 },
    });

    assert.ok(Buffer.isBuffer(result));
    assert.deepEqual(result, Buffer.from([1, 2, 3]));
    assert.equal(page.setViewport.mock.callCount(), 1);
    assert.equal(page.setExtraHTTPHeaders.mock.callCount(), 1);
    assert.equal(page.goto.mock.callCount(), 1);
    assert.equal(page.screenshot.mock.callCount(), 1);
    assert.equal(page.close.mock.callCount(), 1);
  });

  it("preserves a capture error when page cleanup also fails", async () => {
    const captureError = new Error("capture failed");
    const page = {
      goto: mock.fn(async () => null),
      screenshot: mock.fn(async () => {
        throw captureError;
      }),
      close: mock.fn(async () => {
        throw new Error("close failed");
      }),
    };
    const service = new PuppeteerService({ newPage: mock.fn(async () => page) });

    await assert.rejects(
      service.screenshot({ url: "https://example.com", type: "png" }),
      (error) => error === captureError,
    );
    assert.equal(page.close.mock.callCount(), 1);
  });
});
