import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup.js";

describe("POST /browser-rendering/screenshot", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should return a JPEG image by default", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/screenshot")
      .send({ html: "<html><body><h1>Screenshot</h1></body></html>" })
      .expect(200);

    expect(res.headers["content-type"]).toContain("image/jpeg");
    expect(res.body).toBeInstanceOf(Uint8Array);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("should return a PNG when type is specified", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/screenshot")
      .send({
        html: "<html><body><h1>PNG</h1></body></html>",
        type: "png",
      })
      .expect(200);

    expect(res.headers["content-type"]).toContain("image/png");
    // PNG magic bytes
    expect(res.body[0]).toBe(0x89);
    expect(res.body[1]).toBe(0x50); // P
    expect(res.body[2]).toBe(0x4e); // N
    expect(res.body[3]).toBe(0x47); // G
  });
});

describe("POST /api/screenshot (feature module)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should use feature module defaults (fullPage: true, type: png)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/screenshot")
      .send({ html: "<html><body style='height:2000px'><h1>Tall Page</h1></body></html>" })
      .expect(200);

    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.body.length).toBeGreaterThan(0);
  });
});
