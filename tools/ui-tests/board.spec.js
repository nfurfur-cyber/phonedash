// The home board (widgets/board.js): one page drawn by the theme, the dials without Pro and the other looks with it.
const { test, expect } = require('@playwright/test');

const BOARD = [{ id: 'home', title: 'Home', widgets: [{ id: 'b', type: 'board', x: 0, y: 0, w: 12, h: 6, options: {} }] }];
const KEYS = Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, label: 'Key ' + i, icon: '⭐' }));
const FREE = { state: 'free', price: '', ready: true, problem: '' };
const PRO = { ...FREE, state: 'pro' };

async function open(page, { theme = 'default', pro = null, shortcuts = KEYS, language = 'en', extra = [], h = 6 } = {}) {
  await page.addInitScript((state) => {
    if (!state) return;
    window.__phoneboxKey = 'k';
    window.Android = { pro: (key) => (key === 'k' ? JSON.stringify(state) : '{}'), battery: () => JSON.stringify({ level: 64, plugged: false }) };
  }, pro);
  await page.goto('/panel/style.css');
  await page.evaluate((cfg) => {
    localStorage.clear();
    localStorage.setItem('pb-demo-config', JSON.stringify({ night: { enabled: false }, rules: [], ...cfg }));
  }, { pages: [{ ...BOARD[0], widgets: [{ ...BOARD[0].widgets[0], h }, ...extra] }], shortcuts, display: { idleReturnSec: 0, theme, language } });
  await page.goto('/panel/');
  await expect(page.locator('.w-board')).toBeVisible();
}

const look = (page, name) => expect(page.locator('.w-board')).toHaveClass(new RegExp(`\\bbd-${name}\\b`));

/** Nothing the board shows may stick out of it, and no two of its blocks may cover each other. */
async function fits(page) {
  const problems = await page.evaluate(() => {
    const board = document.querySelector('.w-board'), b = board.getBoundingClientRect(), out = [];
    for (const e of board.querySelectorAll('.bd-time, .bd-date, .bd-wx, .bd-m, .bd-gauge, .bd-cal, .bd-media .ic, .key, .m-title, .bar, .vol')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1) out.push(`${e.className} outside`);
    }
    const blocks = [...board.querySelectorAll('.bd-time, .bd-date, .bd-wx, .bd-gauge, .bd-strip, .bd-cal, .bd-media [data-media], .key, .m-title, .vol')]
      .map((e) => [e.className, e.getBoundingClientRect()]).filter(([, r]) => r.width && r.height);
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
      const [na, a] = blocks[i], [nb, c] = blocks[j];
      const w = Math.min(a.right, c.right) - Math.max(a.left, c.left), h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (w > 2 && h > 2) out.push(`${na} over ${nb}`);
    }
    return out;
  });
  expect(problems).toEqual([]);
}

test('a fresh panel starts with the board', async ({ page }) => {
  await page.goto('/panel/');
  await expect(page.locator('#pager .page').first().locator('.w-board.bd-dial')).toBeVisible();
});

for (const [theme, name] of [['default', 'dial'], ['amoled', 'dial'], ['calendar', 'calendar'], ['keycap', 'keycap']]) {
  test(`${theme}: the board fits every screen`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 26, 10, 8)); // the demo's day has three events left: the fullest board
    await open(page, { theme, pro: PRO });
    await look(page, name);
    // a font with tall lines (Korean, Linux) must not push the last rows out
    expect(await page.locator('.w-board').evaluate((e) => getComputedStyle(e).lineHeight)).not.toBe('normal');
    if (name === 'calendar') await expect(page.locator('.bd-events .bd-ev')).toHaveCount(3);
    for (const [width, height] of [[640, 320], [780, 360], [915, 412], [1280, 800], [360, 640], [360, 780], [800, 1280]]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator('.w-board')).toHaveClass(height > width ? /\btall\b/ : /^(?!.*\btall\b)/);
      await expect(page.locator('.w-board .bd-hm')).toHaveText(/^\d{1,2}:\d{2}$/);
      await expect.poll(async () => { try { await fits(page); return ''; } catch (e) { return `${width}x${height}: ${e.message}`; } }).toBe('');
    }
  });
}

test('without Pro the board stays on the dials, and a purchase opens the theme', async ({ page }) => {
  await open(page, { theme: 'keycap', pro: FREE });
  await look(page, 'dial');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'default');
  await expect(page.locator('#toast')).toContainText('The other themes come with Pro');
  await page.evaluate((s) => window.onProChange(s), PRO);
  await look(page, 'keycap');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'keycap');
  // refunded: back to the dials
  await page.evaluate((s) => window.onProChange(s), FREE);
  await look(page, 'dial');
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'default');
});

