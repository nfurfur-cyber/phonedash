// Renders the brand SVGs into the PNGs the store, the site and the PC program use (brand/out/), then the .ico.
// Needs the UI-test Playwright: cd tools/ui-tests && npm ci && npx playwright install chromium
// Usage: node tools/render-brand.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(join(ROOT, 'tools/ui-tests/package.json'))('@playwright/test');
const OUT = join(ROOT, 'brand/out');

// [svg, output png, width, height]
const JOBS = [
  ['icon.svg', 'play-icon-512.png', 512, 512],
  ['icon.svg', 'icon-192.png', 192, 192],
  ['feature.svg', 'feature-1024x500.png', 1024, 500],
  ...[16, 20, 24, 32, 48, 64, 128, 256].map((s) => [s <= 32 ? 'icon-win-small.svg' : 'icon-win.svg', `ico-${s}.png`, s, s]),
];

/** A Windows .ico holding the given PNGs (each stored as PNG, which Windows Vista and later read). */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const icoParts = [];
for (const [svg, png, w, h] of JOBS) {
  const markup = readFileSync(join(ROOT, 'brand', svg), 'utf8');
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${markup}`);
  const data = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  writeFileSync(join(OUT, png), data);
  if (png.startsWith('ico-')) icoParts.push({ size: w, data });
  console.log(`brand/out/${png}`);
}
await browser.close();
writeFileSync(join(OUT, 'phonedash.ico'), ico(icoParts));
console.log('brand/out/phonedash.ico');
