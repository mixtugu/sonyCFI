import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';
import { autoDirection, neighbor, edge } from '../src/maze.js';
const app = await createApp({ port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const contexts = await Promise.all([1, 2].map(() => browser.newContext({ viewport: { width: 1280, height: 900 } })));
  const pages = await Promise.all(contexts.map(c => c.newPage())); const [parent, child] = pages;
  const errors = []; pages.forEach(p => p.on('pageerror', e => errors.push(e.message)));
  const url = `http://127.0.0.1:${app.port}`;
  await parent.goto(url); await expect(parent.locator('#maze-create button')).toBeEnabled();
  await parent.locator('.settings-panel summary').click(); await parent.locator('[name=duration]').fill('30'); await parent.locator('#maze-create button').click();
  await expect(parent.locator('#maze-code')).toHaveText(/^[A-F0-9]{6}$/);
  const code = await parent.locator('#maze-code').innerText(), room = app.mazeRooms.rooms.get(code);
  await child.goto(`${url}/?maze=${code}`); await expect(child.locator('#maze-join button')).toBeEnabled(); await child.locator('#maze-join button').click();
  await expect(child.locator('#maze-role')).toHaveText('子ども役');
  await expect(parent.locator('#board-child')).toBeHidden(); await expect(child.locator('#board-parent')).toBeHidden();
  await parent.locator('#start').click(); await expect(parent.locator('#phase')).toHaveText('開始前'); await child.locator('#start').click();
  await expect(parent.locator('#phase')).toHaveText('探検中'); await expect(child.locator('#phase')).toHaveText('探検中');
  const pos = room.game.avatar, dir = autoDirection(room.game);
  await child.locator(`[data-dir="${dir}"]`).click(); await expect.poll(() => room.game.avatar).not.toBe(pos);
  for (let cell = 0; cell < 240; cell++) { const b = neighbor(room.game, cell, 0); if (b >= 0 && !room.game.base.has(edge(cell, b))) {
    const canvas = parent.locator('#board-parent'); await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
    const { cols, rows } = room.game.settings; await parent.mouse.click(box.x + ((cell % cols + 1) * 36 + 13) / (cols * 36 + 28) * box.width, box.y + ((Math.floor(cell / cols) + .5) * 36 + 14) / (rows * 36 + 28) * box.height); break;
  } }
  await expect(parent.locator('#detail-parent')).toHaveText('1 / 12'); assert.equal(room.game.walls.size, 1);
  await child.reload(); await expect(parent.locator('#phase')).toHaveText('ひと休み中'); await expect(child.locator('#maze-role')).toHaveText('子ども役');
  await parent.locator('#start').click(); await child.locator('#start').click(); await expect(child.locator('#phase')).toHaveText('探検中');
  room.game.time = room.game.settings.duration - .01;
  await expect(parent.locator('#result')).toBeVisible(); await expect(child.locator('#result')).toBeVisible();
  await parent.locator('#again').click(); await child.locator('#again').click(); await expect(parent.locator('#phase')).toHaveText('開始前');
  await child.setViewportSize({ width: 390, height: 844 });
  assert.equal(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await child.screenshot({ path: 'artifacts/maze-two-player-mobile.png', fullPage: true });
  await parent.screenshot({ path: 'artifacts/maze-two-player-parent.png', fullPage: true });
  await child.locator('#maze-leave').click(); await expect(parent.locator('#maze-partner')).toHaveText('相手を待っています');
  assert.deepEqual(errors, []); console.log('PASS: two browsers, private views, ready, human movement/walls, reconnect, joint result/restart, mobile and leave.');
} finally { await browser?.close(); await app.close(); }
