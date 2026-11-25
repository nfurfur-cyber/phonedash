// First start: in the app, before any computer has been paired and while none answers (not even over USB), the panel
// would only say "PC not connected". Instead it offers three ways to connect: a USB cable, the same Wi-Fi (the app finds
// the computer, both screens show one number) and the QR code. A cable works whichever way is open.
// Like the widgets, this module only uses main.js from its functions, never while it loads.
import { $, bridge, h, haptic, icon, pairedPcs, t, toast } from './main.js';

const WAYS = ['usb', 'wifi', 'qr'];
const USB_POLL_MS = 1500;
const COMPARING = ['asking', 'compare', 'waiting'];

let way = null;
let near = { state: 'searching', wifi: true, pcs: [], pc: '', code: '', attempt: 0 };
let searching = false;
let usbTimer = 0;

const siteUrl = () => String(window.__phonedashSite || '');
const shown = () => !!$('welcome') && !$('welcome').hidden;

/** Shows or hides the screen; called whenever the connection or the list of computers changes. */
export function welcomeRender() {
  const box = $('welcome');
  if (!box) return;
  box.hidden = !(bridge && document.body.classList.contains('offline') && pairedPcs().length === 0);
  if (box.hidden) way = null;
  else {
    const address = siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, '');
    for (const el of box.querySelectorAll('[data-site]')) el.textContent = address;
  }
  render();
}

/** Back from one way to the three; false when there is nothing to go back from. */
export function welcomeBack() {
  if (!shown() || !way) return false;
  choose(null);
  return true;
}

function choose(next) {
  if (way === 'wifi' && COMPARING.includes(near.state)) answer(false);
  way = next;
  render();
  // the screen changed under the finger or the screen reader: carry on where the new part starts
  (next ? $('wlBack') : $('welcome').querySelector('.wl-way'))?.focus({ preventScroll: true });
}

function render() {
  const open = shown();
  search(open);
  clearInterval(usbTimer);
  usbTimer = open && way === 'usb' ? setInterval(usbRender, USB_POLL_MS) : 0;
  if (!open) return;
  $('wlPick').hidden = !!way;
  $('wlSteps').hidden = !way;
  for (const w of WAYS) $('wl-' + w).hidden = w !== way;
  if (way) $('wlTitle').textContent = t('welcome.' + way);
  if (way === 'usb') usbRender();
  nearRender();
}

// ---- same Wi-Fi: the app looks for computers while this screen is open (NearbyPairing.kt)
function search(on) {
  if (!bridge?.nearbySearch || on === searching) return;
  searching = on;
  if (on) near = { ...near, state: 'searching', pcs: [] };
  bridge.nearbySearch(on);
}

export function startWelcome() {
  // the app stops looking while it is in the background; main.js calls this again when it comes back
  searching = false;
  render();
}

window.onNearby = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return;
  near = { ...near, ...snapshot, pcs: Array.isArray(snapshot.pcs) ? snapshot.pcs : [] };
  nearRender();
};

function nearRender() {
  if (!shown()) return;
  // the choice says at once that a computer was found
  const first = near.pcs[0]?.name;
  $('wlWifiHint').textContent = first ? t('welcome.found', { pc: first }) : t('welcome.wifiHint');
  $('welcome').querySelector('[data-way="wifi"]').classList.toggle('found', !!first);
  if (way !== 'wifi') return;
  const box = $('wlNear');
  const key = JSON.stringify(near);
  if (box.dataset.key === key) return; // the same: a rebuild would take the button from under the finger
  box.dataset.key = key;
  box.replaceChildren(...nearContent());
}

function button(label, cls, onTap) {
  const b = h('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', () => { haptic(); onTap(); });
  return b;
}

const answer = (same) => bridge?.nearbyAnswer?.(near.attempt, same);

function nearContent() {
  const pc = near.pc;
  if (near.state === 'asking') return [h('p', 'wl-live', t('near.asking', { pc }))];
  if (near.state === 'compare') return [
    h('p', 'wl-live', t('near.compare', { pc })), h('div', 'wl-code', near.code),
    h('div', 'wl-btns', button(t('near.same'), 'wl-primary', () => answer(true)), button(t('near.different'), '', () => answer(false))),
  ];
  if (near.state === 'waiting') return [
    h('p', 'wl-live', t('near.waitPc', { pc })), h('div', 'wl-code', near.code),
    h('div', 'wl-btns', button(t('near.different'), '', () => answer(false))),
  ];
  const list = near.pcs.map((p) => {
    const b = button('', 'wl-pc', () => bridge.nearbyPair(p.id));
    b.append(icon('monitor'), h('b', '', p.name));
    return b;
  });
  return [
    near.state === 'failed' ? h('p', 'wl-live bad', t('near.failed', { pc })) : null,
    ...(list.length ? list : [h('p', 'wl-live', t(near.wifi === false ? 'near.noWifi' : 'near.searching'))]),
  ].filter(Boolean);
}

// ---- USB: what the phone itself knows about the cable
function usbRender() {
  let usb = null;
  try { usb = JSON.parse(bridge.battery())?.usb; } catch (_) { /* no answer: say nothing about the cable */ }
  const plugged = !!usb && (usb.configured || usb.connected);
  const state = !usb ? '' : !plugged ? 'near.usbNone' : usb.adb ? 'near.usbReady' : 'near.usbDebug';
  $('wlUsb').textContent = state ? t(state) : '';
  $('wlUsb').classList.toggle('ok', state === 'near.usbReady');
}

function openOr(open, fallback) {
  haptic();
  if (typeof open !== 'function' || !open()) toast(t(fallback));
}

/** Connects the buttons once; called by main.js when the panel stands. */
export function bindWelcome() {
  if (!$('welcome')) return;
  for (const b of $('welcome').querySelectorAll('[data-way]')) b.addEventListener('click', () => { haptic(); choose(b.dataset.way); });
  $('wlBack').addEventListener('click', () => { haptic(); choose(null); });
  $('wlUsbSettings').addEventListener('click', () => openOr(bridge?.openUsbSettings, 'near.usb1Hint'));
  $('wlCamera').addEventListener('click', () => openOr(bridge?.openCamera, 'welcome.s2Hint'));
  $('wlSend').addEventListener('click', () => {
    haptic();
    const text = t('welcome.shareText', { url: siteUrl() });
    if (!bridge?.share || !bridge.share(text)) toast(siteUrl());
  });
  $('wlCopy').addEventListener('click', async () => {
    haptic();
    try { await navigator.clipboard.writeText(siteUrl()); toast(t('welcome.copied')); } catch (_) { toast(siteUrl()); }
  });
}
