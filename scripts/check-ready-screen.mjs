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
  const openTutorial = async (pageToOpen = page) => {
    const page = pageToOpen;
    await page.getByRole('button', { name: 'ゲームを開始する', exact: true }).click();
    await expect.poll(() => page.locator('#game-opening-video').evaluate(video => Number.isFinite(video.duration))).toBe(true);
    await page.locator('#game-opening-video').evaluate(video => { video.currentTime = video.duration - .1; });
    await expect(page.locator('.briefing-canvas')).toBeVisible();
  };
  const finishTutorial = async (pageToFinish = page) => {
    const page = pageToFinish;
    // Step through however many steps the role has (the navigator has four).
    while (await page.locator('.briefing-next').isVisible()) await page.locator('.briefing-next').click();
    await page.locator('.briefing-launch').click();
    await expect(page.locator('#ready-note')).toBeHidden();
    await expect(page.locator('#ready-note')).toBeEmpty();
    await expect(page.locator('#ready-review')).toHaveText('もう一度チュートリアルを見る');
    await expect(page.locator('#ready-start')).toHaveText('ゲームスタート！');
    await expect(page.locator('#ready-start')).toBeEnabled();
    await expect(page.locator('#ready-back')).toBeHidden();
  };
  for (const [route, role] of [['/test/1', 'ナビゲーター'], ['/test/2', 'エクスプローラー']]) {
    await page.goto(`http://127.0.0.1:${app.port}${route}`);
    await openTutorial();
    await finishTutorial();
    await expect(page.locator('#ready-title')).toContainText(role);
    await page.locator('#ready-review').click();
    await expect(page.locator('.briefing-count')).toHaveText(/^01 \/ 0[34]$/);
    await finishTutorial();
    await page.locator('#ready-start').click();
    await expect(page.locator('#countdown')).toBeVisible();
    await expect(page.locator('#countdown')).toBeHidden({ timeout: 6000 });
  }

  await page.goto(`http://127.0.0.1:${app.port}`);
  await page.locator('#maze-create button').click();
  // Every room game opens with the host choosing the number of players.
  await page.locator('#players-choice [data-players=duo]').click();
  await openTutorial();
  await finishTutorial();
  await page.locator('#ready-start').click();
  await expect(page.locator('#ready-start')).toHaveText('ゲームがもう少しで始まります…');
  await expect(page.locator('#ready-start')).toBeDisabled();
  await expect(page.locator('#ready-note')).toBeHidden();
  await expect(page.locator('#ready-review')).toBeHidden();
  assert.equal(app.mazeRooms.rooms.get('A').members[0].ready, true, 'start still submits readiness to the room');
  await page.screenshot({ path: 'artifacts/ready-screen-waiting.png' });
  const cancelReady = async (target, role) => {
    const back = target.getByRole('button', { name: '戻る', exact: true });
    await expect(back).toBeVisible();
    await expect(back).toBeFocused();
    await back.press('Enter');
    await expect(target.locator('#ready-title')).toContainText(role);
    await expect(target.locator('#ready-start')).toHaveText('ゲームスタート！');
    await expect(target.locator('#ready-start')).toBeEnabled();
    await expect(target.locator('#ready-start')).toBeFocused();
    await expect(target.locator('#ready-review')).toBeVisible();
    await expect(target.locator('#ready-back')).toBeHidden();
    const member = app.mazeRooms.rooms.get('A').members.find(m => m.role === (role === 'ナビゲーター' ? 'parent' : 'child'));
    assert.equal(member.ready, false);
    assert.equal(member.tutorialComplete, true);
  };
  await cancelReady(page, 'ナビゲーター');
  const guest = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  guest.on('pageerror', error => errors.push(error.message));
  await guest.goto(`http://127.0.0.1:${app.port}`);
  await guest.locator('#maze-join button').click();
  await openTutorial(guest);
  await finishTutorial(guest);
  await guest.locator('#ready-start').click();
  await expect(guest.locator('#ready-start')).toHaveText('ゲームがもう少しで始まります…');
  await cancelReady(guest, 'エクスプローラー');
  assert.equal(app.mazeRooms.rooms.get('A').members.length, 2, 'both players stay in the room after cancelling');
  assert.deepEqual(errors, []);
  console.log('PASS: both role confirmation screens, tutorial review, solo countdown and online ready cancellation.');
} finally {
  await browser?.close();
  await app.close();
}
