import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { neighbor, edge } from '../src/maze.js';

const url = process.env.WORKER_URL || 'http://127.0.0.1:8787';
const browser = await chromium.launch();
try {
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1280, height: 1000 } })));
  for (const context of contexts) await context.addInitScript(() => {
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(...args) { super(...args); this.addEventListener('message', event => { const p = JSON.parse(event.data); if (p.type === 'state') window.packet = p; }); }
    };
  });
  const [parent, child] = await Promise.all(contexts.map(c => c.newPage()));
  const errors = []; [parent, child].forEach(p => p.on('pageerror', e => errors.push(e.message)));
  await parent.goto(url); await expect(parent.locator('#maze-create button')).toBeEnabled();
  await parent.locator('[name=duration]').fill('10'); await parent.locator('#maze-create button').click();
  await expect(parent.locator('#maze-code')).toHaveText(/^[A-F0-9]{6}$/, { timeout: 15000 });
  const code = await parent.locator('#maze-code').innerText();
  await child.goto(`${url}/?maze=${code}`); await expect(child.locator('#maze-join button')).toBeEnabled(); await child.locator('#maze-join button').click();
  await expect(child.locator('#maze-role')).toHaveText('子ども役');
  await expect(parent.locator('#board-child')).toBeHidden(); await expect(child.locator('#board-parent')).toBeHidden();
  await parent.locator('#start').click(); await child.locator('#start').click(); await expect(parent.locator('#phase')).toHaveText('探検中');
  const initial = await child.evaluate(() => window.packet.game);
  const direction = [0, 1, 2, 3].find(d => { const b = neighbor(initial, initial.avatar, d); return b >= 0 && !initial.base.includes(edge(initial.avatar, b)); });
  await child.locator(`[data-dir="${direction}"]`).click();
  await expect.poll(() => parent.evaluate(() => window.packet.game.avatar)).not.toBe(initial.avatar);
  const g = await parent.evaluate(() => window.packet.game);
  for (let cell = 0; cell < g.settings.cols * g.settings.rows; cell++) {
    const b = neighbor(g, cell, 0); if (b < 0 || g.base.includes(edge(cell, b))) continue;
    const canvas = parent.locator('#board-parent'); await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
    await parent.mouse.click(box.x + ((cell % g.settings.cols + 1) * 36 + 13) / (g.settings.cols * 36 + 28) * box.width, box.y + ((Math.floor(cell / g.settings.cols) + .5) * 36 + 14) / (g.settings.rows * 36 + 28) * box.height); break;
  }
  await expect(parent.locator('#detail-parent')).toHaveText('1 / 12');
  assert.deepEqual(await parent.evaluate(() => window.packet.game.secrets), []);
  assert.equal(await child.evaluate(() => window.packet.game.parentScore), null);
  await child.reload(); await expect(child.locator('#maze-role')).toHaveText('子ども役'); await expect(parent.locator('#phase')).toHaveText('ひと休み中');
  await expect(parent.locator('#detail-parent')).toHaveText('1 / 12');
  await parent.locator('#start').click(); await child.locator('#start').click();
  await expect(parent.locator('#result')).toBeVisible({ timeout: 15000 }); await expect(child.locator('#result')).toBeVisible();
  await parent.locator('#again').click(); await child.locator('#again').click(); await expect(parent.locator('#phase')).toHaveText('開始前');
  await mkdir('artifacts', { recursive: true }); await parent.screenshot({ path: 'artifacts/worker-parent.png', fullPage: true });
  await child.setViewportSize({ width: 390, height: 844 }); await child.screenshot({ path: 'artifacts/worker-mobile.png', fullPage: true });
  assert.equal(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await child.locator('#maze-leave').click(); await expect(parent.locator('#maze-partner')).toHaveText('相手を待っています');
  await parent.locator('#maze-leave').click();
  assert.deepEqual(errors, []);
  console.log(`PASS: Workers two-browser room, private state, moves/walls, refresh recovery, timer, replay, mobile, leave (${url})`);
} finally { await browser.close(); }
