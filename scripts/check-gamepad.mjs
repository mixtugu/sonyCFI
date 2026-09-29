import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

// A scripted DualSense: tests set window.__pad = { buttons: [indices], axes: [x, y] }.
const fakePad = () => {
  window.__pad = null; window.__rumbles = 0;
  navigator.getGamepads = () => {
    const state = window.__pad; if (!state) return [null];
    return [{ id: 'DualSense Wireless Controller', connected: true, mapping: 'standard', axes: state.axes || [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: state.buttons?.includes(i), value: state.buttons?.includes(i) ? 1 : 0 })),
      vibrationActuator: { playEffect: async () => { window.__rumbles++; return 'complete'; } } }];
  };
};
const app = await createApp({ port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch(); const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(fakePad); await page.goto(`http://127.0.0.1:${app.server.address().port}`);
  const press = async (buttons, axes) => { await page.evaluate(([b, a]) => { window.__pad = { buttons: b, axes: a }; }, [buttons, axes]); await page.waitForTimeout(120); await page.evaluate(() => { window.__pad = { buttons: [] }; }); await page.waitForTimeout(120); };
  await press([]); await expect(page.locator('#pad-status')).toBeVisible();
  await press([9]); await expect(page.locator('#phase')).toHaveText('探検中');             // OPTIONS starts
  await press([15]); await press([1]); await expect(page.locator('#direction')).toHaveText('下'); // ○ rotates
  await press([], [0, 0, 0, -1]); await expect(page.locator('#direction')).toHaveText('上'); // right stick aims
  await press([], [0, 0, -1, 0]); await expect(page.locator('#direction')).toHaveText('左');
  await press([], [0, 0, 1, 0]); await expect(page.locator('#direction')).toHaveText('右');
  for (const dir of [15, 12, 14, 13]) { await press([1]); await press([0]); if (await page.locator('#detail-parent').textContent() !== '0 / 12') break; } // × places
  await expect(page.locator('#detail-parent')).toHaveText('1 / 12');
  assert.ok(await page.evaluate(() => window.__rumbles) > 0, 'wall placement rumbles');
  await press([9]); await expect(page.locator('#phase')).toHaveText('ひと休み中');          // OPTIONS pauses
  await press([5]); await expect(page.locator('[data-mode=child]')).toHaveAttribute('aria-pressed', 'true'); // R1 next mode
  await press([8]); await expect(page.locator('#phase')).toHaveText('開始前');              // CREATE resets
  // No CPU walls in child mode, so any board change below comes from the child moving.
  await page.locator('.settings-panel summary').click(); await page.locator('[name=wallLimit]').fill('0'); await page.locator('#settings button[type=submit]').click();
  await press([9]); await expect(page.locator('#phase')).toHaveText('探検中');
  const snapshot = () => page.evaluate(() => document.querySelector('#board-child').toDataURL());
  const start = await snapshot(); let moved = false;
  for (const axes of [[1, 0], [0, -1], [-1, 0], [0, 1]]) {                               // left stick, held
    await page.evaluate(a => { window.__pad = { buttons: [], axes: a }; }, axes); await page.waitForTimeout(700);
    if (await snapshot() !== start) { moved = true; break; }
  }
  await page.evaluate(() => { window.__pad = { buttons: [] }; });
  assert.ok(moved, 'child moved with the stick');
  await press([3]); await expect(page.locator('body')).toHaveClass(/immersive/); await press([3]); await expect(page.locator('body')).not.toHaveClass(/immersive/); // △ fullscreen
  await press([4]); await expect(page.locator('[data-mode=parent]')).toHaveAttribute('aria-pressed', 'true'); // L1 previous mode
  assert.deepEqual(errors, []);
  console.log('Gamepad: connect indicator, OPTIONS start/pause, ○ rotate, × wall + rumble, L1/R1 modes, CREATE reset, △ fullscreen, stick movement passed.');
} finally { await browser?.close(); await app.close(); }
