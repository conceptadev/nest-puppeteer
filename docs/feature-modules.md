# Feature Modules

Pre-configured modules for individual features. Each provides a dedicated service with module-level defaults, optional REST endpoint, and guards.

## Available Modules

| Module | Service | Method | Defaults Type |
|--------|---------|--------|---------------|
| `PdfBrowserModule` | `PdfBrowserService` | `.generate(opts)` | `PdfGenerationOptions` |
| `ScreenshotBrowserModule` | `ScreenshotBrowserService` | `.capture(opts)` | `ScreenshotImageOptions` |
| `ContentBrowserModule` | `ContentBrowserService` | `.fetch(opts)` | Navigation options |
| `MarkdownBrowserModule` | `MarkdownBrowserService` | `.extract(opts)` | Navigation options |
| `SnapshotBrowserModule` | `SnapshotBrowserService` | `.take(opts)` | `ScreenshotImageOptions` |
| `ScrapeBrowserModule` | `ScrapeBrowserService` | `.scrape(opts)` | Navigation options |
| `LinksBrowserModule` | `LinksBrowserService` | `.extract(opts)` | Navigation options |

## Registration Patterns

### Standalone (`forRoot`)

Use when this is the only Puppeteer feature in your app. Launches the browser internally.

```ts
import { Module } from '@nestjs/common';
import { PdfBrowserModule } from 'puppeteer-nest';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    PdfBrowserModule.forRoot({
      // Puppeteer launch options
      launchOptions: { headless: true },

      // PDF defaults (applied to every .generate() call)
      defaults: {
        format: 'a4',
        printBackground: true,
        margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
      },

      // REST endpoint (optional, omit for service-only)
      prefix: 'api/pdf',     // POST /api/pdf
      guards: [AuthGuard],
    }),
  ],
})
export class AppModule {}
```

### Shared browser (`register`)

Use when multiple features share one browser via `PuppeteerModule.forRoot()`.

```ts
@Module({
  imports: [
    // Shared browser instance
    PuppeteerModule.forRoot({ headless: true }),

    // Individual features
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

### Service-only (no REST)

Omit `prefix` to skip the REST endpoint:

```ts
PdfBrowserModule.register({
  defaults: { format: 'a4', printBackground: true },
  // no prefix → no HTTP endpoint
})
```

## Using Feature Services

```ts
import { Injectable } from '@nestjs/common';
import { PdfBrowserService } from 'puppeteer-nest';

@Injectable()
export class InvoiceService {
  constructor(private readonly pdf: PdfBrowserService) {}

  async generate(invoiceUrl: string): Promise<Buffer> {
    // Module defaults (format: a4, margins, etc.) are applied automatically.
    // Only provide what's specific to this call.
    return this.pdf.generate({ url: invoiceUrl });
  }

  async generateLandscape(invoiceUrl: string): Promise<Buffer> {
    // Per-call options override module defaults
    return this.pdf.generate({
      url: invoiceUrl,
      landscape: true,
      scale: 0.8,
    });
  }
}
```

## Default Merging

Module defaults are merged with per-call options using a shallow spread. Per-call options take precedence:

```ts
// Module defaults
{ format: 'a4', printBackground: true, margin: { top: '1cm', bottom: '1cm' } }

// Per-call options
{ url: 'https://...', landscape: true, margin: { top: '2cm' } }

// Merged result
{ url: 'https://...', format: 'a4', printBackground: true, landscape: true, margin: { top: '2cm' } }
```

> Note: nested objects like `margin` are **replaced entirely** by the per-call value, not deep-merged. If you provide `margin: { top: '2cm' }`, the default `bottom` is lost. Provide the full margin object when overriding.

## Feature REST Endpoints

When `prefix` is provided, each feature module registers a single `POST /` endpoint at that path:

```
PdfBrowserModule.register({ prefix: 'api/pdf' })
→ POST /api/pdf

ScreenshotBrowserModule.register({ prefix: 'api/screenshot' })
→ POST /api/screenshot
```

The endpoint uses the same request body as the corresponding `PuppeteerService` method, and responses follow the Cloudflare format (`{ success, result }` for JSON, binary for screenshot/pdf).

## Feature Module Options

All feature modules share this base configuration:

```ts
interface FeatureBrowserModuleOptions {
  defaults?: /* feature-specific defaults type */;
  prefix?: string;                                    // REST endpoint path
  guards?: (Type<CanActivate> | CanActivate)[];       // Guards for REST
}

interface FeatureBrowserForRootOptions extends FeatureBrowserModuleOptions {
  launchOptions?: LaunchOptions;  // Puppeteer launch options
  isGlobal?: boolean;
}
```

## Full Example: Multi-feature App

```ts
import { Module } from '@nestjs/common';
import {
  PuppeteerModule,
  PdfBrowserModule,
  ScreenshotBrowserModule,
  ContentBrowserModule,
  ScrapeBrowserModule,
} from 'puppeteer-nest';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    PuppeteerModule.forRoot({ headless: true }),

    PdfBrowserModule.register({
      defaults: {
        format: 'a4',
        printBackground: true,
        margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
      },
      prefix: 'api/pdf',
      guards: [AuthGuard],
    }),

    ScreenshotBrowserModule.register({
      defaults: { fullPage: true, type: 'png' },
      prefix: 'api/screenshot',
      guards: [AuthGuard],
    }),

    ContentBrowserModule.register({
      defaults: {
        gotoOptions: { waitUntil: 'networkidle0' },
        rejectResourceTypes: ['image', 'font'],
      },
      // No prefix — service-only, no REST
    }),

    ScrapeBrowserModule.register({
      defaults: {
        gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
      },
      prefix: 'api/scrape',
      guards: [AuthGuard],
    }),
  ],
})
export class AppModule {}
```
