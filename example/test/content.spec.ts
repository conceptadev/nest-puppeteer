import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup.js";

describe("POST /browser-rendering/content", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should return rendered HTML from html input", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/content")
      .send({ html: "<html><body><h1>Hello World</h1></body></html>" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.result.html).toContain("<h1>Hello World</h1>");
  });

  it("should return rendered HTML from url input", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/content")
      .send({ url: "data:text/html,<h1>From URL</h1>" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.result.html).toContain("<h1>From URL</h1>");
  });

  it("should fail when neither url nor html provided", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/content")
      .send({});

    // Returns error response (400 from ValidationPipe or 500 from service)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("should include X-Browser-Ms-Used header", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/content")
      .send({ html: "<html><body>Test</body></html>" })
      .expect(200);

    expect(res.headers["x-browser-ms-used"]).toBeDefined();
    expect(Number(res.headers["x-browser-ms-used"])).toBeGreaterThanOrEqual(0);
  });
});
