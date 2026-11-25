// The home board: one widget that fills the first page and is drawn by the theme. The default theme and the colour themes
// show two dials, "calendar" a tear-off calendar, "keycap" a small keyboard. Every theme but the default one comes with
// Pro (pro.js); boardLook() in main.js already answers with what the phone may show.
import { boardLook, bridge, cfg, D, emo, en, fmtDur, fmtHM, fmtRate, gpuOf, h, hour12, LOCALE, METRICS, metricText, pad, r1, t, tp, wxLines } from '../main.js';
import { W } from '../registry.js';
import { every } from './helpers.js';

// the size the looks are drawn for: --u is 1 there and scales every measure with the widget
const BASE = { w: 752, h: 333 }, BASE_TALL = { w: 332, h: 700 };
const BOARD_KEYS = 6, BOARD_EVENTS = 3;
const ARC = 'M56.6 223.4 A118 118 0 1 1 223.4 223.4';

const clamp = (v) => Math.min(100, Math.max(0, v));
/** A metric as a share of its own maximum, or null while the PC has not sent it. */
const share = (m, s) => {
  const v = m.pct ? m.pct(s) : m.val(s);
  if (v == null || !Number.isFinite(v)) return null;
  return clamp(m.pct ? v : (v / (m.max(s) || 1)) * 100);
};

/** A widget inside the board: it draws itself as on a page of its own, the board's styles only place it. */
function nest(ctx, type, options = {}) {
  const box = h('div', `w w-${type} bd-${type}`);
  const w = { ...ctx.w, id: `${ctx.w.id}:${type}`, type, options };
  const inst = W[type].create(box, { page: ctx.page, w, o: options, box }) || {};
  return { box, inst, needs: inst.needs || W[type].needs };
}

// ---------------------------------------------------------------- pieces shared by the looks
function timeText() {
  const num = h('span', 'bd-hm', '--:--'), ap = h('span', 'bd-ap');
  return { el: h('div', 'bd-time', num, ap), paint(now) {
    const H = now.getHours(), h12 = hour12();
    num.textContent = `${h12 ? H % 12 || 12 : pad(H)}:${pad(now.getMinutes())}`;
    ap.textContent = h12 ? (H < 12 ? 'AM' : 'PM') : '';
  } };
}

function weatherLine() {
  const ic = h('span', 'bd-wx-ic'), temp = h('b', 'bd-wx-t'), desc = h('span', 'bd-wx-d'), range = h('span', 'bd-wx-r');
  const el = h('div', 'bd-wx', ic, temp, h('div', 'bd-wx-m', desc, range));
  return { el, paint() {
    const l = wxLines();
    el.classList.toggle('none', !l);
    ic.replaceChildren(l ? emo(l.icon) : '');
    temp.textContent = l ? l.temp : '';
    desc.textContent = l ? l.desc.replace(/ · $/, '') : D.weather === null ? t('w.loading') : t('w.weatherUnavailable');
    range.textContent = l ? l.range : '';
  } };
}

function meter(label) {
  const val = h('span', 'bd-mv', '—'), fill = h('i');
  const el = h('div', 'bd-m', h('div', 'bd-mt', h('span', 'bd-mn', label), val), h('div', 'bd-mb', fill));
  return { el, set(pct, text, unit = '') {
    fill.style.width = (pct == null ? 0 : clamp(pct)) + '%';
    val.replaceChildren(text, unit ? h('small', null, ' ' + unit) : '');
  } };
}

/** A meter of one of the panel's metrics. */
function metricMeter(key, label) {
  const m = METRICS[key], it = meter(label);
  return { el: it.el, paint(s) {
    const pct = share(m, s);
    if (m.rate) it.set(pct, ...metricText(m, s));
    else it.set(pct, pct == null ? '—' : String(Math.round(pct)), pct == null ? '' : '%');
  } };
}

/** The phone's battery; in a browser, which has none to ask, the video memory takes its place. */
function phoneMeter() {
  if (!bridge) return { ...metricMeter('vram', 'VRAM'), load() {} };
  const it = meter(tp('PHONE'));
  it.el.classList.add('bd-phone');
  return { el: it.el, paint() {}, load: every(20_000, () => {
    try {
      const b = JSON.parse(bridge.battery());
      it.set(b.level, String(b.level), b.plugged ? '% ⚡' : '%');
    } catch (_) { it.set(null, '—'); }
  }) };
}

const pcMeters = () => [metricMeter('cpu', 'CPU'), metricMeter('gpu', 'GPU'), metricMeter('ram', tp('Memory')), metricMeter('down', tp('Download'))];

