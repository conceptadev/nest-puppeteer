import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Module } from "@nestjs/common";
import {
  PuppeteerModule,
  PdfBrowserModule,
  ScreenshotBrowserModule,
} from "@concepta/puppeteer-nest";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));

@Module({
  imports: [
    PuppeteerModule.forRoot({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      fontsDir: join(currentDirectory, "..", "test-fonts"),
      fontAliases: { TestSans: "Test Sans" },
      rest: {
        prefix: "browser-rendering",
        features: [
          "content",
          "screenshot",
          "pdf",
          "markdown",
          "snapshot",
          "scrape",
          "links",
        ],
      },
    }),

    PdfBrowserModule.register({
      defaults: { format: "a4", printBackground: true },
      prefix: "api/pdf",
    }),

    ScreenshotBrowserModule.register({
      defaults: { fullPage: true, type: "png" },
      prefix: "api/screenshot",
    }),
  ],
})
export class AppModule {}
