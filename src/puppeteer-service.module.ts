import {
  type DynamicModule,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleDestroy,
  type Provider,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer";

import { type FontConfig, FontRegistry } from "./font-registry.service.js";
import type {
  PuppeteerModuleAsyncOptions,
  PuppeteerModuleOptions,
  PuppeteerOptionsFactory,
} from "./interfaces/index.js";
import {
  DEFAULT_CHROME_LAUNCH_OPTIONS,
  DEFAULT_PUPPETEER_INSTANCE_NAME,
  PUPPETEER_DEFAULT_AI,
  PUPPETEER_FONT_CONFIG,
  PUPPETEER_INSTANCE_NAME,
  PUPPETEER_MODULE_OPTIONS,
} from "./puppeteer.constants.js";
import { PuppeteerService } from "./puppeteer.service.js";
import { getBrowserToken } from "./puppeteer.util.js";

const buildFontConfig = (
  dir?: string,
  aliases?: Record<string, string | string[]>,
  aliasResolver?: (family: string) => string | string[] | undefined,
): FontConfig | null => (dir || aliases || aliasResolver ? { dir, aliases, aliasResolver } : null);

function mergeLaunchOptions(userOptions?: LaunchOptions): LaunchOptions {
  if (!userOptions) {
    return DEFAULT_CHROME_LAUNCH_OPTIONS;
  }

  const { args: userArgs, ignoreDefaultArgs, ...restUserOptions } = userOptions;
  const defaultArgs = DEFAULT_CHROME_LAUNCH_OPTIONS.args ?? [];

  let mergedArgs: string[];
  if (ignoreDefaultArgs === true) {
    mergedArgs = userArgs ?? [];
  } else if (Array.isArray(ignoreDefaultArgs)) {
    const filteredDefaults = defaultArgs.filter((arg) => !ignoreDefaultArgs.includes(arg));
    mergedArgs = userArgs ? [...new Set([...filteredDefaults, ...userArgs])] : filteredDefaults;
  } else {
    mergedArgs = userArgs ? [...new Set([...defaultArgs, ...userArgs])] : [...defaultArgs];
  }

  return {
    ...DEFAULT_CHROME_LAUNCH_OPTIONS,
    ...restUserOptions,
    args: mergedArgs,
  };
}

/**
 * Service-only Puppeteer integration. It deliberately has no dependency on Swagger, validation,
 * Express, controllers, or the default singleton page/context providers.
 */
@Module({})
export class PuppeteerServiceModule implements OnApplicationShutdown, OnModuleDestroy {
  private readonly logger = new Logger("PuppeteerModule");
  private shutdownPromise: Promise<void> | undefined;

  constructor(
    @Inject(PUPPETEER_INSTANCE_NAME)
    private readonly instanceName: string,
    private readonly moduleRef: ModuleRef,
  ) {}

  onApplicationShutdown(): Promise<void> {
    return this.closeBrowser();
  }

  onModuleDestroy(): Promise<void> {
    return this.closeBrowser();
  }

  static forRoot(
    options: PuppeteerModuleOptions = {},
    instanceName: string = DEFAULT_PUPPETEER_INSTANCE_NAME,
  ): DynamicModule {
    const providers = PuppeteerServiceModule.createProviders(instanceName, options);

    return {
      module: PuppeteerServiceModule,
      global: options.isGlobal ?? true,
      providers,
      exports: providers,
    };
  }

  static forRootAsync(options: PuppeteerModuleAsyncOptions): DynamicModule {
    const instanceName = options.instanceName ?? DEFAULT_PUPPETEER_INSTANCE_NAME;
    const asyncProviders = PuppeteerServiceModule.createAsyncProviders(options);
    const providers: Provider[] = [
      ...asyncProviders,
      {
        provide: PUPPETEER_INSTANCE_NAME,
        useValue: instanceName,
      },
      {
        provide: PUPPETEER_DEFAULT_AI,
        useFactory: (resolved: PuppeteerModuleOptions) => resolved.defaultAi ?? null,
        inject: [PUPPETEER_MODULE_OPTIONS],
      },
      {
        provide: PUPPETEER_FONT_CONFIG,
        useFactory: (resolved: PuppeteerModuleOptions) =>
          buildFontConfig(resolved.fontsDir, resolved.fontAliases, resolved.fontAliasResolver),
        inject: [PUPPETEER_MODULE_OPTIONS],
      },
      {
        provide: getBrowserToken(instanceName),
        async useFactory(resolved: PuppeteerModuleOptions) {
          if (resolved.enabled === false) return null;
          return puppeteer.launch(mergeLaunchOptions(resolved.launchOptions));
        },
        inject: [PUPPETEER_MODULE_OPTIONS],
      },
      FontRegistry,
      PuppeteerService,
    ];

    return {
      module: PuppeteerServiceModule,
      global: options.isGlobal ?? true,
      imports: options.imports,
      providers,
      exports: providers.filter((provider) => !asyncProviders.includes(provider)),
    };
  }

  private static createProviders(
    instanceName: string,
    options: PuppeteerModuleOptions,
  ): Provider[] {
    return [
      {
        provide: PUPPETEER_INSTANCE_NAME,
        useValue: instanceName,
      },
      {
        provide: PUPPETEER_DEFAULT_AI,
        useValue: options.defaultAi ?? null,
      },
      {
        provide: PUPPETEER_FONT_CONFIG,
        useValue: buildFontConfig(options.fontsDir, options.fontAliases, options.fontAliasResolver),
      },
      {
        provide: getBrowserToken(instanceName),
        async useFactory() {
          if (options.enabled === false) return null;
          return puppeteer.launch(mergeLaunchOptions(options.launchOptions));
        },
      },
      FontRegistry,
      PuppeteerService,
    ];
  }

  private static createAsyncProviders(options: PuppeteerModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: PUPPETEER_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: PUPPETEER_MODULE_OPTIONS,
          async useFactory(optionsFactory: PuppeteerOptionsFactory) {
            return optionsFactory.createPuppeteerOptions();
          },
          inject: [options.useExisting],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: PUPPETEER_MODULE_OPTIONS,
          async useFactory(optionsFactory: PuppeteerOptionsFactory) {
            return optionsFactory.createPuppeteerOptions();
          },
          inject: [options.useClass],
        },
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    throw new Error("Invalid PuppeteerModule async options");
  }

  private closeBrowser(): Promise<void> {
    this.shutdownPromise ??= this.closeBrowserOnce();
    return this.shutdownPromise;
  }

  private async closeBrowserOnce(): Promise<void> {
    const browser = this.moduleRef.get<Browser | null>(getBrowserToken(this.instanceName), {
      strict: false,
    });

    try {
      if (browser?.connected) {
        this.logger.log("Closing browser...");
        await browser.close();
      }
    } catch (error) {
      this.logger.error(
        `Failed to close browser: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
