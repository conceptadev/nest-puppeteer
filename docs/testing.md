# Testing

## Mock Providers

Use `createMockPuppeteerProviders()` to avoid launching a real browser in unit tests:

```ts
import { Test } from '@nestjs/testing';
import {
  createMockPuppeteerProviders,
  PuppeteerService,
} from 'puppeteer-nest';

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  let mockNewPage: jest.Mock;

  beforeEach(async () => {
    const mockPage = {
      goto: jest.fn().mockResolvedValue({ status: () => 200 }),
      pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
      content: jest.fn().mockResolvedValue('<html><body>Hello</body></html>'),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('PNG')),
      close: jest.fn(),
      setViewport: jest.fn(),
      setUserAgent: jest.fn(),
      setExtraHTTPHeaders: jest.fn(),
      setContent: jest.fn(),
      evaluate: jest.fn().mockResolvedValue('# Hello'),
      $$eval: jest.fn().mockResolvedValue([]),
      $: jest.fn(),
      authenticate: jest.fn(),
      setCookie: jest.fn(),
      setRequestInterception: jest.fn(),
      setJavaScriptEnabled: jest.fn(),
      emulateMediaType: jest.fn(),
      addScriptTag: jest.fn(),
      addStyleTag: jest.fn(),
      waitForSelector: jest.fn(),
      on: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
    };

    mockNewPage = jest.fn().mockResolvedValue(mockPage);

    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        PuppeteerService,
        ...createMockPuppeteerProviders({
          browser: { newPage: mockNewPage } as any,
        }),
      ],
    }).compile();

    invoiceService = module.get(InvoiceService);
  });

  it('should generate a PDF', async () => {
    const result = await invoiceService.generate('https://example.com/invoice');
    expect(result).toBeInstanceOf(Buffer);
    expect(mockNewPage).toHaveBeenCalled();
  });
});
```

## Mock Options

```ts
interface MockPuppeteerOptions {
  instanceName?: string;          // Match the named instance
  browser?: Partial<Browser>;     // Mock browser
  context?: Partial<BrowserContext>;  // Mock context
  page?: Partial<Page>;           // Mock page
}
```

### Named instance mocks

```ts
createMockPuppeteerProviders({
  instanceName: 'proxied',
  browser: { newPage: mockNewPage } as any,
})
```

## Testing Feature Services

```ts
import { Test } from '@nestjs/testing';
import {
  PdfBrowserService,
  PuppeteerService,
  createMockPuppeteerProviders,
} from 'puppeteer-nest';

describe('PdfBrowserService', () => {
  let pdfService: PdfBrowserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PuppeteerService,
        {
          provide: 'PdfBrowserDefaults',
          useValue: { format: 'a4', printBackground: true },
        },
        PdfBrowserService,
        ...createMockPuppeteerProviders({
          browser: { newPage: jest.fn().mockResolvedValue(mockPage) } as any,
        }),
      ],
    }).compile();

    pdfService = module.get(PdfBrowserService);
  });
});
```

## E2E Testing

For integration tests that need a real browser:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PuppeteerModule } from 'puppeteer-nest';

describe('Browser Rendering API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        PuppeteerModule.forRoot({
          headless: true,
          rest: {
            prefix: 'browser-rendering',
          },
        }),
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('POST /browser-rendering/content', () => {
    return request(app.getHttpServer())
      .post('/browser-rendering/content')
      .send({ html: '<html><body><h1>Test</h1></body></html>' })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.result.html).toContain('<h1>Test</h1>');
      });
  });

  it('POST /browser-rendering/links', () => {
    return request(app.getHttpServer())
      .post('/browser-rendering/links')
      .send({ html: '<a href="https://example.com">Link</a>' })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.result).toContain('https://example.com/');
      });
  });
});
```
