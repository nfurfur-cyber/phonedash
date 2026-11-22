// Checks the metadata and catalogs every PhoneDash release ships with. Exits non-zero on the first problem.
// Usage: node tools/check-release.mjs [--release]
//   --release  also requires the site owner (tools/set-owner.mjs) in both the Android build and the PC program
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGENT = join(ROOT, 'agent/PhoneBox.Agent');
const WWW = join(ROOT, 'android/app/src/main/assets/www');
const RES = join(ROOT, 'android/app/src/main/res');
const read = (...p) => readFileSync(join(...p), 'utf8');
const release = process.argv.includes('--release');

const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

// ---- versions
const csproj = read(AGENT, 'PhoneBox.Agent.csproj');
const version = csproj.match(/<Version>([^<]+)<\/Version>/)?.[1];
check(/^\d+\.\d+\.\d+$/.test(version || ''), `agent version "${version}" is not x.y.z`);
const gradle = read(ROOT, 'android/app/build.gradle.kts');
check(gradle.includes(`versionName = "${version}"`), `Android versionName differs from the agent version ${version}`);
check(Number(gradle.match(/versionCode = (\d+)/)?.[1]) > 0, 'Android versionCode missing');
const changelog = read(ROOT, 'CHANGELOG.md');
check(new RegExp(`^## ${version.replace(/\./g, '\\.')} — \\d{4}-\\d{2}-\\d{2}$`, 'm').test(changelog), `CHANGELOG.md has no dated "## ${version} — YYYY-MM-DD" section`);

// ---- brand: the site owner must be the same in the Android build and the PC program
const brandOwner = read(AGENT, 'Brand.cs').match(/Owner = "([^"]*)"/)?.[1] ?? null;
const gradleOwner = read(ROOT, 'android/gradle.properties').match(/^phonedash\.owner=(.*)$/m)?.[1]?.trim() ?? null;
check(brandOwner !== null && gradleOwner !== null, 'Brand.Owner or phonedash.owner not found');
check(brandOwner === gradleOwner, `site owner differs: Brand.cs "${brandOwner}", gradle.properties "${gradleOwner}" (run tools/set-owner.mjs)`);
if (release) check(!!brandOwner, 'no site owner set: run node tools/set-owner.mjs <github-user> first');