// ---------------------------------------------------------------- the default look: two dials
function dial(name) {
  const el = h('div', 'bd-gauge');
  // fixed markup; the numbers are set as text below
  el.innerHTML = `<svg viewBox="0 0 280 280" role="img"><circle class="rim" cx="140" cy="140" r="137"/><circle class="face" cx="140" cy="140" r="130"/><circle class="hub" cx="140" cy="140" r="72"/>
    <path class="hot" d="${ARC}" pathLength="1000"/><path class="fine" d="${ARC}" pathLength="1000"/><path class="tick" d="${ARC}" pathLength="1000"/>
    <g class="nums"><text x="77" y="207">0</text><text x="58" y="133">20</text><text x="102" y="73">40</text><text x="178" y="73">60</text><text x="222" y="133">80</text><text x="203" y="207">100</text></g>
    <g class="needle"><path d="M118 137 L246 139.2 L246 140.8 L118 143 Z"/></g><circle class="rim" cx="140" cy="140" r="15"/><circle class="pin" cx="140" cy="140" r="6"/>
    <text class="val" x="140" y="212"><tspan class="n"></tspan><tspan class="pc" dx="2"></tspan></text><text class="sub" x="140" y="246"></text></svg>`;
  const q = (s) => el.querySelector(s);
  return { el, set(pct, temp) {
    const text = pct == null ? '—' : Math.round(pct) + '%';
    q('.needle').style.transform = `rotate(${135 + 2.7 * (pct ?? 0)}deg)`;
    q('.n').textContent = pct == null ? '—' : Math.round(pct);
    q('.pc').textContent = pct == null ? '' : '%';
    q('.sub').textContent = temp == null ? name : `${name} ${Math.round(temp)}°C`;
    q('svg').setAttribute('aria-label', `${name} ${text}`);
  } };
}

function dialLook(box, ctx) {
  const cpu = dial('CPU'), gpu = dial('GPU'), time = timeText(), date = h('div', 'bd-date'), wx = weatherLine(), media = nest(ctx, 'media');
  const ram = meter(tp('Memory')), net = meter(tp('Network')), vol = meter(en('Volume')), phone = phoneMeter();
  cpu.set(null); gpu.set(null);
  box.append(cpu.el, h('div', 'bd-mid', time.el, date, wx.el, media.box), gpu.el, h('div', 'bd-strip', ram.el, net.el, vol.el, phone.el));
  return { kids: [media], weather: wx.paint,
    tick(now) {
      time.paint(now);
      date.textContent = now.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
      phone.load();
    },
    state(s) {
      cpu.set(share(METRICS.cpu, s), s.pc?.cpuTemp);
      gpu.set(share(METRICS.gpu, s), gpuOf(s)?.temp);
      const total = s.pc?.ramTotalGb;
      ram.set(share(METRICS.ram, s), total ? `${r1(s.pc.ramUsedGb)} / ${Math.round(total)}` : '—', total ? 'GB' : '');
      net.set(share(METRICS.net, s), ...fmtRate(s.pc?.netDownBps));
      vol.set(s.audio?.muted ? 0 : s.audio?.volume, s.audio ? String(s.audio.volume) : '—');
      phone.paint(s);
    } };
}

// ---------------------------------------------------------------- "calendar": a tear-off calendar
function sheet() {
  const month = h('span'), year = h('small'), day = h('div', 'bd-day'), weekday = h('div', 'bd-wd'), week = h('div', 'bd-week');
  const el = h('div', 'bd-cal', h('i', 'bd-under'), h('i', 'bd-under two'),
    h('div', 'bd-paper', h('div', 'bd-month', month, year), day, h('div', 'bd-foot', weekday, week)), h('div', 'bd-rail', h('i'), h('i')));
  let shown = '';
  return { el, paint(now) {
    const key = now.toDateString();
    if (key === shown) return;
    shown = key;
    month.textContent = now.toLocaleDateString(LOCALE, { month: 'long' });
    year.textContent = String(now.getFullYear());
    day.textContent = String(now.getDate());
    weekday.textContent = now.toLocaleDateString(LOCALE, { weekday: 'long' });
    const since = (now.getDay() - weekStart() + 7) % 7;
    week.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - since + i);
      const kind = d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '';
      return h('span', kind + (d.getDate() === now.getDate() ? ' on' : ''), String(d.getDate()));
    }));
  } };
}

/** The day a week starts on where the panel's language is spoken (0 = Sunday); Sunday when the browser cannot say. */
function weekStart() {
  try {
    const l = new Intl.Locale(LOCALE);
    return ((l.getWeekInfo?.() || l.weekInfo)?.firstDay ?? 7) % 7;
  } catch (_) { return 0; }
}

