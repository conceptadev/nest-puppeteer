import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { Browser, HTTPRequest, Page } from "puppeteer";
import { FontRegistry } from "./font-registry.service.js";
import type { CommonBrowserOptions } from "./interfaces/common-options.interface.js";
import type { ContentOptions } from "./interfaces/content-options.interface.js";
import type { CustomAiConfig, JsonOptions } from "./interfaces/json-options.interface.js";
import type { LinksOptions } from "./interfaces/links-options.interface.js";
import type { MarkdownOptions } from "./interfaces/markdown-options.interface.js";
import type { PdfOptions } from "./interfaces/pdf-options.interface.js";
import type { ScrapeOptions, ScrapeResult } from "./interfaces/scrape-options.interface.js";
import type { ScreenshotOptions } from "./interfaces/screenshot-options.interface.js";
import type { SnapshotOptions, SnapshotResult } from "./interfaces/snapshot-options.interface.js";
import { PUPPETEER_DEFAULT_AI } from "./puppeteer.constants.js";
import { InjectBrowser } from "./puppeteer.decorators.js";
import { PuppeteerUnavailableError } from "./puppeteer-unavailable.error.js";

@Injectable()
export class PuppeteerService {
  private readonly logger = new Logger(PuppeteerService.name);

  constructor(
    @InjectBrowser() private readonly browser: Browser | null,
    @Optional()
    @Inject(PUPPETEER_DEFAULT_AI)
    private readonly defaultAi?: CustomAiConfig,
    @Optional()
    private readonly fontRegistry?: FontRegistry,
  ) {}

  /**
   * Fetch the rendered HTML content of a page.
   * Equivalent to Cloudflare Browser Rendering `/content` endpoint.
   */
  async content(options: ContentOptions): Promise<string> {
    return this.withPage(options, async (page) => {
      return page.content();
    });
  }

  /**
   * Capture a screenshot of a page.
   * Equivalent to Cloudflare Browser Rendering `/screenshot` endpoint.
   */
  async screenshot(options: ScreenshotOptions): Promise<Buffer> {
    return this.withPage(options, async (page) => {
      const {
        selector,
        type,
        quality,
        fullPage,
        omitBackground,
        encoding: _encoding,
        captureBeyondViewport,
        optimizeForSpeed,
        clip,
      } = options;

      const screenshotOpts = {
        type,
        quality,
        fullPage,
        omitBackground,
        captureBeyondViewport,
        optimizeForSpeed,
        clip,
        encoding: "binary" as const,
      };

      if (selector) {
        const element = await page.$(selector);
        if (!element) {
          throw new Error(`Selector "${selector}" not found on page`);
        }
        return Buffer.from(await element.screenshot(screenshotOpts));
      }

      return Buffer.from(await page.screenshot(screenshotOpts));
    });
  }

  /**
   * Generate a PDF of a page.
   * Equivalent to Cloudflare Browser Rendering `/pdf` endpoint.
   */
  async pdf(options: PdfOptions): Promise<Buffer> {
    return this.withPage(options, async (page) => {
      const {
        displayHeaderFooter,
        printBackground,
        margin,
        pageRanges,
        preferCSSPageSize,
        scale,
        format,
        landscape,
        width,
        height,
        omitBackground,
        tagged,
        timeout,
      } = options;

      const { header, footer } = await this.injectTemplateFonts(page, options);

      return Buffer.from(
        await page.pdf({
          displayHeaderFooter,
          headerTemplate: header,
          footerTemplate: footer,
          printBackground,
          margin,
          pageRanges,
          preferCSSPageSize,
          scale,
          format,
          landscape,
          width,
          height,
          omitBackground,
          tagged,
          timeout,
        }),
      );
    });
  }

  /**
   * Extract the page content as Markdown.
   * Equivalent to Cloudflare Browser Rendering `/markdown` endpoint.
   */
  async markdown(options: MarkdownOptions): Promise<string> {
    return this.withPage(options, async (page) => {
      return page.evaluate(DOM_TO_MARKDOWN_SCRIPT) as Promise<string>;
    });
  }

  /**
   * Capture both HTML content and a screenshot in a single page load.
   * Equivalent to Cloudflare Browser Rendering `/snapshot` endpoint.
   */
  async snapshot(options: SnapshotOptions): Promise<SnapshotResult> {
    return this.withPage(options, async (page) => {
      const html = await page.content();

      const {
        type,
        quality,
        fullPage,
        omitBackground,
        captureBeyondViewport,
        optimizeForSpeed,
        clip,
      } = options;

      const screenshot = Buffer.from(
        await page.screenshot({
          type,
          quality,
          fullPage,
          omitBackground,
          captureBeyondViewport,
          optimizeForSpeed,
          clip,
          encoding: "binary",
        }),
      );

      return { html, screenshot };
    });
  }

