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
  // The opening screen sets up a room; the CPU practice modes live at /test.
  await page.goto(url); await expect(page.locator('#lobby')).toBeVisible(); await expect(page.locator('.workspace')).toBeHidden();
  await expect(page.locator('#maze-create button')).toBeEnabled(); await expect(page.locator('#lobby-summary')).toContainText('30秒');
  await page.goto(`${url}/test`); await expect(page.locator('#lobby')).toBeHidden();
  await expect(page.locator('#board-parent')).toBeVisible();
  await expect(page.locator('#timer')).toHaveText('00:30');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/maze-desktop.png', fullPage: true });
  await page.locator('#settings-open').click(); await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.locator('[name=duration]').fill('5'); await page.locator('[name=moveMs]').fill('1200'); await page.locator('#settings button[type=submit]').click();
  await expect(page.locator('#settings-dialog')).toBeHidden();
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
  const target = (() => { const s = createMaze({ duration: 5 }, 260831); const { cols, rows } = s.settings; for (let a = 0; a < cols * rows; a++) { const b = neighbor(s, a, 0); if (b >= 0 && !s.base.has(edge(a, b))) return { x: (a % cols + 1) * 36 + 13, y: (Math.floor(a / cols) + .5) * 36 + 14, w: cols * 36 + 28, h: rows * 36 + 28 }; } })();
  const box = await page.locator('#board-parent').boundingBox();
  await page.mouse.click(box.x + target.x / target.w * box.width, box.y + target.y / target.h * box.height);
  await expect(page.locator('#detail-parent')).toHaveText('1 / 12');
  await expect(page.locator('#score-parent')).toHaveText('99');
  // The round ends with an exchange: the next one puts this player on the other side.
  await expect(page.locator('#result')).toBeVisible({ timeout: 9000 });
  await expect(page.locator('#again')).toHaveText('交代してもう一度');
  await page.locator('#again').click();
  await expect(page.locator('#badge-child')).toHaveText('あなた'); await expect(page.locator('#badge-parent')).toHaveText('CPU');
  await page.locator('#reset').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/maze-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('f'); await expect(page.locator('body')).toHaveClass(/immersive/);
  for (const hidden of ['.top', '.mode-group', '#control-hint']) await expect(page.locator(hidden)).toBeHidden();
  for (const shown of ['#board-parent', '#board-child', '#oxygen', '#start', '#settings-open']) await expect(page.locator(shown)).toBeVisible();
  // The settings dialog has to stay reachable while the game fills the screen.
  await page.locator('#settings-open').click(); await expect(page.locator('#settings-dialog')).toBeVisible();
  await expect(page.locator('[name=duration]')).toBeVisible(); await page.locator('#settings-close').click();
  const fits = await page.evaluate(() => [...document.querySelectorAll('canvas')].every(c => c.getBoundingClientRect().bottom <= innerHeight) && document.documentElement.scrollHeight <= innerHeight);
  assert.equal(fits, true, 'immersive boards fit the viewport');
  await page.screenshot({ path: 'artifacts/maze-fullscreen.png' });
  await page.locator('#fullscreen').click(); await expect(page.locator('body')).not.toHaveClass(/immersive/); await expect(page.locator('.top')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#help-open').click(); await expect(page.locator('#help')).toBeVisible(); await page.locator('#help-close').click();
  await page.goto(`${url}/?online=1`); await expect(page.locator('#create-button')).toBeEnabled();
  assert.deepEqual(errors, []);
  console.log('Room lobby, /test mode, desktop/mobile, CPU, pause, result + swap, wall pointer, help, fullscreen and legacy entry passed.');
} finally { await browser?.close(); await app.close(); }

