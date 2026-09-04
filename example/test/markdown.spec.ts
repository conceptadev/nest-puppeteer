import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup.js";

describe("POST /browser-rendering/markdown", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should extract markdown from HTML", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/markdown")
      .send({
        html: `<html><body>
          <h1>Title</h1>
          <p>A paragraph with <strong>bold</strong> and <em>italic</em>.</p>
          <ul><li>Item 1</li><li>Item 2</li></ul>
          <a href="https://example.com">Link</a>
        </body></html>`,
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.result.markdown).toContain("# Title");
    expect(res.body.result.markdown).toContain("**bold**");
    expect(res.body.result.markdown).toContain("*italic*");
    expect(res.body.result.markdown).toContain("[Link](https://example.com)");
  });
});
