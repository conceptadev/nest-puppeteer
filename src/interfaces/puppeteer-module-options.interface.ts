import type { CanActivate, Type } from "@nestjs/common";
import type { LaunchOptions } from "puppeteer";

import type { CustomAiConfig } from "./json-options.interface.js";

export type PuppeteerFeature =
  | "content"
  | "screenshot"
  | "pdf"
  | "markdown"
  | "snapshot"
  | "scrape"
  | "links"
  | "json"
  | "crawl";

export interface PuppeteerRestOptions {
  /** Route prefix for REST endpoints. Default: 'browser-rendering' */
  prefix?: string;

  /**
   * Which features to expose as REST endpoints.
   * Omit or pass undefined to enable all features.
   */
  features?: PuppeteerFeature[];

  /** Guards to apply to all REST endpoints (e.g. AuthGuard) */
  guards?: (Type<CanActivate> | CanActivate)[];
}

export interface PuppeteerModuleOptions {
  /**
   * Whether this module should launch Chromium.
   *
   * Disabled modules still register `PuppeteerService`, which lets applications keep a stable
   * dependency graph in environments where Chromium is intentionally unavailable. Browser
   * operations reject with `PuppeteerUnavailableError` until the module is enabled.
   *
   * @default true
   */
  enabled?: boolean;

  launchOptions?: LaunchOptions;
  isGlobal?: boolean;

  /**
   * Default AI provider for the /json endpoint.
   * Can be overridden per-request via custom_ai.
   */
  defaultAi?: CustomAiConfig;

  /**
   * REST API endpoint configuration.
   * Omit to disable REST endpoints (service-only mode).
   */
  rest?: PuppeteerRestOptions;

  /**
   * Absolute path to a directory of font files (.woff2, .woff, .ttf, .otf).
   * Filenames must follow `<Family>-<Modifier>.<ext>` (e.g. `AvenirPro-Light.woff2`),
   * or sit in a per-variant subdirectory whose name carries the variant
   * (e.g. `AvenirPro85Heavy/font.woff2`). When set, every HTML render gets a
   * `<style>` block with base64 `@font-face` declarations injected automatically,
   * so HTML can reference these families as if the fonts were installed.
   */
  fontsDir?: string;

  /**
   * Explicit family-name aliases. The parsed family from a filename is always
   * registered; each alias listed here gets its own `@font-face` declaration
   * pointing at the same font data, so HTML can reference any of the names.
   *
   * @example { AvenirPro: 'Avenir Pro' }
   * @example { AvenirPro: ['Avenir Pro', 'avenir-pro'] }
   */
  fontAliases?: Record<string, string | string[]>;

  /**
   * Programmatic alias generator. Receives the parsed family name, returns
   * additional alias(es) (or undefined for none). Composes with `fontAliases`:
   * the final set of names is `{parsed, ...fontAliases[parsed], ...resolver(parsed)}`.
   *
   * Useful for heuristics like CamelCase splitting:
   *   (family) => family.replace(/([a-z])([A-Z])/g, '$1 $2')
   */
  fontAliasResolver?: (family: string) => string | string[] | undefined;
}
