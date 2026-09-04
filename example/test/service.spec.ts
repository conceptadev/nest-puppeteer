import { Test } from "@nestjs/testing";
import {
  PuppeteerModule,
  PuppeteerService,
  PdfBrowserService,
  PdfBrowserModule,
} from "puppeteer-nest";

describe("PuppeteerService (direct injection)", () => {
  let service: PuppeteerService;
  let moduleRef: any;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        PuppeteerModule.forRoot({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        }),
      ],
    }).compile();

    service = moduleRef.get(PuppeteerService);
  }, 30000);

  afterAll(async () => {
    await moduleRef?.close();
  });

  it("should fetch content", async () => {
    const html = await service.content({
      html: "<html><body><p>Direct service call</p></body></html>",
    });
    expect(html).toContain("<p>Direct service call</p>");
  });

  it("should generate a PDF", async () => {
    const buffer = await service.pdf({
      html: "<html><body><h1>PDF</h1></body></html>",
      format: "a4",
    });
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(buffer.slice(0, 4)).toString("ascii")).toBe("%PDF");
  });

  it("should take a screenshot", async () => {
    const buffer = await service.screenshot({
      html: "<html><body><h1>Shot</h1></body></html>",
      type: "png",
    });
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer[0]).toBe(0x89); // PNG magic
  });

  it("should extract markdown", async () => {
    const md = await service.markdown({
      html: "<html><body><h1>Hello</h1><p>World</p></body></html>",
    });
    expect(md).toContain("# Hello");
    expect(md).toContain("World");
  });

  it("should scrape elements", async () => {
    const results = await service.scrape({
      html: '<html><body><div class="item">A</div><div class="item">B</div></body></html>',
      selectors: [".item"],
    });
    expect(results).toHaveLength(1);
    expect(results[0].elements).toHaveLength(2);
    expect(results[0].elements[0].text).toBe("A");
    expect(results[0].elements[1].text).toBe("B");
  });

  it("should extract links", async () => {
    const urls = await service.links({
      html: '<html><body><a href="https://a.com">A</a><a href="https://b.com">B</a></body></html>',
    });
    expect(urls).toContain("https://a.com/");
    expect(urls).toContain("https://b.com/");
  });

  it("should take a snapshot", async () => {
    const result = await service.snapshot({
      html: "<html><body><h1>Snap</h1></body></html>",
    });
    expect(result.html).toContain("<h1>Snap</h1>");
    expect(result.screenshot).toBeInstanceOf(Uint8Array);
  });

  it("should throw when neither url nor html provided", async () => {
    await expect(service.content({} as any)).rejects.toThrow(
      'Either "url" or "html" must be provided',
    );
  });
});

describe("PdfBrowserService (feature module)", () => {
  let pdfService: PdfBrowserService;
  let moduleRef: any;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        PuppeteerModule.forRoot({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        }),
        PdfBrowserModule.register({
          defaults: { format: "a4", printBackground: true },
        }),
      ],
    }).compile();

    pdfService = moduleRef.get(PdfBrowserService);
  }, 30000);

  afterAll(async () => {
    await moduleRef?.close();
  });

  it("should generate PDF with module defaults", async () => {
    const buffer = await pdfService.generate({
      html: "<html><body style='background:red'><h1>Red PDF</h1></body></html>",
    });
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(buffer.slice(0, 4)).toString("ascii")).toBe("%PDF");
  });
});
