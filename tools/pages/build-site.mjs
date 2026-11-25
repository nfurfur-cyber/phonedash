// Builds the PhoneDash site (GitHub Pages: https://<owner>.github.io/phonedash/) into dist/site:
//   index.html (landing + setup guide), privacy.html, licenses.html, pair/ (Wi-Fi pairing QR target),
//   panel/ + settings/ (live demo)
// Usage: node tools/pages/build-site.mjs [outDir]
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGES = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(PAGES, '../..');
const WWW = join(ROOT, 'android/app/src/main/assets/www');
const AGENT = join(ROOT, 'agent/PhoneBox.Agent');
const BRAND = join(ROOT, 'brand');
const OUT = resolve(process.argv[2] || join(ROOT, 'dist/site'));

const read = (p) => readFileSync(p, 'utf8');
const version = read(join(AGENT, 'PhoneBox.Agent.csproj')).match(/<Version>([^<]+)<\/Version>/)[1];
const demoTag = (panel) => `<script src="../demo.js" data-version="${version}"${panel ? ' data-panel' : ''}></script>\n`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- a small Markdown converter: enough for PRIVACY.md (headings, paragraphs, lists, tables, code, bold, links)
function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/&lt;(https?:\/\/[^&]+)&gt;/g, '<a href="$1">$1</a>');
}
function markdown(md) {
  const out = [];
  const lines = md.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,3}) (.*)/);
    if (h) { out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); i++; continue; }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split(' | ').map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push('<div class="table"><table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
        + body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && (lines[i].startsWith('- ') || (lines[i].startsWith('  ') && items.length))) {
        if (lines[i].startsWith('- ')) items.push(lines[i].slice(2)); else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      out.push('<ul>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>');
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- )/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

const PRIVACY_KO = `
<h2>한눈에 보기</h2>
<ul>
  <li><b>동의 없이는 수집하지 않습니다.</b> 폰대시에는 계정, 자체 서버, 광고, 오류 보고가 없습니다. 동의하지 않으면 개발자는 여러분의 데이터를 받지 않습니다.</li>
  <li><b>이용 통계(선택)</b>: 폰 앱에서 "통계 보내기"를 누른 경우에만 Google 애널리틱스(Firebase)로 보냅니다. 연결 방식(USB·Wi-Fi), 페이지·버튼·위젯 개수와 위젯 종류, 테마·언어, Pro 여부, Pro 화면을 열었는지 같은 이용 단계와 애널리틱스가 자동으로 기록하는 정보(첫 실행, 사용 시간, 기종·Android 버전, IP로 추정한 국가·지역, 설치 경로, 인앱 구매, 설치마다 새로 만드는 무작위 ID)입니다. 목적은 앱 개선이며, 페이지 이름·입력한 글·PC 정보·광고 ID는 보내지 않습니다. 전체 페이지 화면의 "이용 통계: 켬/끔" 버튼으로 언제든 끌 수 있고, 끄면 통계용 ID가 초기화되고 아직 보내지 않은 통계는 버립니다. 이미 보낸 통계의 삭제는 아래 문의로 요청해 주세요.</li>
  <li><b>별점 요청</b>: 일정 기간 쓴 뒤 Google Play의 평가 창이 뜰 수 있습니다. 평가 내용은 Google Play로만 가고, 앱은 평가했는지 알 수 없습니다.</li>
  <li><b>PC와 폰 사이에서만 오갑니다.</b> 화면에 보이는 PC 정보(CPU·GPU·메모리·재생 중인 음악·AI 사용량 등)는 PC에서 읽어 USB 케이블(또는 직접 연결한 Wi-Fi, 고정 인증서와 키로 암호화)로 여러분의 폰에만 보냅니다.</li>
  <li><b>기능에 필요한 요청만 밖으로 나갑니다.</b> 날씨(open-meteo.com: 고른 도시의 좌표), 프로그램 업데이트 확인(GitHub), adb가 없을 때 adb 내려받기(Google) 같은 요청입니다. 각 서비스는 일반 웹 요청처럼 IP 주소를 봅니다. 전체 목록과 끄는 방법은 아래 영문 상세 목록에 있습니다.</li>
  <li><b>마이크(RECORD_AUDIO)</b>는 받아쓰기 위젯의 마이크 버튼을 눌렀을 때만, 처음 한 번 권한을 묻습니다. 음성은 폰의 음성 인식 서비스(대부분 Google)가 처리하고, 인식된 글자만 여러분의 PC로 보내 입력합니다.</li>
  <li><b>결제</b>는 Google Play가 처리합니다. 개발자는 Google이 모든 개발자에게 주는 주문 정보만 받습니다(카드 정보 없음).</li>
  <li><b>저장 위치</b>: 설정은 PC의 <code>%APPDATA%\\PhoneDash</code>, 기록은 <code>%LOCALAPPDATA%\\PhoneDash</code>, 폰 앱의 캐시는 앱 저장공간에만 있습니다. 앱이나 PC 프로그램을 지우면 함께 지울 수 있습니다.</li>
  <li><b>문의</b>: Google Play의 폰대시 페이지에 있는 개발자 이메일로 연락해 주세요.</li>
</ul>
<h2>Details (English)</h2>`;

