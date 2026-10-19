import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

const app = await createApp({ port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const errors = [];
  const pages = await Promise.all([1, 2].map(async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      navigator.getGamepads = () => [];
      window.soundNotes = [];
      window.surfaceSplashes = [];
      const Base = window.AudioContext;
      window.AudioContext = class extends Base {
        createBufferSource() {
          const source = super.createBufferSource(), start = source.start.bind(source);
          source.start = at => {
            window.surfaceSplashes.push({ at, duration: source.buffer.duration, ending: document.getElementById('ending').open });
            start(at);
          };
          return source;
        }
        createOscillator() {
          const node = super.createOscillator(), start = node.start.bind(node);
          const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
          let frequency;
          node.frequency.setValueAtTime = (value, at) => { frequency = value; return setFrequency(value, at); };
          node.start = at => {
            window.soundNotes.push({ frequency, state: this.state });
            start(at);
          };
          return node;
        }
      };
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    return page;
  }));
  const [parent, child] = pages, origin = `http://127.0.0.1:${app.port}`;
  await parent.goto(`${origin}/test`);
  await parent.locator('#settings-open').click();
  await parent.locator('#sound-preview').click();
  assert.ok(await parent.evaluate(() => window.soundNotes.every(note => note.state === 'running')));
  const count = await parent.evaluate(() => window.soundNotes.length);
  assert.ok(count >= 2);
  await parent.locator('#sound-enabled').uncheck();
  await parent.locator('#settings-close').click();
  await parent.locator('#settings-open').click();
  assert.equal(await parent.evaluate(() => window.soundNotes.length), count);
  await parent.locator('#sound-volume').fill('20');
  await parent.reload();
  await parent.locator('#settings-open').click();
  await expect(parent.locator('#sound-enabled')).not.toBeChecked();
  await expect(parent.locator('#sound-volume')).toHaveValue('20');
  await parent.locator('#sound-enabled').check();
  await parent.goto(origin);
  await expect(parent.locator('#maze-create button')).toBeEnabled();
  await parent.locator('#maze-create button').click();
  await child.goto(origin);
  await expect(child.locator('#maze-join button')).toBeEnabled();
  await child.locator('#maze-join button').click();
  await expect(child.locator('#maze-role')).toHaveText('エクスプローラー');
  for (const page of pages) {
    await page.locator('#game-entry-start').click();
    await page.locator('#game-opening-video').evaluate(video => video.dispatchEvent(new Event('ended')));
    await expect(page.locator('#ready-tutorial')).toBeVisible();
  }
  const room = app.mazeRooms.rooms.get('A');
  // Drive server fixtures through real role-filtered WebSocket snapshots.
  room.members.forEach(member => { member.tutorialComplete = true; member.ready = true; });
  room.game.phase = 'countdown'; room.countdown = 3;
  app.mazeRooms.broadcast(room);
  await Promise.all(pages.map(page => expect(page.locator('#countdown')).toBeVisible()));
  await Promise.all(pages.map(page => expect(page.locator('#phase')).toHaveText('探検中', { timeout: 6000 })));
  for (const page of pages) {
    await expect.poll(() => page.evaluate(() => window.soundNotes.length)).toBeGreaterThan(3);
    await page.evaluate(() => { window.soundNotes = []; });
  }
  room.game.walls.add('0:1');
  app.mazeRooms.broadcast(room);
  await Promise.all(pages.map(page => expect.poll(() => page.evaluate(() => window.soundNotes.length)).toBe(1)));
  room.game.items[0].taken = true; room.game.items[0].damage = 2; room.game.collected++;
  app.mazeRooms.broadcast(room);
  await expect.poll(() => parent.evaluate(() => window.soundNotes.length)).toBe(2);
  await expect.poll(() => child.evaluate(() => window.soundNotes.length)).toBe(3);
  assert.equal(await parent.evaluate(() => window.soundNotes.at(-1).frequency), 220);
  assert.equal(await child.evaluate(() => window.soundNotes.at(-1).frequency), 990);
  app.mazeRooms.broadcast(room);
  await parent.waitForTimeout(200);
  assert.equal(await parent.evaluate(() => window.soundNotes.length), 2);
  assert.equal(await child.evaluate(() => window.soundNotes.length), 3);
  const explorerStart = room.game.avatar;
  room.game.base.delete(`${explorerStart - room.game.settings.cols}:${explorerStart}`);
  room.game.avatar = explorerStart - room.game.settings.cols; room.game.moves++;
  app.mazeRooms.broadcast(room);
  await expect.poll(() => child.evaluate(() => window.soundNotes.filter(note => note.frequency === 190).length)).toBe(1);
  assert.equal(await parent.evaluate(() => window.soundNotes.filter(note => note.frequency === 190).length), 0);
  app.mazeRooms.broadcast(room);
  await child.waitForTimeout(150);
  assert.equal(await child.evaluate(() => window.soundNotes.filter(note => note.frequency === 190).length), 1, 'repeated snapshots do not repeat swim');
  const explorerSocket = room.members.find(member => member.role === 'child').socket;
  app.mazeRooms.handle(explorerSocket, { type: 'move', direction: 1 });
  await expect.poll(() => child.evaluate(() => window.soundNotes.filter(note => note.frequency === 190).length)).toBe(2);
  await child.waitForTimeout(room.game.settings.moveMs + 50);
  app.mazeRooms.handle(explorerSocket, { type: 'move', direction: 1 });
  await child.waitForTimeout(150);
  assert.equal(await child.evaluate(() => window.soundNotes.filter(note => note.frequency === 190).length), 2, 'blocked movement stays silent');
  assert.equal(await parent.evaluate(() => window.soundNotes.filter(note => note.frequency === 190).length), 0, 'navigator never hears explorer swimming');
  await parent.mouse.move(0, 0);
  await expect(parent.locator('#board-parent')).toBeVisible();
  await parent.locator('#board-parent').focus();
  await parent.keyboard.press('ArrowRight');
  await parent.keyboard.press('ArrowDown');
  assert.equal(await parent.evaluate(() => window.soundNotes.filter(note => note.frequency === 420).length), 1, 'keyboard cursor movement sounds once; boundary is silent');
  const pointerNotes = await parent.locator('#board-parent').evaluate((canvas, settings) => {
    const rect = canvas.getBoundingClientRect();
    const before = window.soundNotes.filter(note => note.frequency === 420).length;
    const point = { clientX: rect.left + 32 / (settings.cols * 36 + 28) * rect.width,
      clientY: rect.top + 32 / (settings.rows * 36 + 28) * rect.height };
    canvas.dispatchEvent(new PointerEvent('pointermove', point));
    canvas.dispatchEvent(new PointerEvent('pointermove', point));
    return { count: window.soundNotes.filter(note => note.frequency === 420).length - before, width: rect.width, height: rect.height, cols: settings.cols, rows: settings.rows };
  }, room.game.settings);
  assert.equal(pointerNotes.count, 1, `pointer cell changes sound once: ${JSON.stringify(pointerNotes)}`);
  for (const page of pages) await page.evaluate(() => { window.soundNotes = []; });
  room.game.time = room.game.settings.duration - 6.5; app.mazeRooms.broadcast(room);
  await Promise.all(pages.map(page => expect(page.locator('#timer')).toHaveText('00:07')));
  for (const page of pages) {
    await expect(page.locator('#deadline-glow')).toBeHidden();
    assert.equal(await page.evaluate(() => window.soundNotes.length), 0);
  }
  for (const seconds of [5, 4, 3, 2, 1]) {
    room.game.time = room.game.settings.duration - seconds; app.mazeRooms.broadcast(room);
    await Promise.all(pages.map(page => expect(page.locator('#deadline-glow')).toBeVisible()));
    for (const page of pages) {
      await expect.poll(() => page.evaluate(() => window.soundNotes.filter(note => note.frequency === 130.81).length)).toBeGreaterThan(0);
      const period = { 5: '1s', 4: '0.8s', 3: '0.65s', 2: '0.5s', 1: '0.4s' }[seconds];
      await expect.poll(() => page.locator('#deadline-glow').evaluate(element => getComputedStyle(element).animationDuration)).toBe(period);
      const overlay = await page.locator('#deadline-glow').evaluate(element => {
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
        return { width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight, pointerEvents: style.pointerEvents, shadow: style.boxShadow };
      });
      assert.equal(overlay.width, overlay.viewportWidth);
      assert.equal(overlay.height, overlay.viewportHeight);
      assert.equal(overlay.pointerEvents, 'none');
      assert.ok(overlay.shadow.includes('inset'));
    }
    if (seconds === 3) {
      await child.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await child.locator('#deadline-glow').evaluate(element => getComputedStyle(element).animationName), 'none');
      await child.emulateMedia({ reducedMotion: 'no-preference' });
      room.game.phase = 'paused'; app.mazeRooms.broadcast(room);
      await Promise.all(pages.map(page => expect(page.locator('#deadline-glow')).toBeHidden()));
      room.game.phase = 'playing'; app.mazeRooms.broadcast(room);
      await Promise.all(pages.map(page => expect(page.locator('#deadline-glow')).toBeVisible()));
    }
  }
  room.game.time = room.game.settings.duration;
  room.game.phase = 'result'; app.mazeRooms.finish(room); app.mazeRooms.broadcast(room);
  await Promise.all(pages.map(page => expect(page.locator('#result')).toBeVisible()));
  for (const page of pages) {
    await expect(page.locator('#deadline-glow')).toBeHidden();
    const notes = await page.evaluate(() => window.soundNotes);
    const phrases = notes.filter(note => note.frequency === 130.81).length;
    assert.equal(notes.length, phrases * 4 + 16, 'accelerating four-note phrases followed by sixteen bubbles, no finish chime');
  }
  const openTutorial = async (page, role) => {
    await page.goto(`${origin}/test/${role}`);
    await page.locator('#game-entry-start').click();
    await page.locator('#game-opening-video').evaluate(video => video.dispatchEvent(new Event('ended')));
    await expect(page.locator('#ready-tutorial')).toBeVisible();
    await page.evaluate(() => { window.soundNotes = []; });
  };
  for (const page of pages) {
    await page.locator('#close-result').click();
    await expect(page.locator('#ending')).toBeVisible();
    const splashes = await page.evaluate(() => window.surfaceSplashes);
    assert.equal(splashes.length, 1, 'one splash on entering the ending');
    assert.equal(splashes[0].ending, true);
    assert.equal(splashes[0].duration, 1.25);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.surfaceSplashes.length), 1, 'state updates do not replay the splash');
  }
  const noteCount = (page, frequency) => page.evaluate(frequency => window.soundNotes.filter(note => note.frequency === frequency).length, frequency);
  await openTutorial(parent, 1);
  await expect.poll(() => noteCount(parent, 220), { timeout: 9000 }).toBe(1);
  assert.equal(await noteCount(parent, 420), 0, 'navigator does not hear explorer demo movement');
  await parent.locator('.briefing-next').click();
  await parent.locator('.practice-cell[data-x="2"][data-y="0"]').click();
  assert.equal(await noteCount(parent, 420), 1, 'navigator still hears their own cursor movement');
  await parent.keyboard.press('Space');
  await expect.poll(() => noteCount(parent, 320)).toBe(1);
  await parent.keyboard.press('Space');
  assert.equal(await noteCount(parent, 320), 1, 'duplicate wall input is silent');
  await parent.locator('.briefing-next').click();
  await expect.poll(() => noteCount(parent, 320), { timeout: 14000 }).toBe(2);
  assert.equal(await noteCount(parent, 420), 1, 'navigator timed demo movement is silent');
  await openTutorial(child, 2);
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowRight']) await child.keyboard.press(key);
  await expect.poll(() => noteCount(child, 660)).toBe(1);
  assert.equal(await noteCount(child, 220), 0, 'explorer encounters do not reveal damage');
  assert.equal(await noteCount(child, 190), 6, 'tutorial uses the same swim sound for each successful move');
  assert.equal(await noteCount(child, 420), 0, 'explorer swimming does not double with cursor beeps');
  await child.locator('.briefing-next').click();
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowUp']) await child.keyboard.press(key);
  await expect.poll(() => noteCount(child, 320)).toBe(1);
  const swims = await noteCount(child, 190);
  await child.keyboard.press('ArrowRight');
  assert.equal(await noteCount(child, 320), 1, 'blocked movement does not repeat wall audio');
  assert.equal(await noteCount(child, 190), swims, 'wrong tutorial direction is silent');
  await child.evaluate(() => {
    document.getElementById('sound-enabled').checked = false;
    document.getElementById('sound-enabled').dispatchEvent(new Event('change'));
    window.soundNotes = [];
  });
  await child.keyboard.press('ArrowDown');
  await child.waitForTimeout(250);
  assert.equal(await child.evaluate(() => window.soundNotes.length), 0, 'tutorial obeys mute');
  assert.deepEqual(errors, []);
  console.log('PASS: real Web Audio playback, mute, saved volume, two-player countdown/start/wall/encounter/end, role privacy and snapshot deduplication.');
  console.log('PASS: tutorial demo movement/encounters, manual and automatic walls, explorer touch/keyboard movement, role privacy, blocked/duplicate actions and mute.');
  console.log('PASS: navigator cursor audio, accelerating red glow/music for both roles, reduced motion, pause/resume and timeout bubbles.');
  console.log('PASS: explorer-only swim audio in live rooms and tutorial, accepted/blocked move commands, and duplicate snapshot suppression.');
  console.log('PASS: filtered surface splash plays once on entering THANK YOU FOR DIVING for both roles.');
} finally {
  await browser?.close();
  await app.close();
}
