// The computer's pairing dialog without the QR code: the state of the USB cable and a phone asking on the same Wi-Fi.
const { test, expect } = require('@playwright/test');

async function open(page) {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/settings/#general');
  await page.evaluate(() => {
    window.__calls = [];
    window.__status = { claims: 0, nearby: null, usb: { state: 'none' } };
    const real = window.fetch;
    window.fetch = (url, opts) => {
      window.__calls.push(`${opts?.method || 'GET'} ${url}`);
      if (String(url) === '/api/pair/status') return Promise.resolve(new Response(JSON.stringify(window.__status), { status: 200 }));
      return real(url, opts);
    };
  });
  await page.locator('#lanPair').click();
  await expect(page.locator('#modal')).toBeVisible();
}
const status = (page, change) => page.evaluate((c) => { window.__status = { ...window.__status, ...c }; }, change);
const ASK = { id: 'req1', model: 'samsung SM-E426S', choices: ['038 214', '571 156', '902 447'] };

test('the dialog follows the cable and closes by itself once the phone is connected', async ({ page }) => {
  await open(page);
  const line = page.locator('.pair-usb');
  await expect(line).toContainText('plug in a phone');
  await status(page, { usb: { state: 'allow' } });
  await expect(line).toHaveText('USB: tap Allow on the phone’s screen.');
  await status(page, { usb: { state: 'noApp' } });
  await expect(line).toContainText('not on the connected phone yet');
  await status(page, { usb: { state: 'connected' } });
  await expect(page.locator('#modal')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__calls)).toContain('POST /api/pair/cancel?attempt=1');
});

test('a phone that was connected before does not close the dialog for another one', async ({ page }) => {
  await open(page);
  await page.locator('#modalClose').click();
  await status(page, { usb: { state: 'connected' } });
  await page.locator('#lanPair').click();
  await expect(page.locator('.pair-usb')).toHaveText('USB: the phone is connected.');
  await page.waitForTimeout(2200);
  await expect(page.locator('#modal')).toBeVisible();
});

test('a phone on this Wi-Fi is shown with three numbers; the picked one is sent', async ({ page }) => {
  await open(page);
  await expect(page.locator('.pair-ask')).toBeHidden();
  await status(page, { nearby: ASK });
  await expect(page.locator('.pair-ask')).toBeVisible();
  await expect(page.locator('.pair-ask')).toContainText('samsung SM-E426S wants to connect');
  await expect(page.locator('.pair-code')).toHaveText(ASK.choices);
  await page.locator('.pair-ask').getByRole('button', { name: '571 156' }).click();
  await expect.poll(() => page.evaluate(() => window.__calls)).toContain('POST /api/pair/nearby/decide?id=req1&code=571%20156');
  for (const b of await page.locator('.pair-ask button').all()) await expect(b).toBeDisabled();
  await status(page, { nearby: null, claims: 1 });
  await expect(page.locator('#modal')).toBeHidden();
});

test('Refuse says no, and the request goes away', async ({ page }) => {
  await open(page);
  await status(page, { nearby: ASK });
  await page.locator('.pair-ask').getByRole('button', { name: 'Refuse' }).click();
  await expect.poll(() => page.evaluate(() => window.__calls)).toContain('POST /api/pair/nearby/decide?id=req1');
  await status(page, { nearby: null });
  await expect(page.locator('.pair-ask')).toBeHidden();
  await expect(page.locator('#modal')).toBeVisible();
});

test("a phone's name is text, never markup", async ({ page }) => {
  await open(page);
  await status(page, { nearby: { ...ASK, model: '<img src=x onerror="window.__bad=1">' } });
  await expect(page.locator('.pair-ask')).toContainText('<img src=x');
  await expect(page.locator('.pair-ask img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__bad)).toBeUndefined();
});

test('the Korean dialog', async ({ page }) => {
  test.skip(!process.env.SHOT, 'only for looking at it');
  await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR'] }));
  await open(page);
  await status(page, { nearby: ASK });
  await expect(page.locator('.pair-ask')).toBeVisible();
  await page.screenshot({ path: `${process.env.SHOT}-pc.png` });
});
