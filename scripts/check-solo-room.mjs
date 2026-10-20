import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

// The host chooses on the start screen, before the briefing, to explore alone with the CPU. The guest
// then spectates: it follows the host's screens (start, opening, briefing steps, ready, countdown,
// game, result, ending, and back to start) with no buttons of its own, and stays in the room.
const app = await createApp({ dev: true, port: 0, host: '127.0.0.1' });
const url = `http://127.0.0.1:${app.port}`;
let browser;
try {
  browser = await chromium.launch();
  const errors = [];
  const open = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => { navigator.getGamepads = () => []; });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    return page;
  };
  const room = () => app.mazeRooms.rooms.get('A');
  const entry = page => page.getByRole('button', { name: 'ゲームを開始する', exact: true });

  const host = await open();
  await host.goto(url); await host.locator('#maze-create button').click();
  const guest = await open();
  await guest.goto(url); await guest.locator('#maze-join button').click();

  // Before the start screen, the host chooses the number of players; the guest waits for it.
  await expect(host.locator('#players-choice')).toBeVisible(); await expect(host.locator('#players-host')).toBeVisible();
  await expect(guest.locator('#players-choice')).toBeVisible(); await expect(guest.locator('#players-host')).toBeHidden();
  await expect(guest.locator('#players-guest')).toContainText('相手が人数を選ぶと、次へ進めます');
  await expect(entry(host)).toBeHidden(); await expect(entry(guest)).toBeHidden();
  for (const page of [host, guest]) for (const text of ['CPU', 'ホストが選']) assert.equal(await page.locator('#players-choice').getByText(text).count(), 0);
  await host.screenshot({ path: 'artifacts/players-choice-host.png' });
  await guest.screenshot({ path: 'artifacts/players-choice-guest.png' });
  await host.locator('[data-players=solo]').click();
  await expect(host.locator('#players-choice')).toBeHidden(); await expect(entry(host)).toBeVisible();

  // The guest now spectates the host's start screen, without its own start button.
  await expect(guest.locator('#players-choice')).toBeHidden();
  await expect(guest.locator('body')).toHaveClass(/spectating/);
  await expect(guest.locator('#game-entry')).toBeVisible(); await expect(entry(guest)).toBeHidden();
  await expect(guest.locator('#room-code')).toHaveText('A · 観戦中');

  // The host's opening video and briefing steps are followed.
  await entry(host).click();
  await expect(guest.locator('#game-opening')).toBeVisible();
  await expect.poll(() => host.locator('#game-opening-video').evaluate(video => Number.isFinite(video.duration))).toBe(true);
  await host.locator('#game-opening-video').evaluate(video => { video.currentTime = video.duration - .1; });
  await expect(host.locator('.briefing-canvas')).toBeVisible();
  await expect(guest.locator('#game-opening')).toBeHidden();
  await expect(guest.locator('.briefing-count')).toHaveText('01 / 03');
  await host.locator('.briefing-next').click();
  await expect(guest.locator('.briefing-count')).toHaveText('02 / 03');
  await expect(guest.locator('.briefing-footer')).toBeHidden();
  await guest.screenshot({ path: 'artifacts/solo-guest-briefing.png' });
  await host.locator('.briefing-next').click(); await host.locator('.briefing-launch').click();
  await expect(host.locator('#ready-start')).toHaveText('ゲームスタート！');
  await expect(guest.locator('#ready-title')).toContainText('相手は');
  await expect(guest.locator('#ready-tutorial')).toBeHidden(); await expect(guest.locator('#ready-start')).toBeHidden();

  // Countdown, then the game: the guest watches the host's navigator view while the CPU explores.
  await host.locator('#ready-start').click();
  await expect(guest.locator('#countdown')).toBeVisible();
  await expect(guest.locator('#countdown-pause')).toBeHidden();
  await expect(host.locator('#phase')).toHaveText('探検中', { timeout: 6000 });
  await expect(guest.locator('#countdown')).toBeHidden();
  await expect(guest.locator('#ready')).toBeHidden();
  await expect(guest.locator('#board-parent')).toBeVisible();
  await expect(guest.locator('#start')).toBeHidden(); await expect(host.locator('#start')).toBeVisible();
  const start = room().game.avatar;
  await expect.poll(() => room().game.avatar, { timeout: 5000 }).not.toBe(start);
  await guest.screenshot({ path: 'artifacts/solo-guest-game.png' });

  // A guest reload neither pauses nor resets the host's game, and picks the mirror back up.
  const game = room().game;
  await guest.reload();
  await expect(guest.locator('body')).toHaveClass(/spectating/);
  await expect(guest.locator('#board-parent')).toBeVisible();
  assert.equal(room().game, game); assert.equal(game.phase, 'playing');
  await expect(host.locator('#phase')).toHaveText('探検中');

  // Result and ending follow the host too, without the guest's own buttons.
  game.time = game.settings.duration - .01;
  await expect(host.locator('#result')).toBeVisible({ timeout: 5000 });
  await expect(guest.locator('#result')).toBeVisible();
  await expect(guest.locator('#close-result')).toBeHidden();
  await host.locator('#close-result').click();
  await expect(guest.locator('#ending')).toBeVisible();
  await expect(guest.locator('#ending-finish')).toBeHidden();
  // No way for the guest to leave the room while spectating.
  assert.equal(await guest.locator('#maze-leave').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(room().game, game, 'the solo game ends only when the host leaves the ending');
  await host.locator('#ending-finish').click();
  // The next game asks again: the host chooses, the guest waits.
  await expect(host.locator('#players-host')).toBeVisible();
  await expect(guest.locator('#ending')).toBeHidden();
  await expect(guest.locator('#players-guest')).toBeVisible();
  await expect(guest.locator('body')).not.toHaveClass(/spectating/);
  assert.equal(room().game.phase, 'ready'); assert.equal(room().chosen, false); assert.equal(room().members.length, 2);

  // Two players this time: both get their own start screen.
  await host.locator('[data-players=duo]').click();
  await expect(entry(guest)).toBeVisible(); await expect(entry(host)).toBeVisible();
  await expect(guest.locator('#room-code')).toHaveText('A');
  assert.equal(room().solo, false);
  assert.deepEqual(errors, []);
  console.log('PASS: host choice on the start screen, guest spectating start/opening/briefing steps/ready/countdown/game/result/ending, reload without pause, no leave button, back to duo.');
} finally {
  await browser?.close();
  await app.close();
}
