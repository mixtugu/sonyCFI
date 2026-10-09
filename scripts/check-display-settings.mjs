import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

const app = await createApp({ dev: true, port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { navigator.getGamepads = () => []; });
  await page.goto(`http://127.0.0.1:${app.port}/test`);
  await page.locator('#settings-open').click();
  await page.locator('#maze-zoom').fill('1.8');
  await expect(page.locator('#maze-zoom-value')).toHaveText('180%');
  for (const scale of ['1', '1.5', '2']) {
    await page.locator(`[data-text-scale="${scale}"]`).click();
    await expect(page.locator(`[data-text-scale="${scale}"]`)).toHaveAttribute('aria-pressed', 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `settings fit at text scale ${scale}`);
    await expect(page.locator('#settings-close')).toBeInViewport();
  }
  await page.locator('#settings-close').click();
  const board = await page.locator('#board-parent').evaluate(canvas => ({ width: canvas.getBoundingClientRect().width, viewport: canvas.parentElement.clientWidth, scroll: canvas.parentElement.scrollWidth }));
  assert.ok(board.width > board.viewport && board.scroll >= board.width, 'zoomed maze can be scrolled');
  await page.reload();
  await page.locator('#settings-open').click();
  await expect(page.locator('#maze-zoom')).toHaveValue('1.8');
  await expect(page.locator('[data-text-scale="2"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#maze-zoom').fill('1');
  await page.locator('[data-text-scale="1"]').click();
  await page.locator('#settings-close').click();
  await expect(page.locator('.board-surface.is-zoomed')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('app-text-scale', '2'));
  await page.goto(`http://127.0.0.1:${app.port}/test/1`);
  await expect(page.locator('.briefing-next')).toBeInViewport();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'large-text tutorial fits mobile');
  await page.evaluate(() => {
    localStorage.setItem('app-text-scale', '1');
    sessionStorage.setItem('maze-session', JSON.stringify({ code: 'ABCDEF', token: 'old-session' }));
  });
  await page.goto(`http://127.0.0.1:${app.port}/`);
  await expect(page.locator('#maze-create button')).toBeEnabled();
  await expect(page.locator('#maze-join input')).toHaveValue('A');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('maze-session')), null, 'legacy room ticket is discarded');
  assert.deepEqual(errors, []);
  console.log('PASS: mobile text sizes, maze zoom/scroll, preference persistence and reset.');
} finally { await browser?.close(); await app.close(); }
