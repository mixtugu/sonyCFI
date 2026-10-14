import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

const app = await createApp({ dev: true, port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${app.port}/test/1`);
  await expect(page.locator('.briefing-canvas')).toBeVisible();
  // Observe the actual canvas strokes used by the shared renderer, without replacing rendering.
  await page.evaluate(() => {
    window.effectStrokes = [];
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      if (this.canvas.classList.contains('briefing-canvas')) window.effectStrokes.push(this.strokeStyle);
      return stroke.apply(this, args);
    };
  });
  await page.keyboard.press('Space');
  await expect(page.locator('.practice-feedback')).toContainText('壁を設置');
  await expect.poll(() => page.evaluate(() => window.effectStrokes.includes('#ffb797'))).toBe(true);
  await page.screenshot({ path: 'artifacts/tutorial-shared-wall-effects.png' });
  await page.locator('.briefing-next').click();
  await expect(page.locator('.briefing-count')).toHaveText('02 / 03');
  await page.locator('.briefing-next').click();
  await expect(page.locator('.briefing-oxygen')).toBeVisible();

  await page.goto(`http://127.0.0.1:${app.port}/test/2`);
  await expect(page.locator('.briefing-canvas')).toBeVisible();
  await page.evaluate(() => {
    window.effectStrokes = [];
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      if (this.canvas.classList.contains('briefing-canvas')) window.effectStrokes.push(this.strokeStyle);
      return stroke.apply(this, args);
    };
  });
  const collect = async () => {
    for (const [x, y] of [[1, 3], [2, 3], [3, 3], [3, 2]]) {
      await page.locator(`.practice-cell[data-x="${x}"][data-y="${y}"]`).dispatchEvent('click');
      await page.waitForTimeout(220);
    }
  };
  await collect();
  await expect(page.locator('.practice-feedback')).toContainText('アイテム獲得');
  assert.ok(await page.evaluate(() => window.effectStrokes.includes('#8ee4df')), 'movement wake uses the round effect');
  assert.ok(await page.evaluate(() => window.effectStrokes.includes('#ffe4a7')), 'pickup ripple uses the round effect');
  await page.screenshot({ path: 'artifacts/tutorial-shared-pickup-effects.png' });
  await page.waitForTimeout(1600);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pixels = () => page.locator('.briefing-canvas').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(100);
  const collected = await pixels();
  await page.waitForTimeout(180);
  assert.equal(await pixels(), collected, 'reduced-motion practice stays static');
  // Returning to the exercise clears collected items, trails and cached effects.
  await page.locator('.briefing-next').dispatchEvent('click');
  await page.locator('.briefing-previous').dispatchEvent('click');
  await collect();
  await expect(page.locator('.practice-feedback')).toContainText('アイテム獲得');
  const repeated = await pixels();
  await page.locator('.briefing-next').dispatchEvent('click');
  await page.locator('.briefing-previous').dispatchEvent('click');
  await collect();
  await expect(page.locator('.practice-feedback')).toContainText('アイテム獲得');
  assert.ok(await pixels() === repeated, 'repeated practice has the same collected state');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.practice-feedback')).not.toContainText('アイテム獲得');
  await page.locator('.briefing-next').click();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.practice-feedback')).toContainText('秘密の通路を通り抜けました');
  await page.evaluate(() => document.exitFullscreen?.().catch(() => {}));
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.briefing-canvas')).toBeInViewport();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'artifacts/tutorial-shared-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: shared wall/movement/pickup effects, collection once, repeat/reset, secret passage, reduced motion and mobile tutorial.');
} finally {
  await browser?.close();
  await app.close();
}