function privacyHtml() {
  const body = markdown(read(join(ROOT, 'PRIVACY.md')).replace(/^# Privacy policy\n/, ''));
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>폰대시 개인정보처리방침 · PhoneDash privacy policy</title>
<link rel="icon" href="favicon.ico">
<style>
:root { --bg: #0b1222; --bg2: #101a30; --line: #22304d; --text: #eef2f8; --muted: #a3afc4; --accent: #FFB020; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.7 "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif; word-break: keep-all; }
main { max-width: 860px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 30px; margin: 0 0 4px; } h2 { margin-top: 36px; font-size: 22px; } h3 { font-size: 18px; }
p, li { color: var(--muted); } b { color: var(--text); } a { color: var(--accent); }
code { background: var(--bg2); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; font-size: 13px; }
.table { overflow-x: auto; } table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 12px 0; }
th, td { border: 1px solid var(--line); padding: 8px 10px; vertical-align: top; text-align: left; } th { background: var(--bg2); }
td { color: var(--muted); }
</style>
</head>
<body><main>
<p><a href="./">← 폰대시</a></p>
<h1>개인정보처리방침 · Privacy policy</h1>
<p>폰대시(PhoneDash) 안드로이드 앱과 Windows PC 프로그램에 적용됩니다.</p>
${PRIVACY_KO}
${body}
</main></body>
</html>
`;
}

// ---- licences: PhoneBox's MIT licence and the third-party notices of the phone app and the PC program
function licensesHtml() {
  const sections = [
    ['폰대시와 원작 PhoneBox · MIT License', read(join(ROOT, 'LICENSE'))],
    ['폰 앱에 포함된 오픈소스 · Android app', read(join(ROOT, 'android/THIRD-PARTY-NOTICES.txt'))],
    ['PC 프로그램에 포함된 오픈소스 · PC program', read(join(AGENT, 'THIRD-PARTY-NOTICES.txt'))],
  ];
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>폰대시 오픈소스 라이선스 · PhoneDash licences</title>
<link rel="icon" href="favicon.ico">
<style>
:root { --bg: #0b1222; --bg2: #101a30; --line: #22304d; --text: #eef2f8; --muted: #a3afc4; --accent: #FFB020; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.7 "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif; word-break: keep-all; }
main { max-width: 860px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 30px; margin: 0 0 4px; } h2 { margin-top: 36px; font-size: 20px; }
p { color: var(--muted); } a { color: var(--accent); }
pre { background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; padding: 14px; overflow-x: auto;
  white-space: pre-wrap; word-break: break-word; font: 13px/1.55 ui-monospace, Consolas, monospace; color: var(--muted); }
</style>
</head>
<body><main>
<p><a href="./">← 폰대시</a></p>
<h1>오픈소스 라이선스</h1>
<p>폰대시는 Ersin KOÇ의 오픈소스 프로젝트 <a href="https://github.com/ersinkoc/phonebox">PhoneBox</a>(MIT 라이선스)를 바탕으로 만들었습니다.
같은 내용이 폰 앱(assets/licenses)과 PC 프로그램(설치 폴더의 LICENSE.txt, THIRD-PARTY-NOTICES.txt)에도 들어 있습니다.</p>
${sections.map(([title, text]) => `<h2>${esc(title)}</h2>\n<pre>${esc(text)}</pre>`).join('\n')}
</main></body>
</html>
`;
}

// ---- assemble
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(join(OUT, 'panel'), { recursive: true });
mkdirSync(join(OUT, 'settings'));
mkdirSync(join(OUT, 'pair'));
mkdirSync(join(OUT, 'img'));

const landing = read(join(PAGES, 'index.html')).replace(/\{\{version\}\}/g, version);
if (landing.includes('{{')) throw new Error('index.html has an unfilled {{placeholder}}');
writeFileSync(join(OUT, 'index.html'), landing);
writeFileSync(join(OUT, 'privacy.html'), privacyHtml());
writeFileSync(join(OUT, 'licenses.html'), licensesHtml());
copyFileSync(join(PAGES, 'pair.html'), join(OUT, 'pair/index.html'));

copyFileSync(join(PAGES, 'demo.js'), join(OUT, 'demo.js'));
for (const name of ['widgets.json', 'templates.json']) copyFileSync(join(AGENT, name), join(OUT, name));
copyFileSync(join(AGENT, 'phonedash.ico'), join(OUT, 'favicon.ico'));
cpSync(WWW, join(OUT, 'panel'), { recursive: true, filter: (src) => !src.endsWith(join('www', 'index.html')) });
const tag = '<script type="module" src="main.js"></script>';
const panel = read(join(WWW, 'index.html'));
if (!panel.includes(tag)) throw new Error('panel index.html changed: no main.js tag');
writeFileSync(join(OUT, 'panel/index.html'), panel.replace(tag, demoTag(true) + tag));
const settings = read(join(AGENT, 'settings.html'));
writeFileSync(join(OUT, 'settings/index.html'), settings.replace('<script>', demoTag(false) + '<script>')
  .replace(/href="\/favicon\.ico"/g, 'href="../favicon.ico"').replace(/src="\/favicon\.ico"/g, 'src="../favicon.ico"'));

// images: the icon and a store screenshot (brand/store/, taken from the live demo)
for (const [from, to] of [['out/play-icon-512.png', 'icon-512.png'], ['out/icon-192.png', 'icon-192.png'], ['store/ko/1-home.png', 'screen-home.png']]) {
  if (existsSync(join(BRAND, from))) copyFileSync(join(BRAND, from), join(OUT, 'img', to));
  else console.warn(`missing brand/${from}`);
}
writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`site ${version} written to ${OUT}`);
