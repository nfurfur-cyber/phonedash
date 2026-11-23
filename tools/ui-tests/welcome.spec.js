// The first-start screen in the app: shown while no computer is paired, it lets the phone send itself the install link.
const { test, expect } = require('@playwright/test');

async function open(page, { pcs = [] } = {}) {
  await page.addInitScript((pcs) => {
    window.__phoneboxKey = 'k';
    window.__phonedashSite = 'https://example.github.io/phonedash/';
    window.__shared = [];
    window.Android = {
      pcs: () => JSON.stringify(pcs),
      share: (key, text) => { window.__shared.push([key, text]); return true; },
    };
  }, pcs);
  await page.goto('/panel/');
  await expect(page.locator('#dots i')).not.toHaveCount(0);
  await page.evaluate(async () => {
    window.fetch = () => Promise.reject(new TypeError('the agent is not running'));
    const m = await import('/panel/main.js');
    m.setOnline(false);
  });
}

test('with no paired computer the app shows the three steps and the site address', async ({ page }) => {
  await open(page);
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#welcome .wl-steps li')).toHaveCount(3);
  await expect(page.locator('#wlUrl')).toHaveText('example.github.io/phonedash');
});

test('Send hands the install link to the share sheet with the key', async ({ page }) => {
  await open(page);
  await page.locator('#wlSend').click();
  const shared = await page.evaluate(() => window.__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0][0]).toBe('k');
  expect(shared[0][1]).toContain('https://example.github.io/phonedash/');
});

test('a phone that is already paired sees the usual offline panel instead', async ({ page }) => {
  await open(page, { pcs: [{ id: 'pc1', name: 'Desk', active: true }] });
  await expect(page.locator('#welcome')).toBeHidden();
});

test('the screen goes away once the computer is connected', async ({ page }) => {
  await open(page);
  await expect(page.locator('#welcome')).toBeVisible();
  await page.evaluate(async () => (await import('/panel/main.js')).setOnline(true));
  await expect(page.locator('#welcome')).toBeHidden();
});

test.describe('Korean', () => {
  test.use({ locale: 'ko-KR' });
  test('reads in Korean', async ({ page }) => {
    await open(page);
    await expect(page.locator('#welcome h1')).toHaveText('이 공기계를 컴퓨터와 연결해요');
    await expect(page.locator('#wlSend')).toHaveText('컴퓨터로 링크 보내기');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  });
});
