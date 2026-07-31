import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { PUPPETEER_FONT_CONFIG } from "./puppeteer.constants.js";

export interface FontConfig {
  /** Absolute path to a directory of font files. */
  dir?: string;
  /** Explicit alias map: parsed family → extra family name(s) HTML can reference. */
  aliases?: Record<string, string | string[]>;
  /** Function that takes the parsed family and returns extra alias(es). */
  aliasResolver?: (family: string) => string | string[] | undefined;
}

type FontStyle = "normal" | "italic";

interface FontSource {
  readonly dataUrl: string;
  readonly format: string;
}

interface FontVariant {
  readonly family: string;
  readonly weight: number;
  readonly style: FontStyle;
  readonly sources: ReadonlyArray<FontSource>;
}

interface FontFile {
  readonly path: string;
  readonly identifier: string;
  readonly ext: FontExt;
}

const FORMATS = {
  ".woff2": "woff2",
  ".woff": "woff",
  ".ttf": "truetype",
  ".otf": "opentype",
} as const;

const MIME_TYPES = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
} as const;

type FontExt = keyof typeof FORMATS;

const isFontExt = (ext: string): ext is FontExt => ext in FORMATS;

const WEIGHTS: Record<string, number> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  book: 350,
  regular: 400,
  normal: 400,
  roman: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  demi: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  heavy: 800,
  black: 900,
};

const FORMAT_PRIORITY: Record<string, number> = {
  woff2: 0,
  woff: 1,
  truetype: 2,
  opentype: 3,
};

const tryOr = <T>(fn: () => T): T | null => {
  try {
    return fn();
  } catch {
    return null;
  }
};

const extractStyle = (identifier: string): { core: string; style: FontStyle } => {
  const match = identifier.match(/(italic|oblique)$/i);
  return match
    ? { core: identifier.slice(0, -match[0].length), style: "italic" }
    : { core: identifier, style: "normal" };
};

const findTrailingWeight = (value: string): { weight: string; index: number } | null => {
  const lower = value.toLowerCase();
  return Object.keys(WEIGHTS).reduce<{ weight: string; index: number } | null>((best, weight) => {
    const w = weight.toLowerCase();
    if (!lower.endsWith(w)) return best;
    if (best && best.weight.length >= w.length) return best;
    return { weight, index: value.length - w.length };
  }, null);
};

const splitFamilyAndModifier = (value: string): { family: string; modifier: string } => {
  const dashIdx = value.lastIndexOf("-");
  if (dashIdx !== -1) {
    return { family: value.slice(0, dashIdx), modifier: value.slice(dashIdx + 1) };
  }
  const trailing = findTrailingWeight(value);
  if (trailing) {
    return { family: value.slice(0, trailing.index), modifier: trailing.weight };
  }
  return { family: value, modifier: "Regular" };
};

/**
 * Parse a variant identifier (filename basename without extension, or a
 * directory name) into family + weight + style.
 *
 * Supports both `AvenirPro-LightOblique` (flat) and `AvenirPro55Oblique`
 * (CamelCase with foundry-specific weight digits).
 */
export const parseFontVariant = (
  identifier: string,
): { family: string; weight: number; style: FontStyle } => {
  const { core, style } = extractStyle(identifier);
  const stripped = core.replace(/\d+/g, "");
  const { family: rawFamily, modifier } = splitFamilyAndModifier(stripped);
  const family = rawFamily.replace(/[-_\s]+$/, "") || stripped || identifier;
  const weight = WEIGHTS[modifier.toLowerCase()] ?? 400;
  return { family, weight, style };
};

const buildSrcList = (sources: ReadonlyArray<FontSource>): string =>
  [...sources]
    .sort((a, b) => (FORMAT_PRIORITY[a.format] ?? 99) - (FORMAT_PRIORITY[b.format] ?? 99))
    .map((s) => `url(${s.dataUrl}) format('${s.format}')`)
    .join(",");

const toArray = (value: string | string[] | undefined): readonly string[] =>
  value === undefined ? [] : typeof value === "string" ? [value] : value;

const buildFontFace = (variant: FontVariant, aliases: readonly string[]): string => {
  const src = buildSrcList(variant.sources);
  return aliases
    .map(
      (name) =>
        `@font-face{font-family:'${name}';font-style:${variant.style};font-weight:${variant.weight};font-display:swap;src:${src};}`,
    )
    .join("");
};

const buildLoadSpec = (variant: FontVariant, name: string): string =>
  `${variant.style === "italic" ? "italic " : ""}${variant.weight} 16px '${name}'`;

const wrapStyle = (css: string): string =>
  css ? `<style data-puppeteer-fonts>${css}</style>` : "";

interface FontFamilyEntry {
  /** All names this family is emitted under (parsed family + aliases). */
  readonly names: readonly string[];
  /** Concatenated @font-face rules for every variant of the family. */
  readonly css: string;
  /** document.fonts.load() specs for every variant × name. */
  readonly specs: readonly string[];
}

@Injectable()
export class FontRegistry implements OnModuleInit {
  private readonly logger = new Logger(FontRegistry.name);
  private styleBlock = "";
  private loadSpecs: readonly string[] = [];
  private families: readonly FontFamilyEntry[] = [];

