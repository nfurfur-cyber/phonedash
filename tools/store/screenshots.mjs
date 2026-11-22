// Takes the Google Play phone screenshots from the web demo (made-up data) into brand/store/<lang>/:
// 1920×1080 (16:9 landscape), one per page below, in Korean and English.
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
const SHOTS = [['1-home', 'home'], ['2-ai', 'ai'], ['3-music', 'music'], ['4-system', 'system'], ['5-deck', 'deck'], ['6-ambient', 'ambient']];
const LANGS = { ko: 'ko-KR', en: 'en-US' };

// A fixed, plausible forecast (a clear late-autumn day in Seoul) instead of the live Open-Meteo request, which the fake
// clock would time out and which would make every run look different.
function forecast() {
  const pad = (n) => String(n).padStart(2, '0');
  const day0 = new Date();
  day0.setHours(0, 0, 0, 0);
  const iso = (d, time = true) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` + (time ? `T${pad(d.getHours())}:00` : '');
  const hours = Array.from({ length: 168 }, (_, i) => new Date(day0.getTime() + i * 3600_000));
  const temp = (d) => Math.round((4 + 5 * Math.sin(((d.getHours() - 9) / 24) * 2 * Math.PI)) * 10) / 10;
  const days = Array.from({ length: 7 }, (_, i) => new Date(day0.getTime() + i * 86400_000));
  return {
    latitude: 37.57, longitude: 126.98, timezone: 'Asia/Seoul', timezone_abbreviation: 'KST', utc_offset_seconds: 32400,
    current: { time: iso(new Date()), temperature_2m: temp(new Date()), apparent_temperature: temp(new Date()) - 2, weather_code: 1, is_day: new Date().getHours() >= 7 && new Date().getHours() < 18 ? 1 : 0 },
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
    mkdirSync(outDir, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, locale, timezoneId: 'Asia/Seoul' });
    await context.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: forecast() }));
    await context.route('https://air-quality-api.open-meteo.com/**', (route) => route.fulfill({ json: {
      latitude: 37.57, longitude: 126.98, timezone: 'Asia/Seoul', utc_offset_seconds: 32400,
      current: { european_aqi: 32, pm2_5: 14, pm10: 22, ozone: 48, nitrogen_dioxide: 17 },
    } }));
    for (const [name, target] of SHOTS) {
      // a fresh page per shot, on a fake clock: 95 s of readings fill the charts (90 points) in a moment
      const page = await context.newPage();
      await page.clock.install();
      for (let attempt = 0; ; attempt++) {
        try { await page.goto(`http://127.0.0.1:${PORT}/panel/`, { waitUntil: 'load' }); break; } catch (e) { if (attempt > 20) throw e; await page.waitForTimeout(300); }
      }
      await page.clock.runFor(2_000);
      await page.locator('.w').first().waitFor();
      await page.clock.runFor(95_000);
      if (target !== 'home') await page.evaluate((p) => window.PhoneBoxDemo.emit('goto', { page: p, priority: 10, countdown: 0, hold: false }), target);
      await page.clock.runFor(3_000); // the page switch, rings and covers animate in
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
