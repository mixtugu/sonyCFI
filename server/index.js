import http from 'node:http';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';
import { MazeRooms } from './maze-rooms.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const lanAddresses = () => Object.values(networkInterfaces()).flat().filter(i => i?.family === 'IPv4' && !i.internal).map(i => i.address);
// WebHID (the Access controller) only works on https:// or localhost, so Wi-Fi devices need https.
// A self-signed certificate for localhost and the current LAN addresses is made with openssl and
// regenerated when those addresses change.
function localCertificate() {
  const dir = path.join(root, '.certs'), key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem'), names = path.join(dir, 'names.txt');
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...lanAddresses().map(a => `IP:${a}`)].join(',');
  if (!existsSync(cert) || !existsSync(key) || (existsSync(names) && readFileSync(names, 'utf8')) !== san) {
    mkdirSync(dir, { recursive: true });
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '825', '-subj', '/CN=Between Tides (local)', '-addext', `subjectAltName=${san}`], { stdio: 'ignore' });
    writeFileSync(names, san);
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

export async function createApp({ dev = false, port = 5173, host = '0.0.0.0', secure = false } = {}) {
  let vite;
  const scheme = secure ? 'https' : 'http';
  const handler = async (req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); return; }
    if (req.url === '/connection-info') {
      const lan = [];
      for (const address of lanAddresses()) lan.push(`${scheme}://${address}:${server.address().port}`);
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ lan })); return;
    }
    if (vite) return vite.middlewares(req, res, () => { res.writeHead(404); res.end(); });
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const target = path.resolve(root, 'dist', '.' + pathname);
      const dist = path.join(root, 'dist');
      if (target !== dist && !target.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
      // Routes without a file extension (such as /test) are client-side; they load the same page.
      const file = pathname === '/' || !path.extname(pathname) ? path.join(dist, 'index.html') : target;
      if (!(await stat(file)).isFile()) throw new Error('not file');
      res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(await readFile(file));
    } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('ページが見つかりません。先に npm run build を実行してください。'); }
  };
  const server = secure ? https.createServer(localCertificate(), handler) : http.createServer(handler);
  if (dev) {
    const { createServer } = await import('vite');
    vite = await createServer({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  }
  const mazeRooms = new MazeRooms();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    const endpoint = new URL(req.url, 'http://localhost').pathname;
    if (endpoint !== '/maze-socket') { if (!dev) socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => { ws.service = mazeRooms; wss.emit('connection', ws, req); });
  });
  wss.on('connection', socket => {
    socket.alive = true;
    let budget = 0, windowStart = Date.now();
    socket.on('pong', () => { socket.alive = true; });
    socket.on('message', raw => {
      if (Date.now() - windowStart > 1000) { budget = 0; windowStart = Date.now(); }
      if (++budget > 100) return;
      try { socket.service.handle(socket, JSON.parse(raw.toString())); } catch { socket.service.error(socket, 'リクエストを確認できません。'); }
    });
    socket.on('close', () => socket.service.disconnect(socket));
    socket.on('error', () => socket.service.disconnect(socket));
  });
  const ticker = setInterval(() => { mazeRooms.tick(); }, 1000 / 30);
  const heartbeat = setInterval(() => { for (const socket of wss.clients) { if (!socket.alive) { socket.terminate(); continue; } socket.alive = false; socket.ping(); } }, 5000);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return { server, mazeRooms, port: server.address().port, close: async () => { clearInterval(ticker); clearInterval(heartbeat); for (const s of wss.clients) s.terminate(); wss.close(); await vite?.close(); await new Promise(resolve => server.close(resolve)); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const secure = process.argv.includes('--https') || process.env.HTTPS === '1', scheme = secure ? 'https' : 'http';
  const app = await createApp({ dev: process.argv.includes('--dev'), port: Number(process.env.PORT) || 5173, secure });
  console.log(`Between Tides: ${scheme}://localhost:${app.port}`);
  for (const address of lanAddresses()) console.log(`同じWi-Fiの端末: ${scheme}://${address}:${app.port}`);
  if (!secure) console.log('※ Wi-Fi の端末で Access コントローラーを使うには --https で起動してください（npm run dev:https / start:https）。');
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await app.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
