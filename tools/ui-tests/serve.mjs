// Static file server for the UI tests and for looking at the site locally: node serve.mjs <directory> <port>
// Serves the directory at / and also at /phonedash/ (the path GitHub Pages uses), with the MIME types browsers need
// for module scripts.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve, sep } from 'node:path';

const [dirArg, port = '8781'] = process.argv.slice(2);
if (!dirArg) { console.error('usage: node serve.mjs <directory> <port>'); process.exit(2); }
const dir = resolve(dirArg);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/phonedash(?=\/|$)/, '');
    let file = normalize(join(dir, path));
    if (file !== dir && !file.startsWith(dir + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${dir} on http://127.0.0.1:${port}/`));
