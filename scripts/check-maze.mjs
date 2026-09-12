import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createApp } from '../server/index.js';
import { createMaze, neighbor, edge } from '../src/maze.js';

const app = await createApp({ port: 0, host: '127.0.0.1' });
const url = `http://127.0.0.1:${app.server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await expect(page.locator('#board-parent')).toBeVisible();
  await expect(page.locator('#timer')).toHaveText('00:15');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/maze-desktop.png', fullPage: true });
  await page.locator('[name=duration]').fill('5'); await page.locator('#settings button[type=submit]').click();
  await page.locator('[data-mode=cpu]').click(); await page.locator('#start').click();
  await expect(page.locator('#phase')).toHaveText('探検中');
  await page.waitForTimeout(800); await page.locator('#start').click();
  const timer = await page.locator('#timer').textContent(); await page.waitForTimeout(250); await expect(page.locator('#timer')).toHaveText(timer);
  await page.locator('#start').click(); await expect(page.locator('#result')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#final-stats')).toContainText('マスの旅');
  await page.screenshot({ path: 'artifacts/maze-result.png', fullPage: true });
  await page.locator('#close-result').click(); await page.locator('#reset').click();
  await page.locator('[data-mode=parent]').click(); await page.locator('#start').click();
  // Find an open edge through the same public module, then exercise actual pointer placement.
  const target = (() => { const s = createMaze({ duration: 5 }, 260831); for (let a = 0; a < 240; a++) { const b = neighbor(s, a, 0); if (b >= 0 && !s.base.has(edge(a, b))) return { x: (a % 20 + 1) * 36 + 13, y: (Math.floor(a / 20) + .5) * 36 + 14 }; } })();
  const box = await page.locator('#board-parent').boundingBox();
  await page.mouse.click(box.x + target.x / 748 * box.width, box.y + target.y / 460 * box.height);
  await expect(page.locator('#detail-parent')).toHaveText('1 / 12');
  await expect(page.locator('#score-parent')).toHaveText('99');
  await page.locator('#reset').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/maze-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('#help-open').click(); await expect(page.locator('#help')).toBeVisible(); await page.locator('#help-close').click();
  await page.goto(`${url}/?online=1`); await expect(page.locator('#create-button')).toBeEnabled();
  assert.deepEqual(errors, []);
  console.log('Maze desktop/mobile, CPU, pause, result, wall pointer, help and legacy entry passed.');
} finally { await browser?.close(); await app.close(); }

