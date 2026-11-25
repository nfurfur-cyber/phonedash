// The panel starts with the default night schedule until the PC's settings arrive: a night screen that they do not ask
// for must go as they are applied, or the first touch of the panel would only "wake" it.
const { test, expect } = require('@playwright/test');

test.use({ timezoneId: 'UTC' });

async function startAtNight(page, night) {
  await page.clock.setFixedTime(new Date('2026-01-01T03:00:00Z')); // inside the default night, 00:30 to 07:30
  await page.addInitScript((config) => localStorage.setItem('pb-demo-config', config), JSON.stringify({
    night, rules: [], shortcuts: [], pages: [{ id: 'only', title: 'Only', widgets: [{ id: 'n', type: 'note', x: 0, y: 0, w: 12, h: 6, options: { text: 'x' } }] }],
  }));
  await page.goto('/panel/');
  await page.waitForFunction(async () => (await import('/panel/main.js')).cfg.pages?.[0]?.id === 'only');
  return page.evaluate(async () => (await import('/panel/main.js')).nightOn);
}

test('settings without a night end the night screen the panel started with, without waiting for the clock', async ({ page }) => {
  expect(await startAtNight(page, { enabled: false })).toBe(false);
});

test('settings with another night schedule end it too', async ({ page }) => {
  expect(await startAtNight(page, { enabled: true, start: '22:00', end: '02:00', brightness: 0.02 })).toBe(false);
});

test('settings whose night it is keep the night screen', async ({ page }) => {
  expect(await startAtNight(page, { enabled: true, start: '22:00', end: '06:00', brightness: 0.02 })).toBe(true);
});
