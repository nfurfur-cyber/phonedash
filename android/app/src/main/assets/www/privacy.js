// The link to the privacy policy: on the first-start screen, in the question about statistics and in the page overview.
// The app opens its own fixed address in the phone's browser (MainActivity.openPrivacy), so nothing in the panel, a
// Custom HTML widget included, can make it open another one. Outside the app the links stay hidden.
import { bridge, haptic, PREVIEW } from './main.js';

/** Called by main.js once the panel stands. */
export function startPrivacy() {
  if (PREVIEW || typeof bridge?.openPrivacy !== 'function') return;
  for (const link of document.querySelectorAll('[data-privacy]')) {
    link.hidden = false;
    link.addEventListener('click', (e) => {
      e.stopPropagation(); // the overview closes on a tap beside its tiles
      haptic();
      bridge.openPrivacy();
    });
  }
}
