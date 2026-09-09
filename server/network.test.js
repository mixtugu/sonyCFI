import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createApp } from './index.js';

function receive(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('message', listener); reject(new Error('通信がタイムアウトしました')); }, 5000);
    const listener = raw => { const message = JSON.parse(raw); if (predicate(message)) { clearTimeout(timer); socket.off('message', listener); resolve(message); } };
    socket.on('message', listener);
  });
}
async function open(url) { const socket = new WebSocket(url); await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); }); return socket; }
test('独立したWebSocket接続で移動と切断・復帰を同期する', async t => {
  const app = await createApp({ port: 0, host: '127.0.0.1' }); t.after(() => app.close());
  const url = `ws://127.0.0.1:${app.port}/socket`, a = await open(url), b = await open(url);
  const sessionPromise = receive(a, m => m.type === 'session'); a.send(JSON.stringify({ type: 'create', role: 'child' })); const session = await sessionPromise;
  const joined = receive(b, m => m.type === 'state'); b.send(JSON.stringify({ type: 'join', code: session.code })); assert.equal((await joined).role, 'parent');
  const ready = receive(a, m => m.status === 'countdown'); a.send('{"type":"ready"}'); b.send('{"type":"ready"}'); await ready;
  for (let i = 0; i < 92; i++) app.rooms.tick();
  const moving = receive(b, m => m.type === 'state' && m.view.child.x > 290); a.send('{"type":"input","x":1,"y":0}'); const moved = await moving; assert.equal(moved.view.haven.x, 180);
  const paused = receive(b, m => m.status === 'paused'); a.close(); await paused;
  const c = await open(url), restored = receive(c, m => m.type === 'state'); c.send(JSON.stringify({ type: 'resume', code: session.code, token: session.token }));
  const packet = await restored; assert.equal(packet.role, 'child'); assert.equal(packet.status, 'paused'); assert.equal(packet.view.haven, null); assert.ok(packet.view.child.x > 290);
});
