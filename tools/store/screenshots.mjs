// Takes the Google Play phone screenshots from the web demo (made-up data) into brand/store/<lang>/:
// 1920×1080 (16:9 landscape), the shots below, in Korean and English.
// Needs the UI-test Playwright: cd tools/ui-tests && npm ci && npx playwright install chromium
// Usage: node tools/store/screenshots.mjs
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(join(ROOT, 'tools/ui-tests/package.json'))('@playwright/test');
const SITE = join(ROOT, '.store-site');
const PORT = 8783;
// name, page, theme: the home board in the free look and in the two looks Pro adds, then the widget pages
const SHOTS = [['1-home', 'board', 'default'], ['2-calendar', 'board', 'calendar'], ['3-keycap', 'board', 'keycap'], ['4-dashboard', 'home', 'default'],
  ['5-ai', 'ai', 'default'], ['6-music', 'music', 'default'], ['7-system', 'system', 'default'], ['8-deck', 'deck', 'default']];
// the demo has a page for every template; the screenshots show a panel with these
const PAGES = [...new Set(SHOTS.map(([, page]) => page))];
const LANGS = { ko: 'ko-KR', en: 'en-US' };

// Today at ten in the morning, whenever the pictures are taken
const NOW = new Date(new Date().setHours(10, 8, 0, 0));

// A fixed, plausible forecast (a clear late-autumn day in Seoul) instead of the live Open-Meteo request, which the fake
// clock would time out and which would make every run look different.
function forecast() {
  const pad = (n) => String(n).padStart(2, '0');
  const day0 = new Date(NOW);
  day0.setHours(0, 0, 0, 0);
  const iso = (d, time = true) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` + (time ? `T${pad(d.getHours())}:00` : '');
  const hours = Array.from({ length: 168 }, (_, i) => new Date(day0.getTime() + i * 3600_000));
  const temp = (d) => Math.round((4 + 5 * Math.sin(((d.getHours() - 9) / 24) * 2 * Math.PI)) * 10) / 10;
  const days = Array.from({ length: 7 }, (_, i) => new Date(day0.getTime() + i * 86400_000));
  return {
    latitude: 37.57, longitude: 126.98, timezone: 'Asia/Seoul', timezone_abbreviation: 'KST', utc_offset_seconds: 32400,
    current: { time: iso(NOW), temperature_2m: temp(NOW), apparent_temperature: temp(NOW) - 2, weather_code: 1, is_day: 1 },
    hourly: { time: hours.map((d) => iso(d)), temperature_2m: hours.map(temp), weather_code: hours.map((d, i) => (i % 29 < 20 ? 1 : 2)),
      precipitation_probability: hours.map(() => 0), is_day: hours.map((d) => (d.getHours() >= 7 && d.getHours() < 18 ? 1 : 0)) },
    daily: { time: days.map((d) => iso(d, false)), weather_code: [1, 2, 3, 1, 0, 61, 2], temperature_2m_max: [9, 10, 8, 7, 11, 6, 8],
      temperature_2m_min: [-1, 1, 2, -2, 0, 3, 1], precipitation_probability_max: [0, 10, 20, 0, 0, 70, 10],
      sunrise: days.map((d) => iso(d, false) + 'T07:22'), sunset: days.map((d) => iso(d, false) + 'T17:16'),
      daylight_duration: days.map(() => 35640), uv_index_max: days.map(() => 2.1) },
  };
}

const built = spawnSync(process.execPath, [join(ROOT, 'tools/pages/build-site.mjs'), SITE], { stdio: 'inherit' });
if (built.status !== 0) process.exit(1);
const server = spawn(process.execPath, [join(ROOT, 'tools/ui-tests/serve.mjs'), SITE, String(PORT)], { stdio: 'ignore' });
const browser = await chromium.launch();
try {
  for (const [lang, locale] of Object.entries(LANGS)) {
    const outDir = join(ROOT, 'brand/store', lang);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, locale, timezoneId: 'Asia/Seoul' });
    await context.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: forecast() }));
    await context.route('https://air-quality-api.open-meteo.com/**', (route) => route.fulfill({ json: {
      latitude: 37.57, longitude: 126.98, timezone: 'Asia/Seoul', utc_offset_seconds: 32400,
      current: { european_aqi: 32, pm2_5: 14, pm10: 22, ozone: 48, nitrogen_dioxide: 17 },
    } }));
    for (const [name, target, theme] of SHOTS) {
      // a fresh page per shot, on a fake clock: 95 s of readings fill the charts (90 points) in a moment
      const page = await context.newPage();
      await page.clock.install({ time: NOW });
      for (let attempt = 0; ; attempt++) {
        try { await page.goto(`http://127.0.0.1:${PORT}/panel/`, { waitUntil: 'load' }); break; } catch (e) { if (attempt > 20) throw e; await page.waitForTimeout(300); }
      }
      await page.clock.runFor(2_000);
      await page.locator('.w').first().waitFor();
      await page.evaluate(([pages, look]) => {
        const cfg = JSON.parse(localStorage.getItem('pb-demo-config'));
        localStorage.setItem('pb-demo-config', JSON.stringify({ ...cfg, pages: cfg.pages.filter((p) => pages.includes(p.id)), display: { ...cfg.display, theme: look } }));
      }, [PAGES, theme]);
      await page.reload({ waitUntil: 'load' });
      await page.clock.runFor(2_000);
      await page.locator('.w').first().waitFor();
      await page.clock.runFor(95_000);
      if (target !== PAGES[0]) await page.evaluate((p) => window.PhoneBoxDemo.emit('goto', { page: p, priority: 10, countdown: 0, hold: false }), target);
      await page.clock.runFor(6_000); // the page switch, its name, rings and covers animate in and out
      await page.waitForTimeout(300); // images decode in real time
      await page.screenshot({ path: join(outDir, `${name}.png`) });
      console.log(`brand/store/${lang}/${name}.png`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
  rmSync(SITE, { recursive: true, force: true });
}
