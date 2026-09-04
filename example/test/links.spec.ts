import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup.js";

describe("POST /browser-rendering/links", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should extract all links", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/links")
      .send({
        html: `<html><body>
          <a href="https://example.com/page1">Page 1</a>
          <a href="https://example.com/page2">Page 2</a>
          <a href="https://example.com/page1">Duplicate</a>
        </body></html>`,
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.result).toContain("https://example.com/page1");
    expect(res.body.result).toContain("https://example.com/page2");
    // Duplicates should be removed
    expect(res.body.result.length).toBe(2);
  });

  it("should filter by visibleLinksOnly", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/links")
      .send({
        html: `<html><body>
          <a href="https://example.com/visible">Visible</a>
          <a href="https://example.com/hidden" style="display:none">Hidden</a>
        </body></html>`,
        visibleLinksOnly: true,
      })
      .expect(200);

    expect(res.body.result).toContain("https://example.com/visible");
    expect(res.body.result).not.toContain("https://example.com/hidden");
  });
});
