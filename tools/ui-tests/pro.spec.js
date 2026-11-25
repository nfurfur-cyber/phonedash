// PhoneDash Pro in the panel (pro.js): what the free app locks, the sheet that sells Pro and what a purchase opens.
// Google Play is the app's (ProStore.kt); here a stub bridge stands in for it.
const { test, expect } = require('@playwright/test');

const PAGES = ['home', 'two', 'three'].map((id) => ({ id, title: id[0].toUpperCase() + id.slice(1),
  widgets: [{ id: 'n-' + id, type: 'note', x: 0, y: 0, w: 12, h: 6, options: { text: 'Page ' + id } }] }));
const SHORTCUTS = Array.from({ length: 10 }, (_, i) => ({ id: 's' + i, label: 'Key ' + i, icon: '⭐' }));
const DECK = [{ id: 'deck', title: 'Deck', widgets: [{ id: 'sc', type: 'shortcuts', x: 0, y: 0, w: 12, h: 6, options: { columns: 5 } }] }];
const FREE = { state: 'free', price: '₩4,900', ready: true, problem: '' };

async function open(page, { pro = FREE, app = true, pages = PAGES, shortcuts = [], display = {} } = {}) {
  await page.addInitScript(({ pro, app }) => {
    if (!app) return;
    window.__phoneboxKey = 'k';
    window.__calls = [];
    window.Android = {
      pro: (key) => (key === 'k' ? JSON.stringify(pro) : '{}'),
      buyPro: (key) => { window.__calls.push(['buy', key]); return true; },
      restorePro: (key) => { window.__calls.push(['restore', key]); },
    };
  }, { pro, app });
  await page.goto('/panel/style.css');
  await page.evaluate((cfg) => {
    localStorage.clear();
    localStorage.setItem('pb-demo-config', JSON.stringify({ night: { enabled: false }, rules: [], ...cfg }));
  }, { pages, shortcuts, display: { idleReturnSec: 0, ...display } });
  await page.goto('/panel/');
  await expect(page.locator('#pager .page').first()).toBeVisible();
}

const play = (page, next) => page.evaluate((n) => window.onProChange(n), next);
const openSheet = (page) => page.evaluate(async () => (await import('/panel/pro.js')).openPro());

test('without Pro there is the home page and one page for all the others', async ({ page }) => {
  await open(page);
  await expect(page.locator('#pager .page')).toHaveCount(2);
  await expect(page.locator('#dots i')).toHaveCount(2);
  await expect(page.locator('.page').first().locator('.w-note')).toHaveCount(1);
  const locked = page.locator('.page.locked');
  await expect(locked).toHaveCount(1);
  await expect(locked).toContainText('Add more pages with Pro');
  await expect(locked.locator('.pl-pages span')).toHaveText(['Two', 'Three']);
  await expect(locked.locator('.w-note')).toHaveCount(0);
});

test('the Pro page names six pages and counts the rest', async ({ page }) => {
  const many = Array.from({ length: 10 }, (_, i) => ({ ...PAGES[0], id: 'p' + i, title: 'Page number ' + i }));
  for (const [width, height] of [[640, 320], [360, 640]]) {
    await page.setViewportSize({ width, height });
    await open(page, { pages: many });
    await expect(page.locator('.pl-pages span')).toHaveCount(7);
    await expect(page.locator('.pl-pages span').last()).toHaveText('+3');
    const card = await page.locator('.pro-lock').evaluate((e) => { const r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect(); return [r.top >= p.top, r.bottom <= p.bottom]; });
    expect(card).toEqual([true, true]);
  }
});

test('a panel with a single page has no Pro page', async ({ page }) => {
  await open(page, { pages: PAGES.slice(0, 1) });
  await expect(page.locator('#pager .page')).toHaveCount(1);
  await expect(page.locator('.page.locked')).toHaveCount(0);
});

test('page numbers and names still mean the pages set up on the computer', async ({ page }) => {
  await open(page, { display: { homePage: 'three' } });
  const at = (ref) => page.evaluate(async (r) => (await import('/panel/main.js')).resolvePage(r), ref);
  expect(await at('three')).toBe(0);
  expect(await at(3)).toBe(0);
  for (const ref of [1, '2', 'home', 'Two']) expect(await at(ref)).toBe(1); // kept back: the Pro page
  for (const ref of [0, 4, 'nothing', '__pro']) expect(await at(ref)).toBe(-1);
  await play(page, { ...FREE, state: 'pro' });
  expect(await at(1)).toBe(0);
  expect(await at('three')).toBe(2);
});

test('the page set as Home is the free one', async ({ page }) => {
  await open(page, { display: { homePage: 'three' } });
  await expect(page.locator('.page:not(.locked)')).toHaveAttribute('data-id', 'three');
  await expect(page.locator('#pager .page').first()).toHaveAttribute('data-id', 'three');
  await expect(page.locator('.page.locked')).toHaveCount(1);
});