/** Today's timed events around now: the one before, then the next ones. */
function todayEvents(nowMs) {
  const today = new Date(nowMs).toDateString();
  const list = (D.calendar?.events || []).filter((e) => !e.allDay && new Date(e.start).toDateString() === today).sort((a, b) => a.start - b.start);
  const next = list.findIndex((e) => e.end > nowMs);
  const last = Math.max(0, list.length - BOARD_EVENTS);
  const from = next < 0 ? last : Math.max(0, Math.min(next - 1, last));
  return list.slice(from, from + BOARD_EVENTS);
}

function eventRow(e, nowMs, up) {
  const left = e.start > nowMs ? t('time.inDur', { dur: fmtDur(e.start - nowMs) }) : t('w.nowLeft', { dur: fmtDur(e.end - nowMs) });
  return h('div', 'bd-ev' + (e.end <= nowMs ? ' past' : up ? ' up' : ''),
    h('span', 'bd-ev-t', fmtHM(new Date(e.start))), h('span', 'bd-ev-n', e.title), up ? h('small', null, left) : '');
}

function eventList() {
  const el = h('div', 'bd-events');
  let key = '';
  return { el, paint(now) {
    const nowMs = now.getTime(), list = todayEvents(nowMs);
    const k = JSON.stringify([list.map((e) => [e.start, e.end, e.title]), Math.floor(nowMs / 15_000)]);
    if (k === key) return;
    key = k;
    const up = list.find((e) => e.end > nowMs);
    el.replaceChildren(...(list.length ? list.map((e) => eventRow(e, nowMs, e === up)) : [h('div', 'bd-none', t('w.noEvents'))]));
  } };
}

function calendarLook(box, ctx) {
  const cal = sheet(), time = timeText(), wx = weatherLine(), events = eventList(), media = nest(ctx, 'media'), meters = pcMeters();
  box.append(cal.el, h('div', 'bd-side', h('div', 'bd-head', time.el, wx.el), h('div', 'bd-row', events.el, media.box), h('div', 'bd-strip', meters.map((m) => m.el))));
  return { kids: [media], needs: ['calendar'], weather: wx.paint, calendar: () => events.paint(new Date()),
    tick(now) { cal.paint(now); time.paint(now); events.paint(now); },
    state(s) { for (const m of meters) m.paint(s); } };
}

// ---------------------------------------------------------------- "keycap": a small keyboard
function keycapLook(box, ctx) {
  const time = timeText(), day = h('span'), weekday = h('span'), wx = weatherLine(), media = nest(ctx, 'media'), meters = pcMeters();
  const ids = (cfg.shortcuts || []).slice(0, BOARD_KEYS).map((s) => s.id);
  const keys = ids.length ? nest(ctx, 'shortcuts', { ids, columns: BOARD_KEYS }) : null;
  // the weather is a keycap of the same grid as the media keys
  media.box.prepend(wx.el);
  for (const m of meters) m.el.classList.add('bd-cap');
  box.classList.toggle('nokeys', !keys);
  box.append(h('div', 'bd-top', h('div', 'bd-cap bd-clock', time.el, h('div', 'bd-date2', day, weekday)), meters.map((m) => m.el)), keys ? keys.box : '', media.box);
  return { kids: keys ? [media, keys] : [media], weather: wx.paint,
    tick(now) {
      time.paint(now);
      day.textContent = now.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
      weekday.textContent = now.toLocaleDateString(LOCALE, { weekday: 'long' });
    },
    state(s) { for (const m of meters) m.paint(s); } };
}

const LOOKS = { dial: dialLook, calendar: calendarLook, keycap: keycapLook };

W.board = {
  bare: true, needs: ['tick', 'fast', 'state', 'weather'],
  create(box, ctx) {
    const look = boardLook();
    box.classList.add('bd-' + look);
    const view = LOOKS[look](box, ctx);
    const size = () => {
      const w = box.clientWidth, hh = box.clientHeight;
      if (!w || !hh) return;
      const tall = hh > w * 1.05, base = tall ? BASE_TALL : BASE;
      box.classList.toggle('tall', tall);
      box.style.setProperty('--u', Math.min(w / base.w, hh / base.h).toFixed(3));
    };
    // in a frame of its own: sizing the board inside the callback would resize what is observed
    let frame = 0;
    const watch = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(size); });
    watch.observe(box);
    size();
    return {
      needs: [...new Set([...W.board.needs, ...(view.needs || []), ...view.kids.flatMap((k) => k.needs)])],
      update(kind) {
        if (kind === 'tick') view.tick(new Date());
        else if (kind === 'state' && D.state) view.state(D.state);
        else if (kind === 'weather') view.weather();
        else if (kind === 'calendar') view.calendar?.();
        for (const k of view.kids) if (k.needs.includes(kind)) k.inst.update?.(kind);
      },
      destroy() {
        watch.disconnect();
        cancelAnimationFrame(frame);
        for (const k of view.kids) k.inst.destroy?.();
      },
    };
  },
};
