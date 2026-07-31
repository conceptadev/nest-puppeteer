// Module

// DTOs (require class-validator + class-transformer)
export {
  BrowserRenderingErrorDto,
  BrowserRenderingErrorResponse,
  CommonBrowserDto,
  ContentDto,
  ContentResponse,
  ContentResultDto,
  CrawlDto,
  JsonDto,
  LinksDto,
  LinksResponse,
  MarkdownDto,
  MarkdownResponse,
  MarkdownResultDto,
  PdfDto,
  PdfFileDto,
  ScrapeDto,
  ScrapeResponse,
  ScrapeResultDto,
  ScreenshotDto,
  SnapshotDto,
  SnapshotResponse,
  SnapshotResultDto,
} from "./dto/index.js";
// Feature modules
export {
  type ContentBrowserDefaults,
  type ContentBrowserForRootOptions,
  ContentBrowserModule,
  type ContentBrowserModuleOptions,
  ContentBrowserService,
  type LinksBrowserDefaults,
  type LinksBrowserForRootOptions,
  LinksBrowserModule,
  type LinksBrowserModuleOptions,
  LinksBrowserService,
  type MarkdownBrowserDefaults,
  type MarkdownBrowserForRootOptions,
  MarkdownBrowserModule,
  type MarkdownBrowserModuleOptions,
  MarkdownBrowserService,
  type PdfBrowserForRootOptions,
  PdfBrowserModule,
  type PdfBrowserModuleOptions,
  PdfBrowserService,
  type ScrapeBrowserDefaults,
  type ScrapeBrowserForRootOptions,
  ScrapeBrowserModule,
  type ScrapeBrowserModuleOptions,
  ScrapeBrowserService,
  type ScreenshotBrowserForRootOptions,
  ScreenshotBrowserModule,
  type ScreenshotBrowserModuleOptions,
  ScreenshotBrowserService,
  type SnapshotBrowserForRootOptions,
  SnapshotBrowserModule,
  type SnapshotBrowserModuleOptions,
  SnapshotBrowserService,
} from "./features/index.js";
// Font registry
export {
  type FontConfig,
  FontRegistry,
  parseFontVariant,
} from "./font-registry.service.js";
// Interfaces
export type {
  AuthenticateOptions,
  CommonBrowserOptions,
  ContentOptions,
  CookieParam,
  CrawlFilterOptions,
  CrawlFormat,
  CrawlJobResult,
  CrawlJobStatus,
  CrawlJsonOptions,
  CrawlOptions,
  CrawlPurpose,
  CrawlRecord,
  CrawlRecordMetadata,
  CrawlRecordStatus,
  CrawlSource,
  CustomAiConfig,
  GotoOptions,
  JsonOptions,
  JsonResponseFormat,
  LinksOptions,
  MarkdownOptions,
  PaperFormat,
  PdfGenerationOptions,
  PdfMargin,
  PdfOptions,
  PuppeteerFeature,
  PuppeteerModuleAsyncOptions,
  PuppeteerModuleOptions,
  PuppeteerOptionsFactory,
  PuppeteerRestOptions,
  ResourceType,
  ScrapedElement,
  ScrapeOptions,
  ScrapeResult,
  ScreenshotImageOptions,
  ScreenshotOptions,
  ScriptTagOptions,
  SnapshotOptions,
  SnapshotResult,
  StyleTagOptions,
  ViewportOptions,
  WaitForSelectorOptions,
} from "./interfaces/index.js";
// Constants
export {
  ALL_FEATURES,
  DEFAULT_CHROME_LAUNCH_OPTIONS,
  DEFAULT_PUPPETEER_INSTANCE_NAME,
  FEATURE_KEY,
  PUPPETEER_DEFAULT_AI,
  PUPPETEER_FONT_CONFIG,
  PUPPETEER_INSTANCE_NAME,
  PUPPETEER_MODULE_OPTIONS,
  PUPPETEER_REST_OPTIONS,
} from "./puppeteer.constants.js";

// Controller
export { createPuppeteerController } from "./puppeteer.controller.js";
export { InjectBrowser, InjectContext, InjectPage } from "./puppeteer.decorators.js";
export { PuppeteerModule } from "./puppeteer.module.js";
// Providers
export { createPuppeteerProviders } from "./puppeteer.providers.js";
// Service
export { PuppeteerService } from "./puppeteer.service.js";
// Testing
export {
  createMockPuppeteerProviders,
  type MockPuppeteerOptions,
} from "./puppeteer.testing.js";
// Utils
export { getBrowserToken, getContextToken, getPageToken } from "./puppeteer.util.js";
export { PuppeteerCoreModule } from "./puppeteer-core.module.js";
export { CrawlService } from "./puppeteer-crawl.service.js";
export { BrowserRenderingExceptionFilter } from "./puppeteer-exception.filter.js";
// Guards, Interceptors, Filters & Decorators
export { Feature, PuppeteerFeatureGuard } from "./puppeteer-feature.guard.js";
export { BrowserRenderingInterceptor, ResultKey } from "./puppeteer-response.interceptor.js";
export { PuppeteerUnavailableError } from "./puppeteer-unavailable.error.js";
