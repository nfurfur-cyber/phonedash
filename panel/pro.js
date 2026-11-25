// PhoneDash Pro: what the free app leaves locked, and the sheet that sells the one-time unlock. The purchase itself is
// Google Play's, kept by the Android app (ProStore.kt), which answers through bridge.pro() and window.onProChange.
// Outside the app (a desktop browser, the layout editor's preview) nothing is sold, so nothing is locked.
//
// Free: the home page (the first page, or the one set as Home), the first FREE_BUTTONS buttons and the default theme.
// Pro: every page (and so the rules that switch between them), every button and the colour themes.
// Like the widgets, this module only uses main.js from its functions, never while it loads.
import { $, applyDisplay, bridge, buildLayout, cfg, emo, h, haptic, icon, PREVIEW, rich, t, toast, WIDGET_ICONS } from './main.js';
import { stat } from './stats.js';

/** Buttons that work without Pro: the first ones in the computer's shortcut list. */
export const FREE_BUTTONS = 8;

const EMPTY = Object.freeze({ state: 'free', price: '', ready: false, problem: '' });
let info = null;
let themeNoted = false;

/** The app sells Pro; anywhere else everything is open. */
export const sellsPro = () => !PREVIEW && typeof bridge?.pro === 'function';

function current() {
  if (info) return info;
  try {
    const answer = JSON.parse(bridge.pro());
    // no state: the bridge key has not arrived yet (an old WebView); ask again next time
    if (answer && answer.state) info = { ...EMPTY, ...answer };
  } catch (_) {}
  return info || EMPTY;
}

/** "free", "pending" or "pro". */
export const proState = () => (sellsPro() ? current().state : 'pro');

export const isPro = () => !sellsPro() || current().state === 'pro';

/** Index of the page the free app shows, among the enabled pages; -1 when every page is open. */
export function freePage(pages) {
  if (isPro()) return -1;
  const home = cfg.display?.homePage;
  const i = home ? pages.findIndex((p) => p.id === home) : -1;
  return i >= 0 ? i : 0;
}

/** Whether a shortcut button works: with Pro every one does, without it the first FREE_BUTTONS of the list. */
export function buttonOpen(id) {
  if (isPro()) return true;
  const i = (cfg.shortcuts || []).findIndex((s) => s.id === id);
  return i >= 0 && i < FREE_BUTTONS;
}

/** The theme the panel may use: the chosen one with Pro, the default one without. */
export function allowedTheme(theme) {
  if (isPro() || !theme || theme === 'default') return theme;
  // checked again when the toast is due: Play may have answered "Pro" meanwhile
  if (!themeNoted) { themeNoted = true; setTimeout(() => { if (!isPro()) toast(t('pro.themeLocked'), '', 'Pro', 4); }, 1500); }
  return 'default';
}

/** What a locked page shows in place of its widgets: its name, what is on it and the way to Pro. */
export function lockedPage(p) {
  const kinds = [...new Set((p.widgets || []).map((w) => w.type))].slice(0, 8);
  const btn = h('button', 'pl-go', t('pro.see'));
  btn.addEventListener('click', (e) => { e.stopPropagation(); openPro('page'); });
  return h('div', 'pro-lock',
    h('div', 'pl-ico', icon('lock')),
    h('b', 'pl-title', rich(t('pro.pageLocked', { page: `${p.icon || ''} ${p.title || ''}`.trim() }))),
    h('span', 'pl-text', t('pro.pageLockedHint')),
    kinds.length ? h('div', 'pl-widgets', ...kinds.map((k) => h('span', null, emo(WIDGET_ICONS[k] || '◻')))) : '',
    btn);
}

/** A button past the free ones: shown, but it opens the Pro sheet instead of running. */
export function lockedKey(s, { label = true } = {}) {
  const b = h('button', 'key k-locked' + (label ? '' : ' k-nolabel'), h('span', 'k-icon', icon('lock')), h('span', 'k-label', s.label));
  b.setAttribute('aria-label', t('pro.buttonLocked', { name: String(s.label || s.id || '').trim() }));
  b.style.setProperty('--k', '#4b5563');
  b.dataset.id = s.id;
  b.addEventListener('click', (e) => { e.stopPropagation(); openPro('button'); });
  return b;
}

// ---------------------------------------------------------------- the sheet
let sheet = null;

export function openPro(from) {
  if (!sellsPro()) return;
  haptic();
  stat('pro_open', { from });
  if (!sheet) {
    sheet = h('div', null);
    sheet.id = 'pro';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closePro(); });
    document.body.appendChild(sheet);
  }
  sheet.hidden = false;
  // the price may have changed, or Play may only now be reachable
  if (current().state !== 'pro' && !current().ready) bridge.restorePro?.();
  renderPro();
}

export function closePro() { if (sheet) sheet.hidden = true; }

function renderPro() {
  if (!sheet || sheet.hidden) return;
  const p = current();
  const owned = p.state === 'pro';
  const perks = [
    ['layout-grid', t('pro.perkPages')],
    ['zap', t('pro.perkRules')],
    ['sliders-horizontal', t('pro.perkButtons', { n: FREE_BUTTONS })],
    ['palette', t('pro.perkThemes')],
  ];
  const close = h('button', 'pr-close', icon('x'));
  close.setAttribute('aria-label', t('panel.close'));
  close.addEventListener('click', closePro);
  const status = owned ? t('pro.owned') : p.state === 'pending' ? t('pro.pending') : p.problem ? t(`pro.problem.${p.problem}`) : '';
  const buy = h('button', 'pr-buy', p.price ? t('pro.buyPrice', { price: p.price }) : t('pro.buy'));
  buy.disabled = owned || p.state === 'pending';
  buy.addEventListener('click', () => {
    haptic();
    stat('pro_buy', { problem: p.problem || 'none' });
    if (!bridge.buyPro?.()) toast(t(p.problem ? `pro.problem.${p.problem}` : 'pro.notReady'), 'warn');
  });
  const restore = h('button', 'pr-restore', t('pro.restore'));
  restore.addEventListener('click', () => { haptic(); bridge.restorePro?.(); toast(t('pro.restoring')); });
  sheet.replaceChildren(h('div', 'pr-card',
    close,
    h('div', 'wl-eyebrow', 'PHONEDASH PRO'),
    h('h1', null, owned ? t('pro.titleOwned') : t('pro.title')),
    h('ul', 'pr-perks', ...perks.map(([ic, text]) => h('li', null, icon(ic), h('span', null, text)))),
    h('p', 'pr-once', p.price ? t('pro.oncePrice', { price: p.price }) : t('pro.once')),
    status ? h('p', 'pr-status' + (owned ? ' ok' : ''), status) : '',
    owned ? '' : h('div', 'wl-btns', buy, restore),
    h('p', 'pr-note', t('pro.note'))));
}

/** Google Play answered (ProStore.kt): a purchase, a refund, a price, or why it could not help. */
window.onProChange = (next) => {
  const was = isPro();
  info = { ...EMPTY, ...(next || {}) };
  if (isPro() !== was) {
    buildLayout();
    applyDisplay();
    if (isPro()) { toast(t('pro.thanks'), 'ok', 'Pro', 4); closePro(); }
  }
  renderPro();
};
