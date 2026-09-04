# Low-level Access

For cases where `PuppeteerService` methods aren't enough, inject Puppeteer primitives directly.

## Decorators

| Decorator | Injects | Scope |
|-----------|---------|-------|
| `@InjectBrowser()` | `Browser` | Singleton per instance |
| `@InjectContext()` | `BrowserContext` | Singleton per instance |
| `@InjectPage()` | `Page` | Singleton per instance |

## Injecting the Browser

```ts
import { Injectable } from '@nestjs/common';
import { InjectBrowser } from '@concepta/puppeteer-nest';
import { Browser } from 'puppeteer';

@Injectable()
export class CrawlerService {
  constructor(@InjectBrowser() private readonly browser: Browser) {}

  async crawl(url: string) {
    const page = await this.browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle2' });
      const title = await page.title();
      const content = await page.content();
      return { title, content };
    } finally {
      await page.close();
    }
  }
}
```

## Injecting a Page

The default page is a singleton created at module init:

```ts
import { Injectable } from '@nestjs/common';
import { InjectPage } from '@concepta/puppeteer-nest';
import { Page } from 'puppeteer';

@Injectable()
export class MonitorService {
  constructor(@InjectPage() private readonly page: Page) {}

  async checkStatus(url: string): Promise<number> {
    const response = await this.page.goto(url);
    return response?.status() ?? 0;
  }
}
```

> **Warning:** The singleton page is shared. If multiple requests use it concurrently, they'll interfere. For concurrent use, inject `Browser` and create pages per request.

## Named Pages with forFeature

Register named page singletons for specific use cases:

```ts
@Module({
  imports: [
    PuppeteerModule.forRoot(),
    PuppeteerModule.forFeature(['crawler', 'renderer', 'checker']),
  ],
})
export class AppModule {}
```

Inject by name:

```ts
@Injectable()
export class MultiPageService {
  constructor(
    @InjectPage('crawler') private readonly crawlerPage: Page,
    @InjectPage('renderer') private readonly rendererPage: Page,
    @InjectPage('checker') private readonly checkerPage: Page,
  ) {}
}
```

## Multiple Browser Instances

Run separate browser instances with different configurations:

```ts
@Module({
  imports: [
    PuppeteerModule.forRoot({ headless: true }, 'default'),
    PuppeteerModule.forRoot({
      headless: true,
      args: ['--proxy-server=socks5://proxy:1080'],
    }, 'proxied'),
  ],
})
export class AppModule {}
```

Inject by name:

```ts
@Injectable()
export class MultiBrowserService {
  constructor(
    @InjectBrowser('default') private readonly browser: Browser,
    @InjectBrowser('proxied') private readonly proxiedBrowser: Browser,
  ) {}

  async fetchViaProxy(url: string) {
    const page = await this.proxiedBrowser.newPage();
    try {
      await page.goto(url);
      return page.content();
    } finally {
      await page.close();
    }
  }
}
```

## Named Pages on Named Browsers

Use `forFeature` with a specific browser instance:

```ts
PuppeteerModule.forFeature(['scraper'], 'proxied')
```

## Token Utilities

For advanced use (custom providers, testing), use the token generators:

```ts
import { getBrowserToken, getContextToken, getPageToken } from '@concepta/puppeteer-nest';

getBrowserToken()            // 'DefaultPuppeteerBrowser'
getBrowserToken('proxied')   // 'proxiedBrowser'
getContextToken()            // 'DefaultPuppeteerContext'
getPageToken('crawler')      // 'crawlerPage'
```