  /**
   * Scrape elements matching CSS selectors.
   * Equivalent to Cloudflare Browser Rendering `/scrape` endpoint.
   */
  async scrape(options: ScrapeOptions): Promise<ScrapeResult[]> {
    return this.withPage(options, async (page) => {
      const results: ScrapeResult[] = [];

      for (const selector of options.selectors) {
        const elements = await page.$$eval(selector, (nodes) =>
          nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              text: node.textContent?.trim() ?? "",
              html: node.innerHTML,
              attributes: Array.from(node.attributes).map((a) => ({
                name: a.name,
                value: a.value,
              })),
              width: rect.width,
              height: rect.height,
              top: rect.top,
              left: rect.left,
            };
          }),
        );
        results.push({ selector, elements });
      }

      return results;
    });
  }

  /**
   * Extract all links from a page.
   * Equivalent to Cloudflare Browser Rendering `/links` endpoint.
   */
  async links(options: LinksOptions): Promise<string[]> {
    return this.withPage(options, async (page) => {
      const visibleOnly = options.visibleLinksOnly ?? false;

      const links = await page.$$eval(
        "a[href]",
        (anchors, onlyVisible) => {
          return anchors
            .filter((a) => {
              if (onlyVisible) {
                const rect = a.getBoundingClientRect();
                const style = getComputedStyle(a);
                if (
                  rect.width === 0 ||
                  rect.height === 0 ||
                  style.display === "none" ||
                  style.visibility === "hidden"
                ) {
                  return false;
                }
              }
              return true;
            })
            .map((a) => a.href);
        },
        visibleOnly,
      );

      return [...new Set(links)];
    });
  }

  /**
   * Extract structured data from a page using AI.
   * Equivalent to Cloudflare Browser Rendering `/json` endpoint.
   * Requires an AI provider configured via module options or custom_ai.
   */
  async json(options: JsonOptions): Promise<unknown> {
    if (!options.prompt && !options.response_format) {
      throw new Error('At least one of "prompt" or "response_format" must be provided');
    }

    return this.withPage(options, async (page) => {
      const textContent = await page.evaluate(() => document.body.innerText);

      const ai = options.custom_ai?.[0] ?? this.defaultAi;

      if (!ai) {
        throw new Error(
          "No AI provider configured. Set defaultAi in module options or pass custom_ai in the request.",
        );
      }

      return this.callAi(ai, textContent, options.prompt, options.response_format);
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Chromium prints header/footer templates in a separate document that
   * cannot fetch resources (not even data: URIs in time for paint). A web
   * font renders there only when the template declares the @font-face inline
   * AND the same face is already active in the page's renderer. Registry
   * fonts are data-URI declarations, so both conditions can be satisfied for
   * HTML renders: inject the referenced families into each template and
   * force-activate their faces in the main page. Each template gets only the
   * families it actually references, so a template that uses no registry
   * fonts pays nothing.
   */
  private async injectTemplateFonts(
    page: Page,
    options: PdfOptions,
  ): Promise<{ header?: string; footer?: string }> {
    const { headerTemplate, footerTemplate } = options;
    const registry = this.fontRegistry;
    const eligible =
      registry &&
      !registry.isEmpty() &&
      options.html &&
      options.displayHeaderFooter &&
      (headerTemplate || footerTemplate);
    if (!eligible) return { header: headerTemplate, footer: footerTemplate };

    const headerBlock = headerTemplate ? registry.getStyleBlockFor(headerTemplate) : "";
    const footerBlock = footerTemplate ? registry.getStyleBlockFor(footerTemplate) : "";

    const specs = registry.getFontLoadSpecsFor(`${headerTemplate ?? ""}${footerTemplate ?? ""}`);
    if (specs.length > 0) {
      // allSettled: user HTML may carry its own @font-face rules whose
      // sources fail to load (e.g. relative URLs); those rejections must not
      // abort activation. The race bounds the wait when a same-named user
      // face points at a hanging remote src — registry faces are data: URIs
      // and load in milliseconds. String script avoids esbuild helper
      // injection (see DOM_TO_MARKDOWN_SCRIPT).
      await page.evaluate(
        `Promise.race([
          Promise.allSettled(${JSON.stringify(specs)}.map((s) => Promise.resolve().then(() => document.fonts.load(s)))),
          new Promise((resolve) => setTimeout(resolve, 10000)),
        ]).then(() => undefined)`,
      );
    }

    return {
      header: headerBlock ? headerBlock + headerTemplate : headerTemplate,
      footer: footerBlock ? footerBlock + footerTemplate : footerTemplate,
    };
  }

  private async withPage<T>(
    options: CommonBrowserOptions,
    callback: (page: Page) => Promise<T>,
  ): Promise<T> {
    let page: Page | null = null;

    try {
      if (!this.browser) {
        throw new PuppeteerUnavailableError();
      }
      page = await this.browser.newPage();

      // Viewport
      if (options.viewport) {
        await page.setViewport({
          width: options.viewport.width ?? 1920,
          height: options.viewport.height ?? 1080,
          deviceScaleFactor: options.viewport.deviceScaleFactor,
          isMobile: options.viewport.isMobile,
          isLandscape: options.viewport.isLandscape,
          hasTouch: options.viewport.hasTouch,
        });
      }

      // User agent
      if (options.userAgent) {
        await page.setUserAgent(options.userAgent);
      }

      // Extra headers
      if (options.setExtraHTTPHeaders) {
        await page.setExtraHTTPHeaders(options.setExtraHTTPHeaders);
      }

      // HTTP Basic Auth
      if (options.authenticate) {
        await page.authenticate(options.authenticate);
      }

      // JavaScript toggle
      if (options.setJavaScriptEnabled !== undefined) {
        await page.setJavaScriptEnabled(options.setJavaScriptEnabled);
      }

      // Media type emulation
      if (options.emulateMediaType) {
        await page.emulateMediaType(options.emulateMediaType);
      }

      // Request interception (resource filtering)
      if (
        options.rejectResourceTypes?.length ||
        options.rejectRequestPattern?.length ||
        options.allowResourceTypes?.length ||
        options.allowRequestPattern?.length
      ) {
        await this.setupRequestInterception(page, options);
      }

      // Cookies
      if (options.cookies?.length) {
        await page.setCookie(...options.cookies);
      }

      // Navigate
      if (options.url) {
        await page.goto(options.url, options.gotoOptions);
      } else if (options.html) {
        const html =
          this.fontRegistry && !this.fontRegistry.isEmpty()
            ? this.fontRegistry.getStyleBlock() + options.html
            : options.html;
        const requestedWaitUntil = options.gotoOptions?.waitUntil;
        const contentWaitUntil = (
          Array.isArray(requestedWaitUntil) ? requestedWaitUntil : [requestedWaitUntil]
        ).filter(
          (event): event is "load" | "domcontentloaded" =>
            event === "load" || event === "domcontentloaded",
        );
        await page.setContent(html, {
          ...(contentWaitUntil.length > 0 ? { waitUntil: contentWaitUntil } : {}),
          timeout: options.gotoOptions?.timeout,
        });
      } else {
        throw new Error('Either "url" or "html" must be provided');
      }

      // Inject scripts and styles
      if (options.addScriptTag) {
        for (const tag of options.addScriptTag) {
          await page.addScriptTag(tag);
        }
      }
      if (options.addStyleTag) {
        for (const tag of options.addStyleTag) {
          await page.addStyleTag(tag);
        }
      }

      // Wait for fonts
      if (options.waitForFonts) {
        await page.evaluate(() => document.fonts.ready);
      }

      // Wait for selector
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector.selector, {
          visible: options.waitForSelector.visible,
          hidden: options.waitForSelector.hidden,
          timeout: options.waitForSelector.timeout,
        });
      }

      // Static delay
      if (options.waitForTimeout) {
        await new Promise((r) => setTimeout(r, options.waitForTimeout));
      }

      return await callback(page);
    } catch (error) {
      this.logger.error(
        `Puppeteer operation failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          this.logger.warn(`Failed to close page: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  private async setupRequestInterception(page: Page, options: CommonBrowserOptions): Promise<void> {
    await page.setRequestInterception(true);

    const allowTypes = options.allowResourceTypes;
    const rejectTypes = options.rejectResourceTypes;
    const allowPatterns = options.allowRequestPattern?.map((p) => new RegExp(p));
    const rejectPatterns = options.rejectRequestPattern?.map((p) => new RegExp(p));

    page.on("request", (request: HTTPRequest) => {
      const resourceType = request.resourceType();
      const url = request.url();

      // Allow lists take precedence: if provided, only matching requests continue
      if (allowTypes?.length || allowPatterns?.length) {
        const typeAllowed = allowTypes ? allowTypes.includes(resourceType as any) : true;
        const patternAllowed = allowPatterns ? allowPatterns.some((p) => p.test(url)) : true;

        if ((allowTypes?.length && !typeAllowed) || (allowPatterns?.length && !patternAllowed)) {
          request.abort().catch(() => {});
          return;
        }
      }

      // Reject lists
      if (rejectTypes?.length && rejectTypes.includes(resourceType as any)) {
        request.abort().catch(() => {});
        return;
      }

      if (rejectPatterns?.length && rejectPatterns.some((p) => p.test(url))) {
        request.abort().catch(() => {});
        return;
      }

      request.continue().catch(() => {});
    });
  }

  private async callAi(
    ai: CustomAiConfig,
    content: string,
    prompt?: string,
    responseFormat?: import("./interfaces/json-options.interface.js").JsonResponseFormat,
  ): Promise<unknown> {
    const baseUrl = ai.baseUrl ?? "https://api.openai.com/v1";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const systemMessage = prompt
      ? `Extract data from the following webpage content. ${prompt}`
      : "Extract structured data from the following webpage content.";

    const messages = [
      { role: "system" as const, content: systemMessage },
      { role: "user" as const, content },
    ];

    const body: Record<string, unknown> = {
      model: ai.model,
      messages,
    };

    if (responseFormat) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "extraction",
          strict: true,
          schema: responseFormat.schema,
        },
      };
    } else {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ai.authorization.startsWith("Bearer ")
          ? ai.authorization
          : `Bearer ${ai.authorization}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const rawContent = result.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error("AI returned empty response");
    }

    return JSON.parse(rawContent);
  }
}

// ---------------------------------------------------------------------------
// DOM-to-Markdown script (string constant — avoids esbuild __name injection)
// ---------------------------------------------------------------------------

/* eslint-disable */
const DOM_TO_MARKDOWN_SCRIPT = `(function() {
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || "").replace(/\\s+/g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    var el = node;
    var tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript") return "";
    var children = Array.from(el.childNodes).map(processNode).join("");
    switch (tag) {
      case "h1": return "\\n# " + children.trim() + "\\n\\n";
      case "h2": return "\\n## " + children.trim() + "\\n\\n";
      case "h3": return "\\n### " + children.trim() + "\\n\\n";
      case "h4": return "\\n#### " + children.trim() + "\\n\\n";
      case "h5": return "\\n##### " + children.trim() + "\\n\\n";
      case "h6": return "\\n###### " + children.trim() + "\\n\\n";
      case "p": return "\\n" + children.trim() + "\\n\\n";
      case "br": return "\\n";
      case "hr": return "\\n---\\n\\n";
      case "strong": case "b": return "**" + children.trim() + "**";
      case "em": case "i": return "*" + children.trim() + "*";
      case "code":
        return (el.parentElement && el.parentElement.tagName.toLowerCase() === "pre")
          ? children : ("\`" + children.trim() + "\`");
      case "pre": return "\\n\`\`\`\\n" + children.trim() + "\\n\`\`\`\\n\\n";
      case "a": {
        var href = el.getAttribute("href");
        return href ? "[" + children.trim() + "](" + href + ")" : children;
      }
      case "img": {
        var src = el.getAttribute("src");
        var alt = el.getAttribute("alt") || "";
        return src ? "![" + alt + "](" + src + ")" : "";
      }
      case "ul":
        return "\\n" + Array.from(el.children).map(function(li) {
          return "- " + processNode(li).trim();
        }).join("\\n") + "\\n\\n";
      case "ol":
        return "\\n" + Array.from(el.children).map(function(li, i) {
          return (i + 1) + ". " + processNode(li).trim();
        }).join("\\n") + "\\n\\n";
      case "li": return children;
      case "blockquote":
        return "\\n" + children.trim().split("\\n").map(function(l) {
          return "> " + l;
        }).join("\\n") + "\\n\\n";
      case "table": {
        var rows = Array.from(el.querySelectorAll("tr"));
        if (rows.length === 0) return children;
        function processRow(row) {
          return Array.from(row.querySelectorAll("th, td")).map(function(cell) {
            return processNode(cell).trim();
          });
        }
        var headerRow = processRow(rows[0]);
        var separator = headerRow.map(function() { return "---"; });
        var dataRows = rows.slice(1).map(processRow);
        return "\\n| " + headerRow.join(" | ") + " |\\n| " + separator.join(" | ") + " |\\n" +
          dataRows.map(function(r) { return "| " + r.join(" | ") + " |"; }).join("\\n") + "\\n\\n";
      }
      default: return children;
    }
  }
  var body = document.body;
  if (!body) return "";
  return processNode(body).replace(/\\n{3,}/g, "\\n\\n").trim();
})()`;
