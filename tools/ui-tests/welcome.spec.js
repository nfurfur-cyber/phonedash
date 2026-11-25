// The first-start screen in the app: shown while no computer is paired, it offers USB, the same Wi-Fi and the QR code.
const { test, expect } = require('@playwright/test');

const SITE = 'https://example.github.io/phonedash/';
const USB = { connected: true, configured: true, adb: true };
const PCS = [{ id: 'aa', name: 'DESK-PC' }];

async function open(page, { pcs = [], usb = null } = {}) {
  await page.addInitScript(([pcs, usb, site]) => {
    window.__phoneboxKey = 'k';
    window.__phonedashSite = site;
    window.__calls = [];
    window.__usb = usb;
    const call = (name, result) => (...args) => { window.__calls.push([name, ...args]); return result; };
    window.Android = {
      pcs: () => JSON.stringify(pcs),
      battery: () => JSON.stringify({ level: -1, usb: window.__usb }),
      share: call('share', true),
      nearbySearch: call('nearbySearch'),
      nearbyPair: call('nearbyPair'),
      nearbyAnswer: call('nearbyAnswer'),
      openUsbSettings: call('openUsbSettings', true),
      openCamera: call('openCamera', true),
    };
  }, [pcs, usb, SITE]);
  await page.goto('/panel/');
  await expect(page.locator('#dots i')).not.toHaveCount(0);
  await page.evaluate(async () => {
    window.fetch = () => Promise.reject(new TypeError('the agent is not running'));
    (await import('/panel/main.js')).setOnline(false);
  });
}
const calls = (page, name) => page.evaluate((n) => window.__calls.filter((c) => c[0] === n), name);
const near = (page, snapshot) => page.evaluate((s) => window.onNearby(s), { state: 'searching', wifi: true, pcs: [], pc: '', code: '', ...snapshot });
const way = (page, name) => page.locator(`#welcome [data-way="${name}"]`);

test('with no paired computer the app offers three ways and the site address', async ({ page }) => {
  await open(page);
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#welcome .wl-way:visible')).toHaveCount(3);
  await expect(page.locator('#wlUrl')).toHaveText('example.github.io/phonedash');
  await expect(page.locator('#wlSteps')).toBeHidden();
});

test('every way starts with the address, and Back returns to the three', async ({ page }) => {
  await open(page);
  for (const name of ['usb', 'wifi', 'qr']) {
    await way(page, name).click();
    await expect(page.locator(`#wl-${name}`)).toBeVisible();
    await expect(page.locator('#wlPick')).toBeHidden();
    await expect(page.locator(`#wl-${name} .wl-site`)).toHaveText('example.github.io/phonedash');
    await page.locator('#wlBack').click();
    await expect(page.locator('#wlPick')).toBeVisible();
    await expect(page.locator(`#wl-${name}`)).toBeHidden();
  }
});

test("Android's Back leaves the way first", async ({ page }) => {
  await open(page);
  await way(page, 'usb').click();
  await page.evaluate(() => window.onAndroidBack());
  await expect(page.locator('#wlPick')).toBeVisible();
  await expect(page.locator('#overview')).toBeHidden();
});

test('Send hands the install link to the share sheet with the key', async ({ page }) => {
  await open(page);
  await page.locator('#wlSend').click();
  const shared = await calls(page, 'share');
  expect(shared).toHaveLength(1);
  expect(shared[0][1]).toBe('k');
  expect(shared[0][2]).toContain(SITE);
});

test('USB says what is missing and follows the cable', async ({ page }) => {
  await open(page);
  await way(page, 'usb').click();
  const line = page.locator('#wlUsb');
  await expect(line).toHaveText('');
  await page.evaluate(() => { window.__usb = { connected: false, configured: false, adb: false }; });
  await expect(line).toHaveText('No cable connected yet');
  await page.evaluate(() => { window.__usb = { connected: true, configured: true, adb: false }; });
  await expect(line).toHaveText('Cable connected. USB debugging is still off.');
  await page.evaluate((u) => { window.__usb = u; }, USB);
  await expect(line).toHaveText('Cable connected. Waiting for the computer…');
  await page.locator('#wlUsbSettings').click();
  expect(await calls(page, 'openUsbSettings')).toEqual([['openUsbSettings', 'k']]);
});

test('QR opens the camera', async ({ page }) => {
  await open(page);
  await way(page, 'qr').click();
  await page.locator('#wlCamera').click();
  expect(await calls(page, 'openCamera')).toEqual([['openCamera', 'k']]);
});

