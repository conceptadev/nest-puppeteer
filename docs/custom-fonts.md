# Custom Fonts

Puppeteer renders pages using the fonts available in the browser. The library can resolve custom fonts from a local directory automatically, or you can load them manually via CSS, base64 embedding, or system installation.

## `fontsDir` (recommended)

Point `PuppeteerModule` at a folder of font files at boot. On startup the library scans the folder, base64-encodes every file once, and on every HTML render prepends a `<style>` block of `@font-face` declarations so the HTML can reference these families as if the fonts were installed.

```ts
import { join } from 'node:path';
import { PuppeteerModule } from '@concepta/puppeteer-nest';

PuppeteerModule.forRoot({
  fontsDir: join(process.cwd(), 'assets', 'fonts'),
  headless: true,
  rest: { prefix: 'api', features: ['pdf', 'screenshot'] },
});
```

Then any HTML sent to the renderer can just reference the family name:

```ts
const pdf = await puppeteerService.pdf({
  html: `<p style="font-family:AvenirPro;font-weight:300;font-style:italic">Hi</p>`,
  waitForFonts: true,
  format: 'a4',
});
```

### Family-name aliases

The parsed family name comes straight from the filename (or parent directory). If your HTML references the same font under a different name — for example `'Avenir Pro'` (with a space) instead of the folder name `AvenirPro` — declare an alias and the library emits a duplicate `@font-face` for each name:

```ts
PuppeteerModule.forRoot({
  fontsDir: join(process.cwd(), 'assets', 'fonts'),
  fontAliases: {
    AvenirPro: 'Avenir Pro',                // single extra name
    OpenSans: ['Open Sans', 'open-sans'],   // multiple extra names
  },
});
```

For programmatic rules (CamelCase splitting, locale-aware mapping, lookup tables) provide a resolver — it composes with `fontAliases`:

```ts
PuppeteerModule.forRoot({
  fontsDir: join(process.cwd(), 'assets', 'fonts'),
  fontAliasResolver: (family) =>
    family.replace(/([a-z])([A-Z])/g, '$1 $2'),
});
```

The resolver receives the parsed family name and returns a string, an array of strings, or `undefined`. The final set of names for each variant is `{parsed, ...fontAliases[parsed], ...resolver(parsed)}`. The library does no implicit name munging — what you configure is exactly what gets emitted.

### Supported directory layouts

Both layouts work side by side. The library reads the **variant identifier** from either the filename (flat) or the parent directory name (nested).

**Flat:**

```
fonts/
├── AvenirPro-Light.woff2
├── AvenirPro-LightOblique.woff2
├── AvenirPro-Medium.woff2
└── AvenirPro-Heavy.woff2
```

**Nested (one folder per variant, file basename free):**

```
fonts/
├── AvenirPro35Light/
│   ├── font.woff
│   └── font.woff2
├── AvenirPro55Oblique/
│   └── font.woff2
├── AvenirPro65Medium/
│   └── font.woff2
└── AvenirPro85Heavy/
    └── font.woff2
```

When both `.woff` and `.woff2` files exist for the same variant, they are merged into a single `@font-face` and the woff2 source is emitted first.

### Variant identifier parsing

The variant identifier is split into family + weight + style by these rules:

