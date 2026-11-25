// Usage statistics in the panel (stats.js): nothing without a yes, the switch in the overview, what is counted, and the
// quiet moments that let Google Play's rating card come up. The app (UsageStats.kt, ReviewAsk.kt) is a stub here.
const { test, expect } = require('@playwright/test');

const PAGES = ['home', 'two'].map((id) => ({ id, title: 'Secret ' + id,
  widgets: [{ id: 'n-' + id, type: 'note', x: 0, y: 0, w: 12, h: 6, options: { text: 'Private text' } }] }));

async function open(page, { usage = { available: true, choice: 'unset' }, app = true, pro = 'free' } = {}) {
  await page.addInitScript(({ usage, app, pro }) => {
    if (!app) return;
    window.__phoneboxKey = 'k';
    window.__calls = [];
    window.__usage = usage;
    window.Android = {
      pro: () => JSON.stringify({ state: pro, price: '₩4,900', ready: true, problem: '' }),
      buyPro: () => true, restorePro: () => {}, transport: () => 'wifi',
      usage: (key) => (key === 'k' ? JSON.stringify(window.__usage) : '{}'),
      setUsage: (key, on) => { window.__usage = { ...window.__usage, choice: on ? 'on' : 'off' }; window.__calls.push(['setUsage', on]); },
      stat: (key, name, json) => { if (window.__usage.choice === 'on') window.__calls.push([name, JSON.parse(json)]); },
      quietMoment: () => { window.__calls.push(['quiet']); },
    };
  }, { usage, app, pro });
  await page.goto('/panel/style.css');
  await page.evaluate((pages) => {
    localStorage.clear();
    localStorage.setItem('pb-demo-config', JSON.stringify({ night: { enabled: false }, rules: [], pages, shortcuts: [], display: { idleReturnSec: 0 } }));
  }, PAGES);
  await page.goto('/panel/');
  await expect(page.locator('#pager .page')).toHaveCount(2);
  await expect.poll(() => page.evaluate(async () => (await import('/panel/main.js')).online)).toBe(true);
}

const stats = (page, fn) => page.evaluate(async (name) => (await import('/panel/stats.js'))[name](), fn);
const calls = (page) => page.evaluate(() => window.__calls);

test('the question comes only once the dashboard has been up for a while, and a yes turns statistics on', async ({ page }) => {
  await open(page);
  await stats(page, 'tick');
  await expect(page.locator('#usageAsk')).toBeHidden();
  await stats(page, 'askUsage');
  await expect(page.locator('#usageAsk')).toBeVisible();
  await page.click('#usYes');
  await expect(page.locator('#usageAsk')).toBeHidden();
  expect(await calls(page)).toEqual([['setUsage', true]]);
});

test('a no is kept: nothing is counted and nothing is asked again', async ({ page }) => {
  await open(page);
  await stats(page, 'askUsage');
  await page.click('#usNo');
  await stats(page, 'askUsage');
  await stats(page, 'tick');
  await expect(page.locator('#usageAsk')).toBeHidden();
  expect(await calls(page)).toEqual([['setUsage', false]]);
});

test('nothing is asked while something is open, or when the build has no statistics', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => (await import('/panel/main.js')).openOverview());
  await stats(page, 'askUsage');
  await expect(page.locator('#usageAsk')).toBeHidden();
  await page.evaluate(() => { window.__usage = { available: false, choice: 'unset' }; });
  await page.evaluate(async () => { const m = await import('/panel/main.js'); m.closeOverview(); m.openOverview(); });
  await expect(page.locator('#ovUsage')).toBeHidden();
});

test('Back puts the question away without answering it', async ({ page }) => {
  await open(page);
  await stats(page, 'askUsage');
  await page.evaluate(() => window.onAndroidBack());
  await expect(page.locator('#usageAsk')).toBeHidden();
  await stats(page, 'askUsage');
  await expect(page.locator('#usageAsk')).toBeHidden();
  expect(await calls(page)).toEqual([]);
});

test('the overview has a switch to change the answer', async ({ page }) => {
  await open(page, { usage: { available: true, choice: 'on' } });
  await page.evaluate(async () => (await import('/panel/main.js')).openOverview());
  await expect(page.locator('#ovUsage')).toHaveText('Statistics: on');
  await page.click('#ovUsage');
  await expect(page.locator('#ovUsage')).toHaveText('Statistics: off');
  await expect(page.locator('#overview')).toBeVisible();
  expect((await calls(page)).at(-1)).toEqual(['setUsage', false]);
});

test('once a day the setup is counted, without any title or text of the user', async ({ page }) => {
  await open(page, { usage: { available: true, choice: 'on' } });
  await stats(page, 'tick');
  await stats(page, 'tick');
  const all = await calls(page);
  expect(all.filter(([n]) => n === 'panel_day')).toEqual([['panel_day', { link: 'wifi', pages: 2, buttons: 0, widgets: 2, theme: 'default', lang: 'en', pro: 'free' }]]);
  expect(all.filter(([n]) => n === 'widget_day')).toEqual([['widget_day', { widget: 'note' }]]);
  expect(JSON.stringify(all)).not.toMatch(/Secret|Private/);
});

test('the way to Pro is counted', async ({ page }) => {
  await open(page, { usage: { available: true, choice: 'on' } });
  await page.evaluate(async () => (await import('/panel/main.js')).goPage(1, true));
  await page.click('.page.locked .pl-go');
  await page.click('.pr-buy');
  const names = (await calls(page)).map(([n, p]) => [n, p]);
  expect(names).toContainEqual(['locked_seen', {}]);
  expect(names).toContainEqual(['pro_open', { from: 'page' }]);
  expect(names).toContainEqual(['pro_buy', { problem: 'none' }]);
});

test('a quiet moment after a touch is reported, but not while something is open', async ({ page }) => {
  await open(page, { pro: 'pro' });
  await page.evaluate(async () => (await import('/panel/main.js')).openOverview());
  await page.mouse.click(5, 5);
  await page.evaluate(async () => (await import('/panel/main.js')).openOverview());
  await page.waitForTimeout(6500);
  expect(await calls(page)).not.toContainEqual(['quiet']);
  await page.evaluate(async () => (await import('/panel/main.js')).closeOverview());
  await page.mouse.move(5, 5);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => calls(page), { timeout: 9000 }).toContainEqual(['quiet']);
});

test('outside the app nothing is asked or counted', async ({ page }) => {
  await open(page, { app: false });
  await stats(page, 'tick');
  await stats(page, 'askUsage');
  await expect(page.locator('#usageAsk')).toBeHidden();
});
