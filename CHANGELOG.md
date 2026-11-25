# Changelog

## Unreleased

**Android app**
- Free on Google Play, with PhoneDash Pro: a one-time in-app purchase through Google Play Billing 9 (no subscription,
  no server). Without Pro the panel shows the home page, the first 8 buttons and the default theme; one more page
  stands for all the others and leads to Pro, rules and webhooks leave it alone, and the extra buttons are greyed. Pro opens
  every page, button and theme. **See Pro** (in the page overview and on that page), **Restore
  purchase**, pending payments and refunds are handled; outside the app (a browser, the layout editor's preview)
  nothing is locked. In all 23 languages.
- New home page: the **Home board** widget fills a page and is drawn by the theme. The default theme shows two dials in a
  green instrument panel, with the clock, weather, music, memory, network, volume and the phone's battery. Two new themes
  come with Pro: **Tear-off calendar** (today's sheet, the next events, music) and **Keycaps** (a small keyboard with the
  first six shortcuts and the media keys). The default theme is green on every page now; the other colour themes look as
  before. New installations start with it; existing layouts keep their pages and can add
  it from the templates. In all 23 languages.
- The media widget no longer draws its note over the album art.
- Opt-in usage statistics (Google Analytics for Firebase): asked once the dashboard has been connected for a minute, off
  until the answer is yes, with a switch in the page overview. Only the events in `UsageEvents.kt` can be sent, without
  titles, texts, PC readings or an advertising ID. Needs the developer's `google-services.json`; without it there is
  nothing to ask or send.
- The privacy policy is linked inside the app: on the first-start screen, in the question about statistics and in the page
  overview. It opens in the phone's browser. The policy says how to have data deleted.
- The first-start screen offers three ways to connect: a USB cable (it says whether the cable is in and USB debugging is on,
  and opens the settings page for it), the same Wi-Fi (the phone finds the computer, the phone shows a six-digit number,
  and the same one is picked on the computer) and the QR code. Back leaves a way. In all 23 languages.
- Google Play's own rating card (In-App Review) after a week with five days of use, at a quiet moment.
- Needs Android 7.0 (API 24) or later: Google Play Billing 8.1 and later does not run on Android 5, and Google Play's
  automatic protection does not run on Android 6.
- The panel no longer keeps the default night screen up for up to a second after the PC's settings turned it off, which
  swallowed the first touch.

**Computer program**
- The pairing dialog says what the USB cable is doing and closes once a phone connects over it. While it is open, phones on
  the same Wi-Fi can find this computer (UDP 8776) and ask to pair: the dialog shows the phone's model and three numbers; the
  one on the phone is picked, any other refuses. With the dialog closed, nothing is answered.
- Leftover PhoneBox names in five translations and in the names of exported files are gone.

## 1.0.0 — 2026-11-22

First release of PhoneDash (폰대시), based on PhoneBox 0.9.27 by Ersin KOÇ (MIT licence; its history is in the
PhoneBox repository, <https://github.com/ersinkoc/phonebox/blob/main/CHANGELOG.md>).

**Android app**
- New name, icon and package (`kr.phonedash.app`) for Google Play; targets Android 16 (API 36).
- The Wi-Fi pairing link and the help text point to the PhoneDash site; a debug build points nowhere, and a release
  build refuses to build without the site owner (`tools/set-owner.mjs`).
- Korean interface reviewed: times ("2분 전", "3일 4시간"), quota pace, waiting counts and many settings texts read as
  natural Korean.

**PC program (Windows)**
- One file to download: `PhoneDash-Setup.exe` installs itself for the current user (Start menu, sign-in start,
  Apps & features entry), opens the setup page, and removes itself with `--uninstall`.
- Downloads Google's adb (Android SDK Platform-Tools) by itself when the computer has none.
- "Install the phone app" opens the PhoneDash page on Google Play on the phone instead of installing an APK; updates
  of the PC program come from the PhoneDash releases only.
- Its own ports (8775 on the computer, 8776 for Wi-Fi), so it runs next to PhoneBox without a conflict.
- `/licenses` shows the MIT licence and the third-party notices.
