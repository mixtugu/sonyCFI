import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

const app = await createApp({ port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__pad = null;
    navigator.getGamepads = () => window.__pad ? [{ id: 'DualSense', connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: window.__pad.includes(i) })) }] : [];
    sessionStorage.setItem('maze-session', JSON.stringify({ code: 'ABCDEF', token: 'existing-online-session' }));
  });
  const page = await context.newPage(), errors = [], roomRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('websocket', socket => roomRequests.push(socket.url()));
  page.on('request', request => { if (/\/(connection-info|maze-api|maze-socket)(\?|$)/.test(new URL(request.url()).pathname)) roomRequests.push(request.url()); });
  const origin = `http://127.0.0.1:${app.port}`;
  const confirm = async () => { await page.locator('.briefing-next').click(); await page.locator('.briefing-next').click(); await page.locator('.briefing-launch').click(); await page.locator('#ready-start').click(); };
  const pad = async buttons => { await page.evaluate(b => { window.__pad = b; }, buttons); await page.waitForTimeout(100); await page.evaluate(() => { window.__pad = []; }); await page.waitForTimeout(100); };

  await page.goto(`${origin}/test/1`);
  await expect(page.locator('#ready')).toBeVisible(); await expect(page.locator('.briefing-title')).toHaveText('壁を立てて子どもを守る');
  await expect(page.locator('#lobby')).toBeHidden(); await expect(page.locator('#board-parent')).toBeVisible(); await expect(page.locator('#board-child')).toBeHidden();
  await expect(page.locator('#ready-invite')).toBeHidden(); await expect(page.locator('.mode-group')).toBeHidden(); await expect(page.locator('#room-chip-partner')).toHaveText('相手はCPU');
  await page.locator('#ready-settings').click(); await page.locator('[name=duration]').fill('5'); await page.locator('#settings button[type=submit]').click();
  await expect(page.locator('.briefing-count')).toHaveText('01 / 03');
  await page.screenshot({ path: 'artifacts/test-1-parent.png' });
  await confirm(); await expect(page.locator('#countdown')).toBeVisible();
  await page.locator('#countdown-pause').click(); await expect(page.locator('#phase')).toHaveText('ひと休み中');
  await page.locator('#ready-start').click(); await expect(page.locator('#phase')).toHaveText('探検中');
  await expect(page.locator('#ready')).toBeHidden();
  await expect(page.locator('.briefing-title')).toHaveText('移動してアイテムを探し、報酬を獲得', { timeout: 10_000 });
  await expect(page.locator('#board-child')).toBeVisible(); await expect(page.locator('#board-parent')).toBeHidden();
  await confirm(); await expect(page.locator('#result')).toBeVisible({ timeout: 12_000 });
  await expect(page.locator('#result-rounds')).toContainText('第2ラウンド');
  await page.locator('#again').click(); await expect(page.locator('.briefing-title')).toHaveText('壁を立てて子どもを守る');
  await confirm(); await expect(page.locator('.briefing-title')).toHaveText('移動してアイテムを探し、報酬を獲得', { timeout: 12_000 });
  await confirm(); await expect(page.locator('#result')).toBeVisible({ timeout: 12_000 });
  await page.locator('#close-result').click(); await expect(page.locator('#ending')).toBeVisible(); await page.locator('#ending-finish').click();
  await expect(page.locator('#test-restart')).toBeVisible(); await expect(page.locator('#lobby')).not.toContainText('部屋をつくって');
  await page.locator('#test-restart').click(); await expect(page.locator('.briefing-title')).toHaveText('壁を立てて子どもを守る');
  assert.equal(new URL(page.url()).pathname, '/test/1');
  console.log('PASS: /test/1 direct entry, private parent view, settings, pause/countdown, role swap, report, replay, ending and restart.');

  // A fresh route starts as the child, even with an existing online room ticket.
  await page.goto(`${origin}/test/2/`);
  await expect(page.locator('.briefing-title')).toHaveText('移動してアイテムを探し、報酬を獲得');
  await expect(page.locator('#board-child')).toBeVisible(); await expect(page.locator('#board-parent')).toBeHidden();
  await pad([]); await expect(page.locator('.briefing-controller')).toBeVisible();
  await pad([15]); await expect(page.locator('.practice-feedback')).toContainText('移動');
  await pad([2]); await expect(page.locator('[name=duration]')).toBeDisabled(); await pad([1]);
  await page.screenshot({ path: 'artifacts/test-2-child.png' });
  await pad([9]); await pad([9]); await pad([9]); await pad([9]);
  await expect(page.locator('#phase')).toHaveText('探検中');
  await expect.poll(async () => await page.locator('#detail-parent').textContent()).not.toBe('0 / 12');
  await pad([9]); await expect(page.locator('#phase')).toHaveText('ひと休み中');
  await pad([9]); await expect(page.locator('#phase')).toHaveText('探検中');
  await pad([2]); await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.locator('#maze-leave').click(); await expect(page.locator('#test-restart')).toBeVisible(); await expect(page.locator('#ready')).toBeHidden();
  await page.locator('#test-restart').click(); await expect(page.locator('.briefing-title')).toHaveText('移動してアイテムを探し、報酬を獲得');
  await page.reload(); await expect(page.locator('.briefing-title')).toHaveText('移動してアイテムを探し、報酬を獲得');
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('maze-session')).token), 'existing-online-session');
  assert.deepEqual(roomRequests, []); assert.equal(app.mazeRooms.rooms.size, 0); assert.deepEqual(errors, []);
  console.log('PASS: /test/2 direct child entry, controller tutorial/start/pause, CPU parent, room-exit/reload, no room requests and unchanged online session.');
} finally { await browser?.close(); await app.close(); }
