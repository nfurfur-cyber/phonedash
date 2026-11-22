// Builds everything a PhoneDash release needs into dist/ (run on Windows):
//   PhoneDash-<v>.aab                  phone app for Google Play (signed with the upload key in ~/.phonedash)
//   PhoneDash-Setup.exe                PC program download (installs itself when opened)
//   PhoneDashAgent-<v>-win-x64.zip     the same program for its own updater
//   SHA256SUMS-<v>.txt                 checksums the updater verifies
//   site/                              the GitHub Pages site (guide, download link, privacy policy, pairing page)
// Usage: node tools/release.mjs [--skip-tests]
// It only builds: uploading to Google Play, GitHub Releases and GitHub Pages is printed at the end, to run yourself.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const skipTests = process.argv.includes('--skip-tests');
if (process.platform !== 'win32') { console.error('Run the release build on Windows (the PC program is a Windows build).'); process.exit(2); }

const version = readFileSync(join(ROOT, 'agent/PhoneBox.Agent/PhoneBox.Agent.csproj'), 'utf8').match(/<Version>([^<]+)<\/Version>/)[1];
const owner = readFileSync(join(ROOT, 'agent/PhoneBox.Agent/Brand.cs'), 'utf8').match(/Owner = "([^"]*)"/)[1];

function run(title, command, args, options = {}) {
  console.log(`\n==> ${title}`);
  const r = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });
  if (r.error) throw r.error;
  if (r.status !== 0) { console.error(`\n${title} failed (exit ${r.status})`); process.exit(1); }
}
const firstExisting = (...paths) => paths.find((p) => p && existsSync(p));

// tools: the JDK that comes with Android Studio, and .NET 10 (on PATH, in DOTNET, or the user-local install)
const env = { ...process.env };
if (!env.JAVA_HOME) {
  const jbr = firstExisting('C:\\Program Files\\Android\\Android Studio\\jbr', join(env.LOCALAPPDATA || '', 'Programs\\Android Studio\\jbr'));
  if (jbr) env.JAVA_HOME = jbr;
}
const dotnet = env.DOTNET || firstExisting(join(env.LOCALAPPDATA || '', 'Microsoft\\dotnet10\\dotnet.exe'), join(env.ProgramFiles || '', 'dotnet\\dotnet.exe')) || 'dotnet';

run('Release checks', process.execPath, ['tools/check-release.mjs', '--release']);
if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST);

// ---- phone app (Android App Bundle for Google Play)
if (!skipTests) run('Android lint and unit tests', join(ROOT, 'android', 'gradlew.bat'), ['lintRelease', 'testReleaseUnitTest', '--console=plain'], { cwd: join(ROOT, 'android'), env, shell: true });
run(`Android app bundle ${version}`, join(ROOT, 'android', 'gradlew.bat'), ['bundleRelease', '--console=plain'], { cwd: join(ROOT, 'android'), env, shell: true });
const aab = join(DIST, `PhoneDash-${version}.aab`);
copyFileSync(join(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab'), aab);

// ---- PC program (self-contained single file: no .NET needed on the user's computer)
if (!skipTests) run('PC program tests', dotnet, ['test', 'agent/PhoneBox.Agent.Tests', '--nologo'], { env });
const out = mkdtempSync(join(tmpdir(), `phonedash-${version}-`));
try {
  run(`PC program ${version} (win-x64)`, dotnet, ['publish', 'agent/PhoneBox.Agent', '-c', 'Release', '-f', 'net10.0-windows10.0.19041.0', '-r', 'win-x64',
    '--self-contained', 'true', '-p:PublishSingleFile=true', '-o', out, '--nologo'], { env });
  const exe = join(out, 'PhoneDashAgent.exe');
  if (!existsSync(exe)) throw new Error('PhoneDashAgent.exe missing from the publish output');
  copyFileSync(exe, join(DIST, 'PhoneDash-Setup.exe'));
  const zip = join(DIST, `PhoneDashAgent-${version}-win-x64.zip`);
  run('Zip for the updater', 'powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${out}\\*' -DestinationPath '${zip}' -Force`]);
} finally {
  rmSync(out, { recursive: true, force: true });
}

// ---- checksums (the updater refuses a download that does not match)
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const shipped = ['PhoneDash-Setup.exe', `PhoneDashAgent-${version}-win-x64.zip`];
writeFileSync(join(DIST, `SHA256SUMS-${version}.txt`), shipped.map((name) => `${sha256(join(DIST, name))}  ${name}`).join('\n') + '\n');

// ---- site
run('Site', process.execPath, ['tools/pages/build-site.mjs', join(DIST, 'site')]);

console.log('\nBuilt:');
for (const name of readdirSync(DIST)) {
  const p = join(DIST, name);
  console.log(`  ${name}${statSync(p).isFile() ? `  (${(statSync(p).size / 1048576).toFixed(1)} MB)` : '/'}`);
}
console.log(`
Next (each step publishes something, so run it yourself):
  1. Google Play Console › PhoneDash › Test and release: upload dist\\PhoneDash-${version}.aab
  2. PC program release:
     gh release create v${version} dist\\PhoneDash-Setup.exe dist\\PhoneDashAgent-${version}-win-x64.zip dist\\SHA256SUMS-${version}.txt --repo ${owner}/phonedash --title "PhoneDash ${version}" --notes-file CHANGELOG.md
  3. Site: copy dist\\site\\* to the repository ${owner}/phonedash (branch gh-pages, or the folder Pages serves) and push.`);
