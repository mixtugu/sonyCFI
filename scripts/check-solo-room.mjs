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
  // Alone, the host explores; the switch above settings offers the navigator for this round.
  assert.equal(room().members[0].role, 'child');
  await expect(host.locator('#solo-navigator')).toBeVisible(); await expect(host.locator('#solo-navigator')).toHaveAttribute('aria-pressed', 'false');
  await expect(guest.locator('#solo-navigator')).toBeHidden();
  const [switchBox, gearBox] = await Promise.all([host.locator('#solo-navigator').boundingBox(), host.locator('#settings-open').boundingBox()]);
  assert.ok(switchBox.y + switchBox.height <= gearBox.y && Math.abs(switchBox.width - gearBox.width) < 2, 'a gear-sized switch just above settings');

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

  // Countdown, then the game: the guest watches the host's explorer view while the CPU navigates.
  await host.locator('#ready-start').click();
  await expect(guest.locator('#countdown')).toBeVisible();
  await expect(guest.locator('#countdown-pause')).toBeHidden();
  await expect(host.locator('#phase')).toHaveText('探検中', { timeout: 6000 });
  await expect(guest.locator('#countdown')).toBeHidden();
  await expect(guest.locator('#ready')).toBeHidden();
  await expect(guest.locator('#board-child')).toBeVisible(); await expect(host.locator('#board-child')).toBeVisible();
  await expect(guest.locator('#start')).toBeHidden(); await expect(host.locator('#start')).toBeVisible();
  await expect.poll(() => room().game.walls.size, { timeout: 8000 }).toBeGreaterThan(0);   // the CPU navigator
  const start = room().game.avatar;
  await host.locator('#board-child').focus();
  for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) { await host.keyboard.down(key); await host.waitForTimeout(700); await host.keyboard.up(key); if (room().game.avatar !== start) break; }
  assert.notEqual(room().game.avatar, start, 'the host explores');
  await guest.screenshot({ path: 'artifacts/solo-guest-game.png' });

  // Nobody new can come in while the host plays alone.
  const stranger = await open();
  await stranger.goto(url); await stranger.locator('#maze-join button').click();
  await expect(stranger.locator('#notice')).toContainText('ひとりで遊んでいるため参加できません');
  await expect(stranger.locator('#lobby')).toBeVisible();
  assert.equal(room().members.length, 2); assert.equal(room().game.phase, 'playing');
  await stranger.context().close();

  // A guest reload neither pauses nor resets the host's game, and picks the mirror back up.
  const game = room().game;
  await guest.reload();
  await expect(guest.locator('body')).toHaveClass(/spectating/);
  await expect(guest.locator('#board-child')).toBeVisible();
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

  // Solo again, now switched to navigator for this round: the CPU explores and the guest follows.
  await host.locator('[data-players=solo]').click();
  await expect(host.locator('#solo-navigator')).toHaveAttribute('aria-pressed', 'false', { message: 'the switch was cleared with the round' });
  await host.locator('#solo-navigator').click();
  await expect(host.locator('#solo-navigator')).toHaveAttribute('aria-pressed', 'true');
  assert.equal(room().members[0].role, 'parent');
  await host.screenshot({ path: 'artifacts/solo-navigator-switch.png' });
  await host.locator('#solo-navigator').click();
  await expect(host.locator('#solo-navigator')).toHaveAttribute('aria-pressed', 'false'); assert.equal(room().members[0].role, 'child');
  // The player count is chosen once per game; leaving it via the duo choice is the next game's.
  room().game.phase = 'ready'; app.mazeRooms.reset(room()); app.mazeRooms.broadcast(room());
  await expect(host.locator('#players-host')).toBeVisible();

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