test('rules and webhooks do not switch to a locked page', async ({ page }) => {
  await open(page);
  // the request and the look at the queue in one go: the queue is worked through on a timer
  const ask = () => page.evaluate(async () => {
    const m = await import('/panel/main.js');
    m.requestPage({ page: 'two', rule: 'r1', name: 'R1', countdown: 5 });
    return m.navQueue.length;
  });
  expect(await ask()).toBe(0);
  await play(page, { ...FREE, state: 'pro' });
  expect(await ask()).toBe(1);
});

test('a page switch that waits while a purchase opens the pages is dropped', async ({ page }) => {
  await open(page, { display: { homePage: 'three' } });
  const left = await page.evaluate(async (pro) => {
    const m = await import('/panel/main.js');
    m.requestPage({ page: 'three', rule: 'r1', name: 'R1', countdown: 5 });
    const before = m.navQueue.length;
    window.onProChange(pro);
    return [before, m.navQueue.length, m.ruleHold];
  }, { ...FREE, state: 'pro' });
  expect(left).toEqual([1, 0, null]);
});

test('buttons past the free ones are greyed and open the Pro sheet', async ({ page }) => {
  await open(page, { pages: DECK, shortcuts: SHORTCUTS });
  await expect(page.locator('.deck-grid .key')).toHaveCount(10);
  await expect(page.locator('.deck-grid .key.k-locked')).toHaveCount(2);
  await expect(page.locator('.deck-grid .key.k-locked').first()).toHaveAttribute('data-id', 's8');
  await page.locator('.deck-grid .key.k-locked').first().click();
  await expect(page.locator('#pro')).toBeVisible();
  await expect(page.locator('#pro .pr-buy')).toHaveText('Buy Pro · ₩4,900');
});

test('Buy and Restore go to Google Play through the app, with the bridge key', async ({ page }) => {
  await open(page);
  await openSheet(page);
  await page.locator('#pro .pr-buy').click();
  await page.locator('#pro .pr-restore').click();
  expect(await page.evaluate(() => window.__calls)).toEqual(expect.arrayContaining([['buy', 'k'], ['restore', 'k']]));
});

test('a purchase opens every page, button and theme at once', async ({ page }) => {
  await open(page, { pages: [...PAGES, ...DECK], shortcuts: SHORTCUTS, display: { theme: 'midnight' } });
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'default');
  await openSheet(page);
  await play(page, { ...FREE, state: 'pro' });
  await expect(page.locator('.page.locked')).toHaveCount(0);
  await expect(page.locator('#pager .page')).toHaveCount(4);
  await expect(page.locator('.key.k-locked')).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'midnight');
  await expect(page.locator('#pro')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Pro is on');
});

test('a refund (Play no longer lists the purchase) locks the extras again', async ({ page }) => {
  await open(page, { pro: { ...FREE, state: 'pro' } });
  await expect(page.locator('.page.locked')).toHaveCount(0);
  await play(page, FREE);
  await expect(page.locator('.page.locked')).toHaveCount(1);
});

test('a pending payment and a Play problem are explained, and a pending one cannot be bought twice', async ({ page }) => {
  await open(page);
  await openSheet(page);
  await play(page, { ...FREE, state: 'pending' });
  await expect(page.locator('#pro .pr-status')).toContainText('Waiting for your payment');
  await expect(page.locator('#pro .pr-buy')).toBeDisabled();
  await play(page, { state: 'free', price: '', ready: false, problem: 'play' });
  await expect(page.locator('#pro .pr-status')).toContainText('not available on this phone');
  await expect(page.locator('#pro .pr-buy')).toHaveText('Buy Pro');
});

test('the overview marks the Pro page and offers Pro', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.openOverview());
  await expect(page.locator('.ov-tile.locked')).toHaveCount(1);
  await expect(page.locator('#ovPro')).toBeVisible();
  await page.locator('#ovPro').click();
  await expect(page.locator('#overview')).toBeHidden();
  await expect(page.locator('#pro')).toBeVisible();
});

test('Back closes the Pro sheet first', async ({ page }) => {
  await open(page);
  await openSheet(page);
  await page.evaluate(() => window.onAndroidBack());
  await expect(page.locator('#pro')).toBeHidden();
  await expect(page.locator('#overview')).toBeHidden();
});

test('outside the app (a browser, the editor preview) nothing is locked', async ({ page }) => {
  await open(page, { app: false, pages: [...PAGES, ...DECK], shortcuts: SHORTCUTS, display: { theme: 'warm' } });
  await expect(page.locator('.page.locked')).toHaveCount(0);
  await expect(page.locator('.key.k-locked')).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'warm');
});

test.describe('Korean', () => {
  test.use({ locale: 'ko-KR' });
  test('reads in Korean', async ({ page }) => {
    await open(page);
    await expect(page.locator('.page.locked').first()).toContainText('Pro로 페이지를 더 추가하세요');
    await openSheet(page);
    await expect(page.locator('#pro h1')).toHaveText('한 번 결제로 전부 열기');
    await expect(page.locator('#pro .pr-buy')).toHaveText('Pro 구매 · ₩4,900');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  });
});
