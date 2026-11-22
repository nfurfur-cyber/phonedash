# Changelog

## 1.0.0 — 2026-11-22

First release of PhoneDash (폰대시), based on PhoneBox 0.9.27 by Ersin KOÇ (MIT licence; its history is in the
PhoneBox repository, <https://github.com/ersinkoc/phonebox/blob/main/CHANGELOG.md>).

**Android app**
- New name, icon and package (`kr.phonedash.app`), sold on Google Play; targets Android 16 (API 36).
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
