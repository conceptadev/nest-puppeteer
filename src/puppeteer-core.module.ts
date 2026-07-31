import {
  type DynamicModule,
  Module,
  type Provider,
  type Type,
  ValidationPipe,
} from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import type { Browser, BrowserContext, LaunchOptions } from "puppeteer";

import type {
  CustomAiConfig,
  PuppeteerModuleAsyncOptions,
  PuppeteerRestOptions,
} from "./interfaces/index.js";
import { DEFAULT_PUPPETEER_INSTANCE_NAME, PUPPETEER_REST_OPTIONS } from "./puppeteer.constants.js";
import { createPuppeteerController } from "./puppeteer.controller.js";
import { getBrowserToken, getContextToken, getPageToken } from "./puppeteer.util.js";
import { CrawlService } from "./puppeteer-crawl.service.js";
import { BrowserRenderingExceptionFilter } from "./puppeteer-exception.filter.js";
import { PuppeteerFeatureGuard } from "./puppeteer-feature.guard.js";
import { BrowserRenderingInterceptor } from "./puppeteer-response.interceptor.js";
import { PuppeteerServiceModule } from "./puppeteer-service.module.js";

function buildRestProviders(restOptions: PuppeteerRestOptions): {
  controllers: Type[];
  providers: Provider[];
} {
  const ControllerClass = createPuppeteerController(
    restOptions.prefix ?? "browser-rendering",
    restOptions.guards ?? [],
  );

  return {
    controllers: [ControllerClass],
    providers: [
      {
        provide: PUPPETEER_REST_OPTIONS,
        useValue: restOptions,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: BrowserRenderingInterceptor,
      },
      {
        provide: APP_FILTER,
        useClass: BrowserRenderingExceptionFilter,
      },
      {
        provide: APP_PIPE,
        useValue: new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: false,
          skipUndefinedProperties: false,
          transformOptions: {
            exposeDefaultValues: true,
            enableImplicitConversion: true,
          },
        }),
      },
      PuppeteerFeatureGuard,
      CrawlService,
    ],
  };
}

function createLowLevelProviders(instanceName: string): Provider[] {
  return [
    {
      provide: getContextToken(instanceName),
      async useFactory(browser: Browser | null) {
        if (!browser) return null;
        return browser.createBrowserContext();
      },
      inject: [getBrowserToken(instanceName)],
    },
    {
      provide: getPageToken(instanceName),
      async useFactory(context: BrowserContext | null) {
        if (!context) return null;
        return context.newPage();
      },
      inject: [getContextToken(instanceName)],
    },
  ];
}

@Module({})
export class PuppeteerCoreModule {
  static forRoot(
    launchOptions?: LaunchOptions,
    instanceName: string = DEFAULT_PUPPETEER_INSTANCE_NAME,
    restOptions?: PuppeteerRestOptions,
    defaultAi?: CustomAiConfig,
    fontsDir?: string,
    fontAliases?: Record<string, string | string[]>,
    fontAliasResolver?: (family: string) => string | string[] | undefined,
    enabled: boolean = true,
    isGlobal: boolean = true,
  ): DynamicModule {
    const serviceModule = PuppeteerServiceModule.forRoot(
      {
        enabled,
        launchOptions,
        defaultAi,
        fontsDir,
        fontAliases,
        fontAliasResolver,
        isGlobal,
      },
      instanceName,
    );
    const lowLevelProviders = createLowLevelProviders(instanceName);
    const rest = restOptions ? buildRestProviders(restOptions) : null;

    return {
      module: PuppeteerCoreModule,
      imports: [serviceModule],
      controllers: rest?.controllers ?? [],
      providers: [...lowLevelProviders, ...(rest?.providers ?? [])],
      exports: [serviceModule, ...lowLevelProviders],
    };
  }

  static forRootAsync(options: PuppeteerModuleAsyncOptions): DynamicModule {
    const instanceName = options.instanceName ?? DEFAULT_PUPPETEER_INSTANCE_NAME;
    const serviceModule = PuppeteerServiceModule.forRootAsync(options);
    const lowLevelProviders = createLowLevelProviders(instanceName);
    const rest = options.rest ? buildRestProviders(options.rest) : null;

    return {
      module: PuppeteerCoreModule,
      imports: [serviceModule],
      controllers: rest?.controllers ?? [],
      providers: [...lowLevelProviders, ...(rest?.providers ?? [])],
      exports: [serviceModule, ...lowLevelProviders],
    };
  }
}