test('the default board draws the PC, the phone battery and the song', async ({ page }) => {
  await open(page, { pro: FREE });
  await expect(page.locator('.bd-gauge').first().locator('.n')).toHaveText(/^\d+$/);
  await expect(page.locator('.bd-gauge').first().locator('.sub')).toHaveText(/^CPU \d+°C$/);
  await expect(page.locator('.bd-strip .bd-m').nth(3)).toContainText('64 %');
  await expect(page.locator('.bd-media .m-title')).not.toBeEmpty();
});

test('a PC that reports no CPU temperature shows the name alone', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const m = await import('/panel/main.js');
    m.D.state = { ...m.D.state, pc: { ...m.D.state.pc, cpuTemp: null, cpu: 12 }, audio: null };
    m.mounted[0].inst.update('state');
  });
  const gauge = page.locator('.bd-gauge').first();
  await expect(gauge.locator('svg')).toHaveAttribute('aria-label', /^CPU \d+%$/);
});

test('the calendar theme shows today and what is next', async ({ page }) => {
  const now = new Date(2026, 10, 26, 10, 8); // not near midnight, where the demo's events fall on two days
  await page.clock.setFixedTime(now);
  await open(page, { theme: 'calendar', pro: PRO });
  await expect(page.locator('.bd-day')).toHaveText(String(now.getDate()));
  await expect(page.locator('.bd-week span')).toHaveCount(7);
  await expect(page.locator('.bd-week .on')).toHaveText(String(now.getDate()));
  await expect(page.locator('.bd-events .up')).toHaveCount(1);
});

test('the keycap theme runs the first shortcuts and the media keys', async ({ page }) => {
  await open(page, { theme: 'keycap', pro: PRO });
  await expect(page.locator('.w-board .key')).toHaveCount(6);
  await page.locator('.w-board .key[data-id="s1"]').click();
  await expect(page.locator('.w-board .key[data-id="s1"]')).toHaveClass(/\bok\b/);
  const playing = page.locator('.w-board .bd-media');
  const before = await playing.evaluate((e) => e.classList.contains('playing'));
  await page.locator('.w-board [data-media="playpause"]').click();
  await expect.poll(() => playing.evaluate((e) => e.classList.contains('playing'))).toBe(!before);
});

test('the week starts where the language says', async ({ page }) => {
  await open(page, { theme: 'calendar', pro: PRO, language: 'ko' });
  await expect(page.locator('.bd-week span').first()).toHaveClass(/sun/);
  await open(page, { theme: 'calendar', pro: PRO, language: 'de' });
  await expect(page.locator('.bd-week span').last()).toHaveClass(/sun/);
});

test('next to another widget the board takes no more than its share in portrait', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page, { extra: [{ id: 'n', type: 'note', x: 0, y: 4, w: 12, h: 2, options: { text: 'Note' } }], h: 4 });
  await expect(page.locator('.w-note')).toBeVisible();
  await fits(page);
});

test('a lost connection is said in every look', async ({ page }) => {
  for (const theme of ['default', 'calendar', 'keycap']) {
    await open(page, { theme, pro: PRO });
    await page.evaluate(() => document.body.classList.add('offline'));
    const msg = page.locator('.bd-media .offline-msg');
    await expect(msg).toBeVisible();
    expect(await msg.evaluate((e) => e.scrollHeight <= e.clientHeight + 1 && e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  }
});

test('the note gives way to the album art', async ({ page }) => {
  await page.goto('/panel/style.css');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pb-demo-config', JSON.stringify({ night: { enabled: false }, display: { idleReturnSec: 0 },
    pages: [{ id: 'm', title: 'M', widgets: [{ id: 'm', type: 'media', x: 0, y: 0, w: 12, h: 6, options: {} }] }] })); });
  await page.goto('/panel/');
  const note = page.locator('.w-media .art-ph');
  await expect(page.locator('.w-media .art.on')).toHaveCount(1);
  await expect(note).toHaveCSS('opacity', '0');
  await page.locator('.w-media .art').evaluate((e) => e.classList.remove('on'));
  await expect(note).toHaveCSS('opacity', '1');
});

test('the keycap board without shortcuts leaves the key row out', async ({ page }) => {
  await open(page, { theme: 'keycap', pro: PRO, shortcuts: [] });
  await expect(page.locator('.w-board.nokeys .key')).toHaveCount(0);
  await fits(page);
});
