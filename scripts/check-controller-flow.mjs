import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';
import { autoDirection, neighbor, edge } from '../src/maze.js';

const fakePad = () => {
  window.__pad = null;
  navigator.getGamepads = () => window.__pad ? [{ id: 'DualSense Wireless Controller', connected: true, mapping: 'standard',
    axes: window.__pad.axes || [0, 0, 0, 0], buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: window.__pad.buttons.includes(i), value: window.__pad.buttons.includes(i) ? 1 : 0 })) }] : [];
};
const press = async (page, buttons = [], axes = [0, 0, 0, 0]) => {
  await page.evaluate(state => { window.__pad = state; }, { buttons, axes });
  await page.waitForTimeout(70);
  await page.evaluate(() => { window.__pad = { buttons: [], axes: [0, 0, 0, 0] }; });
  await page.waitForTimeout(70);
};
// Selection is performed exclusively with the pad; DOM reads only assert the current focus.
async function select(page, selector) {
  for (let i = 0; i < 60; i++) {
    if (await page.locator(selector).evaluate(el => el === document.activeElement)) return;
    await press(page, [13]);
  }
  throw new Error(`Controller could not reach ${selector}`);
}
async function activate(page, selector) { await select(page, selector); await press(page, [0]); }
const app = await createApp({ port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const contexts = await Promise.all([1, 2].map(() => browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })));
  const [parent, child] = await Promise.all(contexts.map(c => c.newPage()));
  const errors = [];
  for (const page of [parent, child]) { page.on('pageerror', e => errors.push(e.message)); await page.addInitScript(fakePad); await page.goto(`http://127.0.0.1:${app.port}`); await expect(page.locator('#maze-create button')).toBeEnabled(); await press(page); }
  await press(parent, [2]);
  await select(parent, '[name=cols]');
  const cols = +(await parent.locator('[name=cols]').inputValue());
  await press(parent, [15]); await expect(parent.locator('[name=cols]')).toHaveValue(String(cols + 1));
  await press(parent, [14]); await expect(parent.locator('[name=cols]')).toHaveValue(String(cols));
  await activate(parent, '[name=wall-style][value=reef]'); await expect(parent.locator('[name=wall-style][value=reef]')).toBeChecked();
  await activate(parent, '#settings-help'); await expect(parent.locator('.pad-help')).toBeVisible(); await expect(parent.locator('#keyboard-help')).toBeHidden();
  await press(parent, [1]); await expect(parent.locator('#settings-dialog')).toBeVisible();
  await activate(parent, '#settings button[type=submit]'); await expect(parent.locator('#settings-dialog')).toBeHidden();
  await activate(parent, '#maze-create button'); await expect(parent.locator('#ready')).toBeVisible();
  await expect(parent.locator('.briefing-description')).toContainText('右スティック');
  await expect(parent.locator('.briefing-controller svg')).toBeVisible();
  await expect(parent.locator('.briefing-controls')).not.toContainText('Tab');
  await press(parent, [], [0, 0, 0, -1]); await expect(parent.locator('.practice-feedback')).toHaveText('設置方向: 北');
  await press(parent, [], [0, 0, 1, 0]); await press(parent, [0]); await expect(parent.locator('.practice-feedback')).toHaveText('東側に壁を設置しました');
  await press(parent, [5]); await expect(parent.locator('.briefing-count')).toHaveText('02 / 03');
  await press(parent, [4]); await expect(parent.locator('.briefing-count')).toHaveText('01 / 03');
  await press(parent, [8]); await expect(parent.locator('#ready-tutorial')).toBeHidden(); await expect(parent.locator('#ready-start')).toBeDisabled();
  await activate(parent, '#ready-review'); await expect(parent.locator('.briefing-controller')).toBeVisible();
  // Hot unplug/replug preserves the current tutorial and restores keyboard guidance.
  await parent.evaluate(() => { window.__pad = null; });
  await expect(parent.locator('.briefing-controls')).toContainText('Space'); await expect(parent.locator('.briefing-controller')).toBeHidden();
  await press(parent); await expect(parent.locator('.briefing-controller')).toBeVisible();
  await parent.screenshot({ path: 'artifacts/controller-tutorial-parent.png' });
  const code = await parent.locator('#maze-code').textContent(), room = app.mazeRooms.rooms.get(code);
  await expect(child.locator('#maze-join input')).toHaveValue('A');
  await expect(child.locator('#maze-join input')).toHaveAttribute('readonly', '');
  await activate(child, '#maze-join button'); await expect(child.locator('#ready')).toBeVisible();
  await expect(child.locator('.briefing-description')).toContainText('左スティック');
  await press(child, [15]); await expect(child.locator('.practice-feedback')).toContainText('移動');
  await press(child, [3]); await expect(child.locator('body')).not.toHaveClass(/immersive/);
  await expect.poll(() => child.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await child.setViewportSize({ width: 390, height: 844 });
  assert.equal(await child.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await expect(child.locator('.briefing-next')).toBeInViewport();
  await child.screenshot({ path: 'artifacts/controller-tutorial-mobile.png' });
  await child.setViewportSize({ width: 1280, height: 900 });
  const complete = async page => { await press(page, [9]); await press(page, [9]); await press(page, [9]); await expect(page.locator('#ready-tutorial')).toBeHidden(); await press(page, [9]); };
  await complete(parent); await complete(child);
  await expect(parent.locator('#countdown')).toBeVisible(); await press(parent, [1]); await expect(parent.locator('#phase')).toHaveText('ひと休み中');
  await press(parent, [9]); await press(child, [9]);
  await expect(parent.locator('#phase')).toHaveText('探検中');
  await expect(parent.locator('.workspace > .controller-guide')).toBeVisible();
  const before = room.game.avatar, moveDir = autoDirection(room.game);
  await press(child, [], [[1, 0], [0, 1], [-1, 0], [0, -1]][moveDir]);
  await expect.poll(() => room.game.avatar).not.toBe(before);
  // Choose a free edge at the parent's initial cursor and place a real wall.
  const cursor = room.game.trail[0];
  const direction = [0, 1, 2, 3].find(d => { const n = neighbor(room.game, cursor, d); return n >= 0 && !room.game.base.has(edge(cursor, n)); });
  await press(parent, [], [0, 0, ...[[1, 0], [0, 1], [-1, 0], [0, -1]][direction]]); await press(parent, [0]);
  await expect.poll(() => room.game.walls.size).toBe(1);
  await press(parent, [17]); await expect(parent.locator('#help')).toBeVisible(); await expect(parent.locator('#phase')).toHaveText('ひと休み中');
  await expect.poll(() => parent.locator('#help h2').evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  await press(parent, [1]);
  await press(parent, [9]); await press(child, [9]); await expect(parent.locator('#phase')).toHaveText('探検中');
  await child.evaluate(() => { window.__pad = null; }); await expect(parent.locator('#phase')).toHaveText('ひと休み中');
  await press(child); await press(parent, [9]); await press(child, [9]); await expect(parent.locator('#phase')).toHaveText('探検中');
  room.game.time = room.game.settings.duration - .01;
  await expect(parent.locator('.briefing-title')).toContainText('移動してアイテム');
  await expect(child.locator('.briefing-description')).toContainText('右スティック');
  await complete(parent); await complete(child); await expect(parent.locator('#phase')).toHaveText('探検中');
  room.game.time = room.game.settings.duration - .01;
  await expect(parent.locator('#result')).toBeVisible();
  await activate(parent, '#close-result'); await expect(parent.locator('#ending')).toBeVisible(); await press(parent, [0]); await expect(parent.locator('#lobby')).toBeVisible();
  await expect(child.locator('#result')).toBeVisible(); await press(child, [1]); await press(child, [0]); await expect(child.locator('#lobby')).toBeVisible();
  // Leaving from nested settings must also dismiss the underlying ready dialog.
  await activate(parent, '#maze-create button'); await expect(parent.locator('#ready')).toBeVisible(); await press(parent, [2]); await activate(parent, '#maze-leave');
  await expect(parent.locator('#lobby')).toBeVisible(); await expect(parent.locator('#ready')).toBeHidden();
  assert.deepEqual(errors, []);
  console.log('PASS: controller-only lobby, settings, help, fixed-key room entry, both tutorials, reconnect guidance, mobile layout, countdown cancel, movement/wall, pause, unplug pause, role swap, result, ending and room exit.');
} finally { await browser?.close(); await app.close(); }