1. Strip any trailing `Italic` or `Oblique` (case-insensitive) → `style: italic`.
2. Strip any digits anywhere in the remaining string (foundry weight numbers like Avenir's `35`/`55`/`65`/`85` are not standard CSS weights).
3. If a hyphen is present, split on the last hyphen: left side is the family, right side is the weight word.
4. Otherwise, look for a known weight word ending the string (`Thin`, `ExtraLight`, `Light`, `Book`, `Regular`/`Normal`/`Roman`, `Medium`, `SemiBold`/`DemiBold`/`Demi`, `Bold`, `ExtraBold`, `Black`, `Heavy`) — that suffix becomes the weight; everything before it becomes the family.
5. If nothing is found, weight defaults to `400` (Regular).

Weight word → CSS weight: `Thin`→100, `ExtraLight`→200, `Light`→300, `Book`→350, `Regular`/`Normal`/`Roman`→400, `Medium`→500, `SemiBold`/`Demi`→600, `Bold`→700, `ExtraBold`→800, `Black`/`Heavy`→900.

### Supported file formats

`.woff2`, `.woff`, `.ttf`, `.otf`.

### Caching

The scan happens once at module init. Encoded fonts stay in memory for the process lifetime. Add or remove font files → restart the app.

### Tips

- Pair with `waitForFonts: true` on the render call to guarantee fonts are decoded before the snapshot.
- `fontsDir` only affects HTML renders. URL renders go untouched (target pages handle their own fonts).
- Fonts auto-apply to **every** HTML render. The cost is one small inline `<style>` block; HTML that doesn't use these families pays nothing.

### PDF header/footer templates

Chromium prints `headerTemplate`/`footerTemplate` in a **separate document** that cannot fetch resources — external URLs never load there, and even `data:` URI fonts declared only in the template lose the race against paint. A web font renders in a template only when **both** hold:

1. the `@font-face` is declared inline **inside the template**, and
2. the same face is **already active** in the main page's renderer.

With `fontsDir` configured, the library satisfies both automatically on HTML renders: when `displayHeaderFooter` is set and a header or footer template is present, the `@font-face` rules of every registry family the template references (case-insensitive name match, parsed family or alias) are injected into that template, and the matching faces are pre-activated in the main page via `document.fonts.load()`. Templates that reference no registry family are left untouched. Your template can simply reference the family:

```ts
const pdf = await puppeteerService.pdf({
  html: reportHtml,
  waitForFonts: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-family:'Avenir Pro';font-size:12px;width:100%;text-align:center;">Report</div>`,
  margin: { top: '120px', bottom: '80px' },
});
```

Caveats:

- Applies to **HTML renders only** (`html` option). URL renders go untouched, so registry fonts are not available in their templates — install fonts at the OS level for that case (see below).
- The template must use a family name the registry emits (parsed family or a configured alias).
- Chromium ignores templates entirely unless `displayHeaderFooter: true` and the margins leave room for them.

---

## Manual options

These remain available as one-off escape hatches when `fontsDir` is not suitable.

### `waitForFonts`

All methods support `waitForFonts: true`, which calls `document.fonts.ready` before capturing.

```ts
const pdf = await puppeteerService.pdf({
  url: 'https://example.com/invoice',
  waitForFonts: true,
  format: 'a4',
});
```

> Always enable `waitForFonts` when using custom fonts. Without it, Puppeteer may capture the page before fonts load.

### CSS `@font-face` (remote URL)

```ts
const pdf = await puppeteerService.pdf({
  html: `
    <html>
      <head>
        <style>
          @font-face {
            font-family: 'CustomFont';
            src: url('https://example.com/fonts/CustomFont.woff2') format('woff2');
            font-weight: 400;
          }
          body { font-family: 'CustomFont', sans-serif; }
        </style>
      </head>
      <body>...</body>
    </html>
  `,
  waitForFonts: true,
  format: 'a4',
});
```

### Google Fonts

```ts
const pdf = await puppeteerService.pdf({
  html: `
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
        <style>body { font-family: 'Inter', sans-serif; }</style>
      </head>
      <body>...</body>
    </html>
  `,
  waitForFonts: true,
  format: 'a4',
});
```

### Base64-embedded font (no network required)

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

const fontBase64 = readFileSync(join(__dirname, 'fonts/MyFont.woff2')).toString('base64');

const pdf = await puppeteerService.pdf({
  html: `
    <html>
      <head>
        <style>
          @font-face {
            font-family: 'MyFont';
            src: url(data:font/woff2;base64,${fontBase64}) format('woff2');
          }
          body { font-family: 'MyFont', sans-serif; }
        </style>
      </head>
      <body>...</body>
    </html>
  `,
  waitForFonts: true,
  format: 'a4',
});
```

### Inject font into an existing URL page via `addStyleTag`

```ts
const pdf = await puppeteerService.pdf({
  url: 'https://example.com/report',
  addStyleTag: [{
    content: `
      @font-face {
        font-family: 'BrandFont';
        src: url('https://cdn.example.com/fonts/BrandFont.woff2') format('woff2');
      }
      body, p, h1, h2, h3 { font-family: 'BrandFont', sans-serif !important; }
    `,
  }],
  waitForFonts: true,
  format: 'a4',
});
```

## System Fonts (Docker)

Install fonts at the OS level so they're available to all pages without CSS changes.

### Debian/Ubuntu packages

```dockerfile
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-core \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
```

### Custom font files

```dockerfile
COPY ./fonts/*.ttf /usr/local/share/fonts/
COPY ./fonts/*.woff2 /usr/local/share/fonts/
RUN fc-cache -fv
```

System fonts are immediately available, no `waitForFonts` needed.

## Troubleshooting

### Fonts not rendering

1. Enable `waitForFonts: true`.
2. With `fontsDir`, confirm the module logs `Loaded N font variant(s) ...` at startup. If you see `No font files found`, double-check the path and supported extensions.
3. Verify the family name in your HTML matches the parsed family from the filename/directory name.
4. If using `rejectResourceTypes`, make sure `'font'` is not in the list.

### Garbled text (CJK, Arabic, emoji, etc.)

Install the appropriate Noto packages in your Docker image so Chromium has glyph coverage for the script you need:

```dockerfile
RUN apt-get update && apt-get install -y \
    fonts-noto-cjk \          # Chinese / Japanese / Korean
    fonts-noto-extra \        # Additional scripts (Arabic, Hebrew, Thai, Devanagari, ...)
    fonts-noto-color-emoji \  # Color emoji
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
```

These are independent of `fontsDir`: they cover characters that have no glyph in your custom font and would otherwise render as tofu (□). Keep both — `fontsDir` for brand fonts, Noto packages for special-character fallback.

### Font renders differently than expected

Puppeteer uses the actual browser rendering engine. Differences from local development may be caused by:

- Missing font weights (only regular installed, bold missing)
- Different font fallback chains between OS / Docker
- Sub-pixel rendering differences in headless mode

Fix: ship the exact weights you need via `fontsDir` (or the manual `@font-face` route), and pair with `waitForFonts: true`.
