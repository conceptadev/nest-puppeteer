import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup.js";

describe("POST /browser-rendering/snapshot", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should return both html and base64 screenshot", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/snapshot")
      .send({ html: "<html><body><h1>Snapshot</h1></body></html>" })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.result.html).toContain("<h1>Snapshot</h1>");
    expect(res.body.result.screenshot).toBeDefined();
    expect(typeof res.body.result.screenshot).toBe("string");
    // Verify it's valid base64
    const buffer = Buffer.from(res.body.result.screenshot, "base64");
    expect(buffer.length).toBeGreaterThan(0);
  });
});
