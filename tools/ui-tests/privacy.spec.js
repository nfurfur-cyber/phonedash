// The privacy policy has to be reachable inside the app (a Google Play rule): on the first-start screen, in the question
// about statistics and in the page overview. The app opens its own fixed address; the panel cannot hand it another one.
const { test, expect } = require('@playwright/test');

async function open(page, { app = true, openPrivacy = true, offline = false } = {}) {
  await page.addInitScript(({ app, openPrivacy }) => {
    if (!app) return;
    window.__phoneboxKey = 'k';
    window.__phonedashSite = 'https://example.github.io/phonedash/';
    window.__opened = [];
    window.Android = {
      pcs: () => '[]',
      usage: () => JSON.stringify({ available: true, choice: 'unset' }),
      ...(openPrivacy ? { openPrivacy: (...args) => { window.__opened.push(args); } } : {}),
    };
  }, { app, openPrivacy });
  await page.goto('/panel/');
  await expect(page.locator('#dots i')).not.toHaveCount(0);
  if (!offline) {
    await expect.poll(() => page.evaluate(async () => (await import('/panel/main.js')).online)).toBe(true);
    return;
  }
  await page.evaluate(async () => {
    window.fetch = () => Promise.reject(new TypeError('the agent is not running'));
    (await import('/panel/main.js')).setOnline(false);
  });
}

const opened = (page) => page.evaluate(() => window.__opened);
const openOverview = (page) => page.evaluate(async () => (await import('/panel/main.js')).openOverview());

test('the first-start screen links the privacy policy', async ({ page }) => {
  await open(page, { offline: true });
  await expect(page.locator('#wlPrivacy')).toHaveText('Privacy policy');
  await page.click('#wlPrivacy');
  expect(await opened(page)).toEqual([['k']]);
});

test('the overview links it and stays open', async ({ page }) => {
  await open(page);
  await openOverview(page);
  await expect(page.locator('#ovPrivacy')).toBeVisible();
  await page.click('#ovPrivacy');
  expect(await opened(page)).toEqual([['k']]);
  await expect(page.locator('#overview')).toBeVisible();
});

test('the question about statistics links it without counting as an answer', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const m = await import('/panel/main.js');
    m.closeOverview();
    document.getElementById('usageAsk').hidden = false;
  });
  await page.click('#usPrivacy');
  expect(await opened(page)).toEqual([['k']]);
  await expect(page.locator('#usageAsk')).toBeVisible();
});

test('outside the app, or in an app that cannot open it, there is no dead link', async ({ page }) => {
  await open(page, { openPrivacy: false });
  await openOverview(page);
  await expect(page.locator('#overview')).toBeVisible();
  await expect(page.locator('[data-privacy]')).toHaveCount(3);
  for (const link of await page.locator('[data-privacy]').all()) await expect(link).toBeHidden();
});

test('the web demo has no link of its own', async ({ page }) => {
  await open(page, { app: false });
  await openOverview(page);
  await expect(page.locator('#ovPrivacy')).toBeHidden();
});

// the smallest screens and the longest words: the link has to be on screen without pushing anything out of it
for (const [w, h] of [[640, 360], [360, 640]]) {
  test(`fits a ${w}x${h} screen`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    await openOverview(page);
    const box = await page.locator('#ovPrivacy').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(32);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
    expect(box.y + box.height).toBeLessThanOrEqual(h);
    const usage = await page.locator('#ovUsage').boundingBox(); // the switch the policy tells people to use
    expect(usage.x + usage.width).toBeLessThanOrEqual(w);
  });
  test(`is seen on the first-start screen at ${w}x${h} without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, { offline: true });
    const box = await page.locator('#wlPrivacy').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(h);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
  });
}

test.describe('Korean', () => {
  test.use({ locale: 'ko-KR' });
  test('reads in Korean', async ({ page }) => {
    await open(page, { offline: true });
    await expect(page.locator('#wlPrivacy')).toHaveText('개인정보처리방침');
  });
});

test('the linked page exists on the site and says how to delete data', async ({ page }) => {
  await page.goto('/privacy.html');
  await expect(page.locator('h1')).toContainText('Privacy policy');
  await expect(page.locator('#deleting-your-data')).toHaveCount(1);
  await expect(page.locator('#delete-data-ko')).toHaveCount(1);
  const dead = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1))
    .filter((id) => !document.getElementById(id)));
  expect(dead).toEqual([]);
});