// ---- widget catalog
const widgets = JSON.parse(read(AGENT, 'widgets.json'));
const templates = JSON.parse(read(AGENT, 'templates.json'));
const types = new Set(widgets.map((w) => w.type));
check(types.size === widgets.length, 'duplicate widget types in widgets.json');
check(new Set(templates.map((t) => t.id)).size === templates.length, 'duplicate template ids in templates.json');
for (const t of templates) for (const w of t.widgets) {
  check(types.has(w.type), `template ${t.id} uses unknown widget ${w.type}`);
  const x = w.x ?? 0, y = w.y ?? 0;
  check(x >= 0 && y >= 0 && x + w.w <= 12 && y + w.h <= 6, `template ${t.id}: ${w.type} is outside the 12×6 grid`);
}
const demo = read(ROOT, 'tools/pages/demo.js');
const demoPages = JSON.parse(demo.match(/const PAGES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
check(JSON.stringify([...demoPages].sort()) === JSON.stringify(templates.map((t) => t.id).sort()), 'the web demo does not show every template exactly once');
check(!/\d+ (widgets|templates)/.test(read(ROOT, 'tools/pages/index.html')), 'hard-coded catalog count in tools/pages/index.html');

// ---- languages
const i18n = read(WWW, 'i18n.js');
const codes = new Set([...i18n.matchAll(/\{ code: '([\w-]+)'/g)].map((m) => m[1]));
check(codes.has('en'), 'English missing from i18n.js');
const saved = read(AGENT, 'Config.cs').match(/Languages = \[([^\]]+)\]/)[1];
const savedCodes = new Set([...saved.matchAll(/"([\w-]+)"/g)].map((m) => m[1]));
const culture = (c) => (c === 'zh' ? 'zh-Hans' : c);
check([...codes, 'auto'].every((c) => savedCodes.has(c)) && savedCodes.size === codes.size + 1, 'Config.cs language list differs from i18n.js');
const satellites = [...csproj.matchAll(/<SatelliteResourceLanguages>(.*?)<\/SatelliteResourceLanguages>/g)].pop()[1].split(';');
check(satellites.length === codes.size && [...codes].every((c) => satellites.includes(culture(c))), 'csproj SatelliteResourceLanguages differ from i18n.js');

const androidStrings = (file) => {
  const out = {};
  for (const m of read(file).matchAll(/<string name="([^"]+)"([^>]*)>([\s\S]*?)<\/string>/g)) if (!m[2].includes('translatable="false"')) out[m[1]] = m[3];
  return out;
};
const resx = (file) => Object.fromEntries([...read(file).matchAll(/<data [^>]*name="([^"]+)"[^>]*>\s*<value>([\s\S]*?)<\/value>/g)].map((m) => [m[1], m[2]]));
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function placeholders(english, translated, pattern, where) {
  for (const [key, text] of Object.entries(english)) {
    const value = translated[key];
    if (value === undefined) { problems.push(`${where}: missing ${key}`); continue; }
    check(value.trim() !== '', `${where}: ${key} is empty`);
    check(same(text.match(pattern) || [], value.match(pattern) || []), `${where}: ${key} placeholders differ`);
  }
}
const androidEn = androidStrings(join(RES, 'values/strings.xml'));
const trayEn = resx(join(AGENT, 'TrayStrings.resx'));
const androidFolder = { id: 'in', 'pt-BR': 'b+pt+BR', 'zh-Hant': 'zh-rTW' };
for (const code of [...codes].filter((c) => c !== 'en')) {
  placeholders(androidEn, androidStrings(join(RES, `values-${androidFolder[code] || code}/strings.xml`)), /%[0-9]+\$[sd]/g, `values-${code}`);
  placeholders(trayEn, resx(join(AGENT, `TrayStrings.${culture(code)}.resx`)), /\{[0-9]+\}/g, `TrayStrings.${code}`);
}

const packs = readdirSync(WWW).filter((n) => /^locale-[\w-]+\.js$/.test(n));
for (const page of [join(WWW, 'index.html'), join(AGENT, 'settings.html')]) {
  const loaded = [...read(page).matchAll(/<script src="(?:\.\.\/panel\/)?(locale-[\w-]+\.js)">/g)].map((m) => m[1]);
  check(loaded.length === new Set(loaded).size && same(loaded, packs), `${page} does not load every locale pack exactly once`);
}

// English interface strings: the first definition of each key in i18n.js is the English one
const english = {};
for (const m of i18n.matchAll(/^\s*'([\w.\-]+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)) if (!(m[1] in english)) english[m[1]] = m[2];
// machine-translation left-overs seen before: raw bytes, and a word glued to English ("ясне" + "weather condition")
const leftovers = /weather (?:condition|forecast)|<0x[0-9A-Fa-f]{2}>|[Ѐ-ӿऀ-ॿ฀-๿가-힯][a-z]{3,}/;
const brace = /\{[A-Za-z]+\}/g;
for (const name of packs) {
  const sandbox = { window: {} };
  vm.runInNewContext(read(WWW, name), sandbox);
  for (const [code, pack] of Object.entries(sandbox.window.PhoneBoxLocaleData)) {
    for (const [section, entries] of Object.entries(pack)) {
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value !== 'string') continue;
        check(!leftovers.test(value), `${name} ${code}.${section}["${key}"]: machine-translation left-over: ${value}`);
        const source = section === 'strings' ? english[key] : key;
        check(value !== '' || !source, `${name} ${code}.${section}["${key}"] is empty`);
        // Korean is the store language: its placeholders must match the English exactly
        if (code === 'ko' && source) check(same(source.match(brace) || [], value.match(brace) || []), `${name} ko.${section}["${key}"]: placeholders differ from the English`);
      }
    }
  }
}

if (problems.length) {
  console.error(`FAIL (${problems.length}):\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`PASS: ${version}; owner "${brandOwner || '(not set)'}"; ${widgets.length} widgets; ${templates.length} templates; ${codes.size} languages`);
