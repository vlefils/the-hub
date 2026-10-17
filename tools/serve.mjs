// Local-only preview for the static book and its browser modules. No dependencies.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 8766);
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.pdf': 'application/pdf' };
const server = http.createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Dotfiles (including Git metadata) are never exposed by the development server.
    const file = resolve(root, `.${name === '/' ? '/index.html' : name}`);
    if (!file.startsWith(`${root}${sep}`) || relative(root, file).split(/[\\/]/).some((part) => part.startsWith('.'))) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`The Hub: http://127.0.0.1:${port}/#outils-rumbleball\nRumbleball: http://127.0.0.1:${port}/rumbleball/index.html`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
