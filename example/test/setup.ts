import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module.js";

/**
 * Creates and initializes a NestJS test app.
 * The PuppeteerModule registers APP_PIPE, APP_INTERCEPTOR, and APP_FILTER
 * automatically when REST is enabled — no manual setup needed.
 */
export async function createTestApp(): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  await app.init();
  return app;
}
