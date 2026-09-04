import { INestApplication } from "@nestjs/common";
import { FontRegistry, PuppeteerService, parseFontVariant } from "@concepta/nestjs-puppeteer";
import request from "supertest";
import { createTestApp } from "./setup.js";

describe("custom fonts via fontsDir", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe("parseFontVariant", () => {
    it("parses hyphenated flat names", () => {
      expect(parseFontVariant("TestSans-Light")).toEqual({
        family: "TestSans",
        weight: 300,
        style: "normal",
      });
      expect(parseFontVariant("TestSans-LightOblique")).toEqual({
        family: "TestSans",
        weight: 300,
        style: "italic",
      });
    });

    it("parses CamelCase directory names with numeric foundry weights", () => {
      expect(parseFontVariant("TestSans35Light")).toEqual({
        family: "TestSans",
        weight: 300,
        style: "normal",
      });
      expect(parseFontVariant("TestSans55Oblique")).toEqual({
        family: "TestSans",
        weight: 400,
        style: "italic",
      });
      expect(parseFontVariant("TestSans65Medium")).toEqual({
        family: "TestSans",
        weight: 500,
        style: "normal",
      });
      expect(parseFontVariant("TestSans85Heavy")).toEqual({
        family: "TestSans",
        weight: 800,
        style: "normal",
      });
    });

    it("falls back to family-only when no modifier is present", () => {
      expect(parseFontVariant("TestSans")).toEqual({
        family: "TestSans",
        weight: 400,
        style: "normal",
      });
    });
  });

  describe("registry", () => {
    it("loads variants from the configured fontsDir", () => {
      const registry = app.get(FontRegistry);
      expect(registry.isEmpty()).toBe(false);
      const block = registry.getStyleBlock();
      expect(block).toContain("@font-face");
      expect(block).toContain("font-family:'TestSans'");
      expect(block).toContain("font-weight:300");
      expect(block).toContain("font-weight:500");
      expect(block).toContain("font-weight:800");
      expect(block).toContain("font-style:italic");
      expect(block).toContain("data:font/woff2;base64,");
    });

    it("emits configured fontAliases alongside the parsed family", () => {
      const registry = app.get(FontRegistry);
      expect(registry.resolveAliases("TestSans")).toEqual([
        "TestSans",
        "Test Sans",
      ]);
      const block = registry.getStyleBlock();
      expect(block).toContain("font-family:'Test Sans'");
    });

    it("returns only the parsed family when no aliases are configured", () => {
      // Default-constructed registry: no config → no extra aliases
      const standalone = new FontRegistry();
      expect(standalone.resolveAliases("TestSans")).toEqual(["TestSans"]);
    });

    it("exposes document.fonts.load() specs for every variant × alias", () => {
      const registry = app.get(FontRegistry);
      const specs = registry.getFontLoadSpecs();
      // 4 variants × 2 names (TestSans + Test Sans alias)
      expect(specs).toHaveLength(8);
      expect(specs).toContain("300 16px 'TestSans'");
      expect(specs).toContain("italic 400 16px 'TestSans'");
      expect(specs).toContain("500 16px 'Test Sans'");
      expect(specs).toContain("800 16px 'Test Sans'");
    });

    it("scopes style block and load specs to families the HTML references", () => {
      const registry = app.get(FontRegistry);

      const byAlias = registry.getStyleBlockFor("<span style=\"font-family:'Test Sans'\">x</span>");
      expect(byAlias).toContain("@font-face");
      expect(byAlias).toContain("data-puppeteer-fonts");

      // case-insensitive family match
      expect(registry.getStyleBlockFor("font-family:testsans")).toContain("@font-face");

      // unreferenced families are not emitted
      expect(registry.getStyleBlockFor("<span style='font-family:Arial'>x</span>")).toBe("");
      expect(registry.getFontLoadSpecsFor("font-family:Arial")).toHaveLength(0);

      expect(registry.getFontLoadSpecsFor("font-family:TestSans")).toHaveLength(8);
    });
  });

  describe("HTML interception", () => {
    it("prepends the @font-face block to user HTML before setContent", async () => {
      const service = app.get(PuppeteerService);
      const rendered = await service.content({
        html: "<html><body><p style='font-family:TestSans;font-weight:800'>Hi</p></body></html>",
      });
      expect(rendered).toContain("data-puppeteer-fonts");
      expect(rendered).toContain("TestSans");
    });

    it("returns a valid PDF when HTML uses the custom font", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/pdf")
        .send({
          html: "<html><body><h1 style='font-family:TestSans;font-weight:800'>Heavy</h1><p style='font-family:TestSans;font-weight:300;font-style:italic'>Light italic</p></body></html>",
          waitForFonts: true,
        })
        .expect(200);

      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(Buffer.from(res.body.slice(0, 4)).toString("ascii")).toBe("%PDF");
    });
  });

  describe("header/footer templates", () => {
    // Chromium prints header/footer templates in a separate document that
    // cannot fetch resources. The service injects the registry @font-face
    // block into each template and pre-activates every face in the main page
    // so the templates can render registry fonts.
    it("returns a valid PDF when templates use a registry font", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/pdf")
        .send({
          html: "<html><body><p style='font-family:TestSans;font-weight:300'>Body</p></body></html>",
          waitForFonts: true,
          displayHeaderFooter: true,
          headerTemplate:
            "<div style=\"font-family:'Test Sans',sans-serif;font-weight:800;font-size:12px;width:100%;text-align:center;\">Header in Test Sans</div>",
          footerTemplate:
            "<div style=\"font-family:'Test Sans',sans-serif;font-size:10px;width:100%;text-align:center;\">Page <span class='pageNumber'></span></div>",
          margin: { top: "120px", bottom: "80px" },
        })
        .expect(200);

      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(Buffer.from(res.body.slice(0, 4)).toString("ascii")).toBe("%PDF");
    });

    it("still renders when user HTML carries broken @font-face sources", async () => {
      // Relative url() sources cannot resolve under setContent; activation
      // must tolerate their load() rejections (Promise.allSettled).
      const res = await request(app.getHttpServer())
        .post("/api/pdf")
        .send({
          html: "<html><head><style>@font-face{font-family:TestSans;src:url(./nope/font.woff2) format('woff2');font-weight:300}</style></head><body><p style='font-family:TestSans;font-weight:300'>Body</p></body></html>",
          waitForFonts: true,
          displayHeaderFooter: true,
          headerTemplate:
            "<div style=\"font-family:'TestSans',sans-serif;font-weight:300;font-size:12px;width:100%;text-align:center;\">Header</div>",
          margin: { top: "120px", bottom: "80px" },
        })
        .expect(200);

      expect(Buffer.from(res.body.slice(0, 4)).toString("ascii")).toBe("%PDF");
    });
  });
});
