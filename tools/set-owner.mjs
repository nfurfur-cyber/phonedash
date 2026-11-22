// Sets the GitHub account that hosts the PhoneDash site and the PC program releases:
//   https://<owner>.github.io/phonedash/  (setup guide, download, privacy policy, Wi-Fi pairing page)
//   https://github.com/<owner>/phonedash/releases  (PhoneDash-Setup.exe, PC program updates)
// It writes the same name into the PC program (agent/PhoneBox.Agent/Brand.cs) and the phone app
// (android/gradle.properties, which sets the pairing link the app opens). Usage: node tools/set-owner.mjs <github-user>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const owner = (process.argv[2] || '').trim().toLowerCase();
// GitHub user names: letters, digits and single hyphens, not at either end, at most 39 characters
if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/.test(owner)) {
  console.error('Usage: node tools/set-owner.mjs <github-user>   (a GitHub user or organisation name)');
  process.exit(2);
}

function edit(relative, pattern, replacement) {
  const file = join(ROOT, relative);
  const before = readFileSync(file, 'utf8');
  if (!pattern.test(before)) throw new Error(`${relative}: the owner setting was not found`);
  writeFileSync(file, before.replace(pattern, replacement));
}
edit('agent/PhoneBox.Agent/Brand.cs', /public const string Owner = "[^"]*";/, `public const string Owner = "${owner}";`);
edit('android/gradle.properties', /^phonedash\.owner=.*$/m, `phonedash.owner=${owner}`);

console.log(`owner set to "${owner}"`);
console.log(`  site:     https://${owner}.github.io/phonedash/`);
console.log(`  pairing:  https://${owner}.github.io/phonedash/pair/`);
console.log(`  releases: https://github.com/${owner}/phonedash/releases`);
