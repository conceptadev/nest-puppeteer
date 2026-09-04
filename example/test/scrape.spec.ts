import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup.js";

describe("POST /browser-rendering/scrape", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should scrape elements by selectors", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/scrape")
      .send({
        html: `<html><body>
          <h1>Main Title</h1>
          <p class="intro">First paragraph</p>
          <p class="intro">Second paragraph</p>
        </body></html>`,
        selectors: ["h1", "p.intro"],
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    const results = res.body.result.results;
    expect(results).toHaveLength(2);

    // h1
    expect(results[0].selector).toBe("h1");
    expect(results[0].elements).toHaveLength(1);
    expect(results[0].elements[0].text).toBe("Main Title");

    // p.intro
    expect(results[1].selector).toBe("p.intro");
    expect(results[1].elements).toHaveLength(2);
    expect(results[1].elements[0].text).toBe("First paragraph");
    expect(results[1].elements[1].text).toBe("Second paragraph");
  });

  it("should return empty results for empty selectors", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/scrape")
      .send({
        html: "<html><body></body></html>",
        selectors: [],
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.result.results).toHaveLength(0);
  });
});
