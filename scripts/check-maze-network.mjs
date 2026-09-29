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
  // The first screen sets the room up; entering one swaps it for the board.
  await parent.goto(url); await expect(parent.locator('#maze-create button')).toBeEnabled();
  await parent.locator('#lobby-settings-open').click(); await parent.locator('[name=duration]').fill('30'); await parent.locator('#settings button[type=submit]').click();
  await parent.locator('#maze-create button').click();
  await expect(parent.locator('#lobby')).toBeHidden(); await expect(parent.locator('.workspace')).toBeVisible();
  await expect(parent.locator('#maze-code')).toHaveText(/^[A-F0-9]{6}$/);
  const code = await parent.locator('#maze-code').innerText(), room = app.mazeRooms.rooms.get(code);
  await expect(parent.locator('#room-chip-code')).toHaveText(code);
  await child.goto(`${url}/?maze=${code}`); await expect(child.locator('#maze-join button')).toBeEnabled(); await child.locator('#maze-join button').click();
  await expect(child.locator('#maze-role')).toHaveText('子ども役'); await expect(child.locator('#lobby')).toBeHidden();
  await expect(parent.locator('#maze-role')).toHaveText('親役');   // the host always starts as the parent
  await expect(parent.locator('#board-child')).toBeHidden(); await expect(child.locator('#board-parent')).toBeHidden();
  // Rounds start from the ready prompt, which covers the board until both sides are ready.
  await expect(parent.locator('#ready')).toBeVisible(); await expect(parent.locator('#ready-title')).toHaveText('あなたは親です。');
  await expect(child.locator('#ready-title')).toHaveText('あなたは子どもです。');
  // Each round opens with a three-step briefing; the first steps carry a small practice board.
  await expect(parent.locator('.briefing-title')).toHaveText('壁を立てて子どもを守る');
  await expect(child.locator('.briefing-title')).toHaveText('移動してアイテムを探し、報酬を獲得');
  await expect(parent.locator('#ready-start')).toBeHidden();
  const practiceImage = await parent.locator('.briefing-canvas').evaluate(canvas => canvas.toDataURL());
  await parent.keyboard.press('Space');
  await expect(parent.locator('.practice-feedback')).toHaveText('東側に壁を設置しました');
  assert.notEqual(await parent.locator('.briefing-canvas').evaluate(canvas => canvas.toDataURL()), practiceImage, 'placing a wall redraws the tutorial maze');
  await child.keyboard.press('ArrowUp');
  await expect(child.locator('.practice-feedback')).toHaveText('子どもが A-02 へ移動');
  // The child's second step opens a dotted, child-only passage to walk through.
  await child.locator('.briefing-next').click();
  await expect(child.locator('.briefing-count')).toHaveText('02 / 03');
  for (const key of ['ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowRight']) await child.keyboard.press(key);
  await expect(child.locator('.practice-feedback')).toHaveText('秘密の通路を通り抜けました');
  await parent.screenshot({ path: 'artifacts/tuto-1-parent.png' }); await child.screenshot({ path: 'artifacts/tuto-2-child.png' });
  await parent.locator('.briefing-next').click(); await parent.locator('.briefing-next').click();
  await expect(parent.locator('.briefing-count')).toHaveText('03 / 03');
  await expect(parent.locator('.briefing-board')).toBeHidden(); await expect(parent.locator('.briefing-next')).toBeHidden();
  // The last step confirms; closing the briefing instead leaves the plain ready button.
  await parent.locator('.briefing-launch').click(); await expect(parent.locator('#ready-start')).toHaveText('相手の準備を待っています');
  await expect(parent.locator('#phase')).toHaveText('開始前');
  await child.keyboard.press('Escape'); await expect(child.locator('#ready-tutorial')).toBeHidden(); await child.locator('#ready-start').click();
  await expect(parent.locator('#phase')).toHaveText('探検中'); await expect(child.locator('#phase')).toHaveText('探検中');
  await expect(parent.locator('#ready')).toBeHidden();
  const pos = room.game.avatar, dir = autoDirection(room.game);
  await child.locator(`[data-dir="${dir}"]`).click(); await expect.poll(() => room.game.avatar).not.toBe(pos);
  for (let cell = 0; cell < 240; cell++) { const b = neighbor(room.game, cell, 0); if (b >= 0 && !room.game.base.has(edge(cell, b))) {
    const canvas = parent.locator('#board-parent'); await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
    const { cols, rows } = room.game.settings; await parent.mouse.click(box.x + ((cell % cols + 1) * 36 + 13) / (cols * 36 + 28) * box.width, box.y + ((Math.floor(cell / cols) + .5) * 36 + 14) / (rows * 36 + 28) * box.height); break;
  } }
  await expect(parent.locator('#detail-parent')).toHaveText('1 / 12'); assert.equal(room.game.walls.size, 1);
  await child.reload(); await expect(parent.locator('#phase')).toHaveText('ひと休み中'); await expect(child.locator('#maze-role')).toHaveText('子ども役');
  await parent.locator('#ready-start').click(); await child.locator('#ready-start').click(); await expect(child.locator('#phase')).toHaveText('探検中');
  room.game.time = room.game.settings.duration - .01;
  await expect(parent.locator('#result')).toBeVisible(); await expect(child.locator('#result')).toBeVisible();
  // The first leg only leads on to the second: no way to dismiss it, no final scores yet.
  await expect(parent.locator('#result-title')).toHaveText('第1ラウンド終了');
  await expect(parent.locator('#close-result')).toBeHidden(); await expect(parent.locator('#result-rounds')).toBeHidden();
  await expect(parent.locator('#again')).toHaveText('交代して第2ラウンドへ');
  await parent.locator('#again').click(); await child.locator('#again').click(); await expect(parent.locator('#phase')).toHaveText('開始前');
  // Both sides asked for another round, so the roles are exchanged and each board follows.
  await expect(parent.locator('#maze-role')).toHaveText('子ども役'); await expect(child.locator('#maze-role')).toHaveText('親役');
  await expect(parent.locator('#board-child')).toBeVisible(); await expect(child.locator('#board-parent')).toBeVisible();
  await expect(parent.locator('#ready-title')).toHaveText('あなたは子どもです。');
  await expect(parent.locator('.briefing-title')).toHaveText('移動してアイテムを探し、報酬を獲得');   // the briefing follows the new role
  // The second leg ends the match: totals for both people and a fresh start.
  for (const page of [parent, child]) { await page.locator('.briefing-close').click(); await page.locator('#ready-start').click(); } await expect(parent.locator('#phase')).toHaveText('探検中');
  room.game.time = room.game.settings.duration - .01;
  await expect(parent.locator('#result-title')).toHaveText('ふたりの探検が終わりました');
  await expect(parent.locator('#result-label-a')).toHaveText('あなた'); await expect(parent.locator('#result-rounds')).toContainText('第2ラウンド');
  await expect(parent.locator('#swap-note')).toBeHidden(); await expect(parent.locator('#again')).toHaveText('もう一度あそぶ');
  const totals = await parent.evaluate(() => [+document.getElementById('final-parent').textContent, +document.getElementById('final-child').textContent]);
  assert.equal(totals[0] + totals[1], room.results.reduce((sum, leg) => sum + leg.parent + leg.child, 0), 'totals cover both rounds');
  await parent.locator('#again').click(); await child.locator('#again').click();
  await expect(parent.locator('#maze-role')).toHaveText('親役'); await expect(child.locator('#maze-role')).toHaveText('子ども役');
  await child.setViewportSize({ width: 390, height: 844 });
  assert.equal(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await child.screenshot({ path: 'artifacts/maze-two-player-mobile.png', fullPage: true });
  await parent.screenshot({ path: 'artifacts/maze-two-player-parent.png', fullPage: true });
  // The ready prompt is modal, so its own settings button is the way into the room panel.
  await child.locator('#ready-settings').click(); await child.locator('#maze-leave').click();
  await expect(child.locator('#lobby')).toBeVisible(); await expect(parent.locator('#maze-partner')).toHaveText('相手を待っています');
  assert.deepEqual(errors, []); console.log('PASS: two browsers, private views, ready, human movement/walls, reconnect, joint result/restart, mobile and leave.');
} finally { await browser?.close(); await app.close(); }