test.describe('same Wi-Fi', () => {
  test('a found computer shows on the choice, then pairs after both sides agree', async ({ page }) => {
    await open(page);
    expect(await calls(page, 'nearbySearch')).toEqual([['nearbySearch', 'k', true]]);
    await near(page, { pcs: PCS });
    await expect(page.locator('#wlWifiHint')).toHaveText('DESK-PC found');
    await way(page, 'wifi').click();
    await page.locator('.wl-pc', { hasText: 'DESK-PC' }).click();
    expect(await calls(page, 'nearbyPair')).toEqual([['nearbyPair', 'k', 'aa']]);

    await near(page, { state: 'asking', pcs: PCS, pc: 'DESK-PC' });
    await expect(page.locator('#wlNear')).toHaveText('Asking DESK-PC…');
    await near(page, { state: 'compare', pcs: PCS, pc: 'DESK-PC', code: '571 156', attempt: 7 });
    await expect(page.locator('.wl-code')).toHaveText('571 156');
    await page.getByRole('button', { name: 'Yes, it is there' }).click();
    expect(await calls(page, 'nearbyAnswer')).toEqual([['nearbyAnswer', 'k', 7, true]]);
    await near(page, { state: 'waiting', pcs: PCS, pc: 'DESK-PC', code: '571 156' });
    await expect(page.locator('#wlNear')).toContainText('Now pick this number on DESK-PC');
    await expect(page.locator('.wl-code')).toHaveText('571 156');
  });

  test('a different number and leaving the comparison both refuse', async ({ page }) => {
    await open(page);
    await way(page, 'wifi').click();
    await near(page, { state: 'compare', pcs: PCS, pc: 'DESK-PC', code: '571 156' });
    await page.getByRole('button', { name: 'No, cancel' }).click();
    await near(page, { state: 'compare', pcs: PCS, pc: 'DESK-PC', code: '571 157' });
    await page.locator('#wlBack').click();
    expect(await calls(page, 'nearbyAnswer')).toEqual([['nearbyAnswer', 'k', 0, false], ['nearbyAnswer', 'k', 0, false]]);
  });

  test('says when nothing is found, when there is no Wi-Fi and when it failed', async ({ page }) => {
    await open(page);
    await way(page, 'wifi').click();
    await expect(page.locator('#wlNear')).toHaveText('Looking for your computer on this Wi-Fi…');
    await near(page, { wifi: false });
    await expect(page.locator('#wlNear')).toHaveText('This phone is not on Wi-Fi');
    await near(page, { state: 'failed', pcs: PCS, pc: 'DESK-PC' });
    await expect(page.locator('#wlNear')).toContainText('Could not connect to DESK-PC. Try again.');
    await expect(page.locator('.wl-pc')).toHaveCount(1);
  });

  test("a computer's name is text, never markup", async ({ page }) => {
    await open(page);
    await way(page, 'wifi').click();
    await near(page, { pcs: [{ id: 'aa', name: '<img src=x onerror="window.__bad=1">' }] });
    await expect(page.locator('.wl-pc')).toContainText('<img src=x');
    await expect(page.locator('.wl-pc img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__bad)).toBeUndefined();
  });

  test('the app starts looking again when it comes back to the front', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { window.onAppPause(true); window.onAppPause(false); });
    expect(await calls(page, 'nearbySearch')).toEqual([['nearbySearch', 'k', true], ['nearbySearch', 'k', true]]);
  });

  test('an unchanged answer does not rebuild the list under the finger', async ({ page }) => {
    await open(page);
    await way(page, 'wifi').click();
    await near(page, { pcs: PCS });
    await page.evaluate(() => { document.querySelector('.wl-pc').__same = true; });
    await near(page, { pcs: PCS });
    expect(await page.evaluate(() => document.querySelector('.wl-pc').__same)).toBe(true);
  });
});

test('a phone that is already paired sees the usual offline panel instead', async ({ page }) => {
  await open(page, { pcs: [{ id: 'pc1', name: 'Desk', active: true }] });
  await expect(page.locator('#welcome')).toBeHidden();
  expect(await calls(page, 'nearbySearch')).toEqual([]);
});

test('the screen goes away once the computer is connected, and nothing is looked for any more', async ({ page }) => {
  await open(page);
  await expect(page.locator('#welcome')).toBeVisible();
  await page.evaluate(async () => (await import('/panel/main.js')).setOnline(true));
  await expect(page.locator('#welcome')).toBeHidden();
  expect((await calls(page, 'nearbySearch')).at(-1)).toEqual(['nearbySearch', 'k', false]);
});

for (const [w, h] of [[780, 360], [915, 412], [360, 780], [1280, 800]]) {
  test(`everything fits without scrolling at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, { usb: USB });
    const over = () => page.evaluate(() => {
      const box = document.getElementById('welcome');
      return { x: Math.max(0, box.scrollWidth - box.clientWidth), y: Math.max(0, box.scrollHeight - box.clientHeight) };
    });
    expect(await over()).toEqual({ x: 0, y: 0 });
    for (const name of ['usb', 'wifi', 'qr']) {
      await way(page, name).click();
      expect(await over(), name).toEqual({ x: 0, y: 0 });
      await page.locator('#wlBack').click();
    }
  });
}

test.describe('Korean', () => {
  test.use({ locale: 'ko-KR', viewport: { width: 780, height: 360 } });
  test('reads in Korean', async ({ page }) => {
    await open(page, { usb: USB });
    await expect(page.locator('#welcome h1').first()).toHaveText('이 공기계를 컴퓨터와 연결해요');
    await expect(way(page, 'usb')).toContainText('USB로 연결');
    await expect(way(page, 'wifi')).toContainText('Wi-Fi로 연결');
    await expect(way(page, 'qr')).toContainText('QR로 연결');
    await expect(page.locator('#wlSend')).toHaveText('컴퓨터로 링크 보내기');
    if (!process.env.SHOT) return;
    await near(page, { pcs: PCS });
    await page.screenshot({ path: `${process.env.SHOT}-1.png` });
    for (const name of ['usb', 'qr', 'wifi']) {
      await way(page, name).click();
      await page.screenshot({ path: `${process.env.SHOT}-${name}.png` });
      if (name !== 'wifi') await page.locator('#wlBack').click();
    }
    await near(page, { state: 'compare', pcs: PCS, pc: 'DESK-PC', code: '571 156' });
    await page.screenshot({ path: `${process.env.SHOT}-compare.png` });
  });
});
