import type { Provider } from "@nestjs/common";
import type { BrowserContext } from "puppeteer";

import { DEFAULT_PUPPETEER_INSTANCE_NAME } from "./puppeteer.constants.js";
import { getContextToken, getPageToken } from "./puppeteer.util.js";

export function createPuppeteerProviders(
  instanceName: string = DEFAULT_PUPPETEER_INSTANCE_NAME,
  pages: string[] = [],
): Provider[] {
  return pages.map((page) => ({
    provide: getPageToken(page),
    useFactory: (context: BrowserContext | null) => context?.newPage() ?? null,
    inject: [getContextToken(instanceName)],
  }));
}
