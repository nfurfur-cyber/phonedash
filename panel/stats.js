// Usage statistics in the panel: the question (off until the user says yes), the switch in the page overview and the
// few things that are counted. The app drops everything that is not on its own list (UsageEvents.kt). Also tells the
// app about quiet moments, when Google Play's rating card may come up (ReviewAsk.kt).
// Outside the app, or in a build without a Firebase project, nothing is asked and nothing is counted.
// Like pro.js, this module only uses main.js from its functions, never while it loads.
import { $, allPages, bridge, cfg, haptic, icon, idle, nightOn, online, PREVIEW, sheet, store, t, transport } from './main.js';
import { proState } from './pro.js';

const ASK_AFTER_MS = 60_000;   // the dashboard has been up for a minute: the setup is over
const TICK_MS = 10_000;
const QUIET_MS = 6000;         // after the last touch

let onlineSince = 0;
let putAway = false; // Back on the question: not asked again until the next start

function usage() {
  if (PREVIEW || typeof bridge?.usage !== 'function') return { available: false, choice: 'unset' };
  try { return JSON.parse(bridge.usage()); } catch (_) { return { available: false, choice: 'unset' }; }
}

/** Counts something, when the user agreed to it. */
export function stat(name, params = {}) {
  if (PREVIEW) return;
  try { bridge?.stat?.(name, JSON.stringify(params)); } catch (_) {}
}

/** Nothing is open over the dashboard, so a question does not get in the way. */
const calm = () => online === true && !idle() && !nightOn && !sheet && !document.querySelector('.note-edit, .session-backdrop')
  && ['overview', 'approval', 'pro', 'welcome', 'usageAsk'].every((id) => !$(id) || $(id).hidden);

// ---------------------------------------------------------------- the question and the switch
export function answerUsage(on) {
  haptic();
  bridge.setUsage?.(on);
  $('usageAsk').hidden = true;
}

/** Back: puts the question away without an answer. True when it was there. */
export function dismissUsage() {
  if ($('usageAsk').hidden) return false;
  putAway = true;
  $('usageAsk').hidden = true;
  return true;
}

export function askUsage() {
  const u = usage();
  if (u.available && u.choice === 'unset' && !putAway && calm()) $('usageAsk').hidden = false;
}

/** The overview's switch: shown wherever statistics exist, so the answer can be changed at any time. */
export function renderUsageBtn() {
  const b = $('ovUsage');
  const u = usage();
  b.hidden = !u.available;
  if (b.hidden) return;
  const on = u.choice === 'on';
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.replaceChildren(icon('chart-column', 'm'), t(on ? 'usage.stateOn' : 'usage.stateOff'));
}

export function toggleUsage() {
  answerUsage(usage().choice !== 'on');
  renderUsageBtn();
}

// ---------------------------------------------------------------- once a day
function daily() {
  if (usage().choice !== 'on') return;
  const today = new Date().toDateString();
  if (store.get('statDay', '') === today) return;
  store.set('statDay', today);
  const widgets = allPages.flatMap((p) => p.widgets || []);
  stat('panel_day', {
    link: transport() || 'none', pages: allPages.length, buttons: (cfg.shortcuts || []).length, widgets: widgets.length,
    theme: cfg.display?.theme || 'default', lang: document.documentElement.lang || 'en', pro: proState(),
  });
  for (const widget of new Set(widgets.map((w) => w.type))) stat('widget_day', { widget });
}

/** Once per day and name: for things that are seen again and again. */
export function statOnceADay(name, params) {
  const today = new Date().toDateString();
  const key = 'stat:' + name;
  if (usage().choice !== 'on' || store.get(key, '') === today) return;
  store.set(key, today);
  stat(name, params);
}

export function tick() {
  if (!online || idle()) { onlineSince = 0; return; }
  if (!onlineSince) onlineSince = Date.now();
  if (Date.now() - onlineSince >= ASK_AFTER_MS) askUsage();
  daily();
}

// ---------------------------------------------------------------- quiet moments
let quietTimer = 0;
function touched(e) {
  clearTimeout(quietTimer);
  // someone pressing buttons or typing is busy with the computer: wait for a touch that only looks around
  if (e.target?.closest?.('button, a, input, textarea, select, [role=button], .deck-trackpad')) return;
  quietTimer = setTimeout(() => { if (calm()) bridge.quietMoment?.(); }, QUIET_MS);
}

/** Called by main.js once the panel stands. */
export function startStats() {
  if (PREVIEW || !bridge) return;
  $('usYes').addEventListener('click', () => answerUsage(true));
  $('usNo').addEventListener('click', () => answerUsage(false));
  if (typeof bridge.usage === 'function') setInterval(tick, TICK_MS);
  if (typeof bridge.quietMoment === 'function') document.addEventListener('pointerup', touched, { passive: true });
}