  constructor(
    @Optional()
    @Inject(PUPPETEER_FONT_CONFIG)
    private readonly config?: FontConfig | null,
  ) {}

  onModuleInit(): void {
    const dir = this.config?.dir;
    if (!dir) return;

    const files = this.collectFiles(dir);
    const variants = files.reduce<Map<string, FontVariant>>((acc, file) => {
      this.addFile(file, acc);
      return acc;
    }, new Map());

    if (variants.size === 0) {
      this.logger.warn(`No font files found in ${dir}`);
      return;
    }

    const byFamily = new Map<string, FontVariant[]>();
    for (const variant of variants.values()) {
      const list = byFamily.get(variant.family);
      if (list) list.push(variant);
      else byFamily.set(variant.family, [variant]);
    }

    this.families = Array.from(byFamily, ([family, list]) => {
      const names = this.resolveAliases(family);
      return {
        names,
        css: list.map((variant) => buildFontFace(variant, names)).join(""),
        specs: list.flatMap((variant) => names.map((name) => buildLoadSpec(variant, name))),
      };
    });
    this.styleBlock = wrapStyle(this.families.map((f) => f.css).join(""));
    this.loadSpecs = this.families.flatMap((f) => f.specs);

    const families = new Set(Array.from(variants.values(), (v) => v.family));
    this.logger.log(
      `Loaded ${variants.size} font variant(s) across ${families.size} family(ies) from ${dir}`,
    );
  }

  /** Resolves the full set of names a family should be emitted under. */
  resolveAliases(family: string): readonly string[] {
    const names = new Set<string>([family]);
    toArray(this.config?.aliases?.[family]).forEach((name) => {
      names.add(name);
    });
    toArray(this.config?.aliasResolver?.(family)).forEach((name) => {
      names.add(name);
    });
    return [...names];
  }

  isEmpty(): boolean {
    return this.styleBlock === "";
  }

  getStyleBlock(): string {
    return this.styleBlock;
  }

  /**
   * CSS font shorthand specs (one per variant × alias) for
   * `document.fonts.load()`. Activating every face in the main page is what
   * makes the faces available to Chromium's print header/footer documents,
   * which cannot load font resources themselves.
   */
  getFontLoadSpecs(): readonly string[] {
    return this.loadSpecs;
  }

  /**
   * Style block containing only the families whose emitted names appear in
   * the given HTML (case-insensitive). Empty string when none match.
   */
  getStyleBlockFor(html: string): string {
    return wrapStyle(
      this.matchFamilies(html)
        .map((f) => f.css)
        .join(""),
    );
  }

  /** Load specs (see `getFontLoadSpecs`) scoped to families the HTML references. */
  getFontLoadSpecsFor(html: string): readonly string[] {
    return this.matchFamilies(html).flatMap((f) => f.specs);
  }

  private matchFamilies(html: string): readonly FontFamilyEntry[] {
    const haystack = html.toLowerCase();
    return this.families.filter((f) =>
      f.names.some((name) => haystack.includes(name.toLowerCase())),
    );
  }

  private collectFiles(dir: string): FontFile[] {
    const stat = tryOr(() => statSync(dir));
    if (!stat) {
      this.logger.warn(`fontsDir not readable: ${dir}`);
      return [];
    }
    if (!stat.isDirectory()) {
      this.logger.warn(`fontsDir is not a directory: ${dir}`);
      return [];
    }

    const entries = tryOr(() => readdirSync(dir)) ?? [];
    return entries.flatMap((entry) => this.resolveEntry(dir, entry));
  }

  private resolveEntry(dir: string, entry: string): FontFile[] {
    const fullPath = join(dir, entry);
    const stat = tryOr(() => statSync(fullPath));
    if (!stat) return [];

    if (stat.isDirectory()) {
      const nested = tryOr(() => readdirSync(fullPath)) ?? [];
      return nested.flatMap((name) => {
        const ext = extname(name).toLowerCase();
        return isFontExt(ext) ? [{ path: join(fullPath, name), identifier: entry, ext }] : [];
      });
    }

    if (!stat.isFile()) return [];
    const ext = extname(entry).toLowerCase();
    return isFontExt(ext) ? [{ path: fullPath, identifier: basename(entry, ext), ext }] : [];
  }

  private addFile(file: FontFile, variants: Map<string, FontVariant>): void {
    const bytes = tryOr(() => readFileSync(file.path));
    if (!bytes) {
      this.logger.warn(`Failed to read font ${file.path}`);
      return;
    }

    const parsed = parseFontVariant(file.identifier);
    const source: FontSource = {
      dataUrl: `data:${MIME_TYPES[file.ext]};base64,${bytes.toString("base64")}`,
      format: FORMATS[file.ext],
    };
    const key = `${parsed.family}|${parsed.weight}|${parsed.style}`;
    const existing = variants.get(key);
    variants.set(
      key,
      existing
        ? { ...existing, sources: [...existing.sources, source] }
        : { ...parsed, sources: [source] },
    );
  }
}
