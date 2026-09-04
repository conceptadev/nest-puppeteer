# @concepta/nestjs-puppeteer

Puppeteer provider for NestJS 12 with a high-level API inspired by the [Cloudflare Browser Rendering](https://developers.cloudflare.com/browser-rendering/) REST API.

Requires Node.js 22.18 or newer and an ESM application.

## Features

- **Service layer** -- `PuppeteerService` with 7 Cloudflare-aligned methods
- **REST layer** -- Auto-generated endpoints with configurable prefix, guards, and feature selection
- **Feature modules** -- Standalone modules for individual features (`PdfBrowserModule`, `ScreenshotBrowserModule`, etc.)
- **DI decorators** -- `@InjectBrowser()`, `@InjectContext()`, `@InjectPage()` for direct Puppeteer access
- **Validation** -- DTOs with class-validator, registered via `APP_PIPE`
- **Swagger** -- OpenAPI decorators on all endpoints and DTOs
- **Error handling** -- Cloudflare-format error responses via `APP_FILTER`
- **Testing** -- `createMockPuppeteerProviders()` for unit tests

## Installation

```bash
npm install @concepta/nestjs-puppeteer puppeteer
```

For REST endpoints (optional):

```bash
npm install class-validator class-transformer @nestjs/platform-express @nestjs/swagger
```

## Quick Start

### Service-only (no REST endpoints)

```ts
import { Module } from '@nestjs/common';
import { PuppeteerModule } from '@concepta/nestjs-puppeteer/core';

@Module({
  imports: [PuppeteerModule.forRoot()],
})
export class AppModule {}
```

Then inject the service:

```ts
import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '@concepta/nestjs-puppeteer/core';

@Injectable()
export class ReportService {
  constructor(private readonly puppeteer: PuppeteerService) {}

  async generateInvoice(url: string): Promise<Buffer> {
    return this.puppeteer.pdf({
      url,
      format: 'a4',
      printBackground: true,
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    });
  }

  async getPageContent(url: string): Promise<string> {
    return this.puppeteer.content({
      url,
      waitForSelector: { selector: '#main-content', visible: true },
    });
  }
}
```

### REST API endpoints

Expose Cloudflare-compatible HTTP endpoints:

```ts
import { Module } from '@nestjs/common';
import { PuppeteerModule } from '@concepta/nestjs-puppeteer';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    PuppeteerModule.forRoot({
      headless: true,
      rest: {
        prefix: 'browser-rendering',
        features: ['content', 'screenshot', 'pdf', 'markdown', 'scrape', 'links'],
        guards: [AuthGuard],
      },
    }),
  ],
})
export class AppModule {}
```

This registers:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/browser-rendering/content` | Fetch rendered HTML |
| POST | `/browser-rendering/screenshot` | Capture screenshot (binary) |
| POST | `/browser-rendering/pdf` | Generate PDF (binary) |
| POST | `/browser-rendering/markdown` | Extract Markdown |
| POST | `/browser-rendering/snapshot` | HTML + screenshot in one call |
| POST | `/browser-rendering/scrape` | Scrape elements by CSS selectors |
| POST | `/browser-rendering/links` | Extract all links |

**Request example:**

```bash
curl -X POST http://localhost:3000/browser-rendering/pdf \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com", "format": "a4", "printBackground": true}' \
  --output document.pdf
```

**JSON response format** (content, markdown, scrape, links):

```json
{
  "success": true,
  "result": { "html": "..." }
}
```

**Error response format:**

```json
{
  "success": false,
  "errors": [{ "code": 400, "message": "Either \"url\" or \"html\" must be provided" }]
}
```

### Async configuration

Service-only applications should use the isolated `./core` entry. It does not load the optional
REST, Swagger, validation, or Express dependencies:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PuppeteerModule } from '@concepta/nestjs-puppeteer/core';

@Module({
  imports: [
    PuppeteerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        enabled: config.get('THUMBNAIL_ENABLED', false),
        launchOptions: {
          headless: true,
          executablePath: config.get('CHROME_PATH'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

When `enabled` is false, the module keeps `PuppeteerService` injectable without launching
Chromium. Calling a browser operation in that state rejects with `PuppeteerUnavailableError`.

The root entry adds REST endpoint support:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PuppeteerModule } from '@concepta/nestjs-puppeteer';

@Module({
  imports: [
    PuppeteerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        launchOptions: {
          headless: config.get('PUPPETEER_HEADLESS', true),
          args: config.get('PUPPETEER_ARGS', '').split(',').filter(Boolean),
        },
      }),
      inject: [ConfigService],
      rest: {
        prefix: 'api/browser',
        features: ['pdf', 'screenshot'],
        guards: [AuthGuard],
      },
    }),
  ],
})
export class AppModule {}
```

## Feature Modules

Pre-configured modules for individual features with their own defaults, REST endpoint, and guards.

### Standalone (single-feature app)

```ts
import { Module } from '@nestjs/common';
import { PdfBrowserModule } from '@concepta/nestjs-puppeteer';

@Module({
  imports: [
    PdfBrowserModule.forRoot({
      launchOptions: { headless: true },
      defaults: {
        format: 'a4',
        printBackground: true,
        margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
      },
      prefix: 'api/pdf',  // POST /api/pdf
      guards: [AuthGuard],
    }),
  ],
})
export class AppModule {}
```

### Multi-feature (shared browser)

```ts
import { Module } from '@nestjs/common';
import {
  PuppeteerModule,
  PdfBrowserModule,
  ScreenshotBrowserModule,
  ScrapeBrowserModule,
} from '@concepta/nestjs-puppeteer';

@Module({
  imports: [
    // Shared browser
    PuppeteerModule.forRoot({ headless: true }),

    // Feature modules with individual config
    PdfBrowserModule.register({
      defaults: { format: 'a4', printBackground: true },
      prefix: 'api/pdf',
      guards: [AuthGuard],
    }),
    ScreenshotBrowserModule.register({
      defaults: { fullPage: true, type: 'png' },
      prefix: 'api/screenshot',
      guards: [AuthGuard],
    }),
    ScrapeBrowserModule.register({
      prefix: 'api/scrape',
      guards: [AuthGuard],
    }),
  ],
})
export class AppModule {}
```

### Feature services

Each feature module provides a dedicated service:

| Module | Service | Method |
|--------|---------|--------|
| `PdfBrowserModule` | `PdfBrowserService` | `.generate(options)` |
| `ScreenshotBrowserModule` | `ScreenshotBrowserService` | `.capture(options)` |
| `ContentBrowserModule` | `ContentBrowserService` | `.fetch(options)` |
| `MarkdownBrowserModule` | `MarkdownBrowserService` | `.extract(options)` |
| `SnapshotBrowserModule` | `SnapshotBrowserService` | `.take(options)` |
| `ScrapeBrowserModule` | `ScrapeBrowserService` | `.scrape(options)` |
| `LinksBrowserModule` | `LinksBrowserService` | `.extract(options)` |

Feature services merge module defaults with per-call options:

```ts
@Injectable()
export class InvoiceService {
  constructor(private readonly pdf: PdfBrowserService) {}

  async generate(url: string): Promise<Buffer> {
    // Module defaults (format: a4, margins, etc.) applied automatically
    return this.pdf.generate({ url });
  }

  async generateLandscape(url: string): Promise<Buffer> {
    // Override specific defaults per call
    return this.pdf.generate({ url, landscape: true });
  }
}
```

## Low-level Access

Inject Puppeteer primitives directly:

```ts
import { Injectable } from '@nestjs/common';
import { InjectBrowser, InjectPage } from '@concepta/nestjs-puppeteer';
import { Browser, Page } from 'puppeteer';

@Injectable()
export class CustomService {
  constructor(
    @InjectBrowser() private readonly browser: Browser,
    @InjectPage() private readonly page: Page,
  ) {}

  async doCustomWork() {
    const page = await this.browser.newPage();
    try {
      await page.goto('https://example.com');
      // ... custom puppeteer logic
    } finally {
      await page.close();
    }
  }
}
```

### Named pages with forFeature

```ts
@Module({
  imports: [PuppeteerModule.forFeature(['crawler', 'renderer'])],
})
export class CrawlerModule {}

// Then inject:
@Injectable()
export class CrawlerService {
  constructor(
    @InjectPage('crawler') private readonly crawlerPage: Page,
    @InjectPage('renderer') private readonly rendererPage: Page,
  ) {}
}
```

### Multiple browser instances

```ts
@Module({
  imports: [
    PuppeteerModule.forRoot({ headless: true }, 'chrome'),
    PuppeteerModule.forRoot({ headless: true }, 'stealth'),
  ],
})
export class AppModule {}

// Inject specific instances:
@Injectable()
export class MyService {
  constructor(
    @InjectBrowser('chrome') private readonly chrome: Browser,
    @InjectBrowser('stealth') private readonly stealth: Browser,
  ) {}
}
```

## PuppeteerService API

All methods accept a common set of options plus method-specific fields. Options are flat (not nested) to match the Cloudflare API.

### Common options

```ts
interface CommonBrowserOptions {
  url?: string;                              // URL to navigate to
  html?: string;                             // HTML to render directly
  authenticate?: { username, password };     // HTTP Basic Auth
  cookies?: CookieParam[];                   // Cookies to set
  gotoOptions?: { waitUntil, timeout };      // Navigation behavior
  setExtraHTTPHeaders?: Record<string, string>;
  rejectResourceTypes?: ResourceType[];      // Block resource types
  rejectRequestPattern?: string[];           // Block URL patterns (regex)
  allowResourceTypes?: ResourceType[];       // Allow only these types
  allowRequestPattern?: string[];            // Allow only these patterns
  userAgent?: string;
  waitForSelector?: { selector, timeout?, visible? };
  waitForTimeout?: number;                   // Static delay (ms)
  viewport?: { width, height, deviceScaleFactor };
  addScriptTag?: { url?, content? }[];
  addStyleTag?: { url?, content? }[];
  setJavaScriptEnabled?: boolean;
  emulateMediaType?: string;                 // 'screen' | 'print'
}
```

### content(options)

```ts
const html = await puppeteerService.content({
  url: 'https://example.com',
  waitForSelector: { selector: '#app', visible: true },
});
```

### screenshot(options)

```ts
const buffer = await puppeteerService.screenshot({
  url: 'https://example.com',
  fullPage: true,
  type: 'png',
  quality: 90,            // jpeg/webp only
  omitBackground: true,
  selector: '#chart',     // screenshot a specific element
});
```

### pdf(options)

```ts
const buffer = await puppeteerService.pdf({
  url: 'https://example.com',
  format: 'a4',
  landscape: true,
  printBackground: true,
  scale: 0.8,
  margin: { top: '2cm', bottom: '2cm', left: '1cm', right: '1cm' },
  displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:10px">Header</div>',
  footerTemplate: '<div style="font-size:10px">Page <span class="pageNumber"></span></div>',
});
```

### markdown(options)

```ts
const md = await puppeteerService.markdown({
  url: 'https://example.com/article',
  rejectResourceTypes: ['image', 'stylesheet'],
});
```

### snapshot(options)

```ts
const { html, screenshot } = await puppeteerService.snapshot({
  url: 'https://example.com',
  fullPage: true,
  type: 'jpeg',
  quality: 80,
});
```

### scrape(options)

```ts
const results = await puppeteerService.scrape({
  url: 'https://example.com',
  selectors: ['h1', 'p.intro', 'a[href]'],
});
// results: [{ selector: 'h1', elements: [{ text, html, attributes, width, height, top, left }] }, ...]
```

### links(options)

```ts
const urls = await puppeteerService.links({
  url: 'https://example.com',
  visibleLinksOnly: true,
});
// urls: ['https://example.com/about', 'https://example.com/contact', ...]
```

## Swagger

If `@nestjs/swagger` is installed, all endpoints and DTOs are auto-documented:

```ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const app = await NestFactory.create(AppModule);

const config = new DocumentBuilder()
  .setTitle('Browser Rendering API')
  .setVersion('1.0')
  .build();

SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
await app.listen(3000);
```

## Testing

Use `createMockPuppeteerProviders()` to avoid launching a real browser:

```ts
import { Test } from '@nestjs/testing';
import { createMockPuppeteerProviders, PuppeteerService } from '@concepta/nestjs-puppeteer';

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReportService,
        PuppeteerService,
        ...createMockPuppeteerProviders({
          browser: {
            newPage: jest.fn().mockResolvedValue({
              goto: jest.fn(),
              pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
              content: jest.fn().mockResolvedValue('<html></html>'),
              close: jest.fn(),
              setViewport: jest.fn(),
            }),
          },
        }),
      ],
    }).compile();

    service = module.get(ReportService);
  });
});
```

## Docker

Recommended launch options for containerized environments:

```ts
PuppeteerModule.forRoot({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
})
```

## Releasing

Maintainers: see the [OIDC release process](docs/releasing.md).

## License

MIT
