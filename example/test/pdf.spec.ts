import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./setup.js";

describe("POST /browser-rendering/pdf", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should return a PDF binary", async () => {
    const res = await request(app.getHttpServer())
      .post("/browser-rendering/pdf")
      .send({
        html: "<html><body><h1>PDF Test</h1></body></html>",
        format: "a4",
      })
      .expect(200);

    expect(res.headers["content-type"]).toContain("application/pdf");
    // PDF magic bytes: %PDF
    const pdfHeader = Buffer.from(res.body.slice(0, 4)).toString("ascii");
    expect(pdfHeader).toBe("%PDF");
  });
});

describe("POST /api/pdf (feature module)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("should use feature module defaults (format: a4, printBackground: true)", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/pdf")
      .send({ html: "<html><body style='background:blue'><h1>Blue</h1></body></html>" })
      .expect(200);

    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.from(res.body.slice(0, 4)).toString("ascii")).toBe("%PDF");
  });
});
