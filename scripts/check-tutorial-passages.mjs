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
  await page.goto(`http://127.0.0.1:${app.port}/test/2`);
  await page.getByRole('button', { name: 'ゲームを開始する', exact: true }).click();
  await expect.poll(() => page.locator('#game-opening-video').evaluate(video => Number.isFinite(video.duration))).toBe(true);
  await page.locator('#game-opening-video').evaluate(video => { video.currentTime = video.duration - .1; });
  await expect(page.locator('.briefing-canvas')).toBeVisible();
  const rarityBubble = page.locator('.briefing-rarity-bubble');
  await expect(rarityBubble).toBeHidden();
  await page.evaluate(() => {
    window.passageStrokes = [];
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      if (this.canvas.classList.contains('briefing-canvas') && this.strokeStyle === '#8bffe0') {
        window.passageStrokes.push({
          dash: this.getLineDash(), offset: this.lineDashOffset,
          width: this.lineWidth, composite: this.globalCompositeOperation,
        });
      }
      return stroke.apply(this, args);
    };
  });
  const strokes = () => page.evaluate(() => window.passageStrokes);
  await page.waitForTimeout(120);
  assert.deepEqual(await strokes(), [], 'step 1 has no secret passage');
  await page.locator('.briefing-next').click();
  await expect(page.locator('.briefing-count')).toHaveText('02 / 03');
  await expect(rarityBubble).toBeHidden();
  await page.waitForTimeout(120);
  assert.deepEqual(await strokes(), [], 'the passage is hidden before the wall appears');

  const move = async cells => {
    for (const [x, y] of cells) {
      await page.locator(`.practice-cell[data-x="${x}"][data-y="${y}"]`).click();
    }
  };
  await move([[0, 2], [0, 1], [0, 0], [1, 0], [1, 1], [2, 1], [2, 0]]);
  await expect(page.locator('.briefing-wall-bubble')).toBeVisible();
  await expect.poll(async () => (await strokes()).length).toBeGreaterThan(1);
  const passage = await strokes();
  assert.ok(passage.every(s => s.dash.join(',') === '3,5' && Math.abs(s.width - 2.6) < .000001 && s.composite === 'lighter'),
    `the new path uses the shared game renderer’s glowing dotted passage: ${JSON.stringify(passage)}`);
  assert.ok(new Set(passage.map(s => s.offset)).size > 1, 'the dotted passage animates');
  await page.screenshot({ path: 'artifacts/tutorial-explorer-passage.png' });

  await move([[2, 1], [2, 2], [2, 3], [3, 3]]);
  await expect(page.locator('.practice-feedback')).toHaveText('最後まで探検できたね！');
  await expect(page.locator('.practice-feedback')).toHaveText('線に沿ってジョイスティックを動かそう', { timeout: 5000 });
  await page.evaluate(() => { window.passageStrokes = []; });
  await page.waitForTimeout(120);
  assert.deepEqual(await strokes(), [], 'restarting the exercise hides the passage again');

  await page.locator('.briefing-next').click();
  await expect(page.locator('.briefing-count')).toHaveText('03 / 03');
  const oxygenTimer = page.locator('.briefing-oxygen strong');
  const oxygenFill = page.locator('.briefing-oxygen .oxygen-fill');
  await expect(oxygenTimer).toHaveText('00:30');
  await expect(oxygenTimer).toHaveText('00:29');
  const fill = await oxygenFill.evaluate(element => parseFloat(element.style.width));
  assert.ok(fill > 90 && fill < 97, 'the oxygen gauge shrinks with elapsed time');
  await expect(rarityBubble).toBeVisible();
  await expect(rarityBubble).toHaveText('★が多いほどレアな生き物だよ！');
  const checkRarityPosition = async () => {
    const stars = await page.locator('.briefing-zukan .stars').nth(2).boundingBox();
    const bubble = await rarityBubble.boundingBox();
    assert.ok(stars && bubble && bubble.y > stars.y + stars.height, 'the rarity bubble sits below the stars');
    assert.ok(stars.x <= bubble.x + bubble.width / 2 && bubble.x + bubble.width / 2 <= stars.x + stars.width,
      'the bubble points upward at the middle creature’s stars');
  };
  await page.waitForTimeout(700);
  await checkRarityPosition();
  await page.screenshot({ path: 'artifacts/tutorial-explorer-rarity.png' });
  await page.waitForTimeout(120);
  assert.deepEqual(await strokes(), [], 'step 3 has no secret passage');
  await expect(oxygenTimer).toHaveText('00:30', { timeout: 15000 });
  assert.ok(await oxygenFill.evaluate(element => parseFloat(element.style.width) > 96),
    'the oxygen gauge refills when the collection demo repeats');
  await page.evaluate(() => document.exitFullscreen());
  await page.setViewportSize({ width: 390, height: 844 });
  await rarityBubble.scrollIntoViewIfNeeded();
  await expect(rarityBubble).toBeInViewport();
  await checkRarityPosition();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile has no horizontal overflow');
  await page.screenshot({ path: 'artifacts/tutorial-explorer-rarity-mobile.png' });
  await page.locator('.briefing-previous').click();
  await expect(rarityBubble).toBeHidden();
  assert.deepEqual(errors, []);
  console.log('PASS: explorer passage/traversal/reset, oxygen countdown/refill and rarity bubble on desktop/mobile.');
} finally {
  await browser?.close();
  await app.close();
}
