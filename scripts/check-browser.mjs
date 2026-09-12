import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
const errors = [];
const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 1440, height: 1000 } })));
for (const context of contexts) await context.addInitScript(() => {
  const Native = window.WebSocket;
  window.receivedPackets = [];
  window.WebSocket = class extends Native {
    constructor(url, protocols) {
      super(url, protocols);
      if (url.endsWith('/socket')) {
        window.gameSocket = this;
        this.addEventListener('message', event => { const m = JSON.parse(event.data); window.receivedPackets.push(m); if (m.type === 'state') window.latestState = m; });
      }
    }
  };
  window.mockPads = [];
  Object.defineProperty(navigator, 'getGamepads', { value: () => window.mockPads });
});
const [child, parent, guest] = await Promise.all(contexts.map(context => context.newPage()));
for (const page of [child, parent, guest]) page.on('pageerror', e => errors.push(e.message));
const click = (page, action) => page.locator(`[data-action="${action}"]`).first().click();
const view = page => page.evaluate(() => window.latestState?.view);
const playing = page => expect.poll(() => page.evaluate(() => window.latestState?.status)).toBe('playing');
await mkdir('artifacts', { recursive: true });
try {
  await child.goto('http://localhost:5173/?online=1');
  await expect(child.locator('#create-button')).toBeEnabled();
  await child.screenshot({ path: 'artifacts/lobby-ja.png', fullPage: true });
  await child.locator('#create-button').click();
  await expect(child.locator('#room-code')).toHaveText(/^[A-Z2-9]{6}$/);
  const code = await child.locator('#room-code').innerText();
  await parent.goto(`http://localhost:5173/?room=${code}`);
  await expect(parent.locator('#join-button')).toBeEnabled();
  await parent.locator('#join-button').click();
  await expect(parent.locator('#role-eyebrow')).toContainText('親役');
  await expect(child.locator('#partner-status')).toHaveText('相手が接続中');
  assert.match(await child.locator('#mission-objective').innerText(), /真珠を5つ/);
  assert.match(await parent.locator('#mission-objective').innerText(), /合計25秒/);
  assert.equal((await view(child)).haven, null);
  assert.equal((await view(parent)).gate, null);
  assert.deepEqual((await view(parent)).treasures, []);
  assert.ok(!(await child.locator('body').innerText()).includes('合計25秒'));
  assert.ok(!(await parent.locator('body').innerText()).includes('真珠を5つ'));
  await guest.goto(`http://localhost:5173/?room=${code}`);
  await expect(guest.locator('#join-button')).toBeEnabled(); await guest.locator('#join-button').click();
  await expect(guest.locator('#lobby-error')).toContainText('すでに2人');
  await click(child, 'ready'); assert.equal((await view(child)).time, 0);
  await click(parent, 'ready'); await Promise.all([playing(child), playing(parent)]);
  const box = await parent.locator('#sea').boundingBox();
  const toScreen = (x, y) => ({ x: box.x + x / 1200 * box.width, y: box.y + y / 720 * box.height });
  const a = toScreen(400, 270), b = toScreen(400, 450);
  await parent.mouse.move(a.x, a.y); await parent.mouse.down(); await parent.mouse.move(b.x, b.y); await parent.mouse.up();
  await expect.poll(async () => (await view(child)).walls.length).toBe(1);
  await expect.poll(async () => (await view(parent)).walls.length).toBe(1);
  // Parent keyboard input moves their cursor, never the child's character.
  await parent.keyboard.down('a'); await parent.waitForTimeout(200); await parent.keyboard.up('a'); assert.equal((await view(child)).child.x, 285);
  await child.keyboard.down('d'); await child.waitForTimeout(800);
  assert.ok((await view(child)).child.x <= 382.1);
  assert.ok(Math.abs((await view(child)).child.x - (await view(parent)).child.x) < 10);
  await parent.screenshot({ path: 'artifacts/parent-ja.png', fullPage: true });
  await child.screenshot({ path: 'artifacts/child-ja.png', fullPage: true });
  // Keep moving until the shared state confirms the breakthrough; screenshots and
  // browser scheduling should not determine how far a held key travels.
  await expect.poll(async () => (await view(parent)).child.x, { timeout: 8000 }).toBeGreaterThan(430);
  await child.keyboard.up('d');
  // Reload reconnects to the same seat; both must explicitly resume.
  const beforeReload = (await view(child)).child.x;
  await child.reload();
  await expect.poll(() => parent.evaluate(() => window.latestState.status)).toBe('paused');
  await expect(child.locator('#role-eyebrow')).toContainText('子ども役');
  await expect(child.locator('#partner-status')).toHaveText('相手が接続中');
  assert.ok(Math.abs((await view(child)).child.x - beforeReload) < 12);
  const frozenTime = (await view(parent)).time;
  await parent.waitForTimeout(300); assert.equal((await view(parent)).time, frozenTime);
  await click(child, 'ready'); await click(parent, 'ready'); await Promise.all([playing(child), playing(parent)]);
  // Each independent screen uses its own first standard gamepad.
  await child.evaluate(() => { window.mockPads = [{ index: 0, axes: [0, -1], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) }]; });
  const oldY = (await view(child)).child.y; await child.waitForTimeout(500);
  await child.evaluate(() => { window.mockPads[0].axes = [0, 0]; });
  assert.ok((await view(parent)).child.y < oldY - 50);
  const aim = toScreen(950, 550); await parent.mouse.move(aim.x, aim.y);
  await parent.evaluate(() => { window.mockPads = [{ index: 0, axes: [0, 0], buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: index === 0 })) }]; });
  await expect.poll(async () => (await view(child)).walls.length).toBeGreaterThan(0);
  // Both screens enter the same review and receive both objectives only now.
  await click(parent, 'pause'); await expect(parent.locator('[data-action="finish"]')).toBeVisible(); await click(parent, 'finish');
  await expect(child.locator('#review')).toBeVisible(); await expect(parent.locator('#review')).toBeVisible();
  assert.equal((await child.evaluate(() => window.latestState.review)).breaks, 1);
  await child.locator('#replay').fill('0'); await child.locator('#replay').dispatchEvent('input');
  await expect(child.locator('#replay-time')).toContainText('秒');
  await child.screenshot({ path: 'artifacts/review-ja.png', fullPage: true });
  await click(child, 'swap'); await expect(child.locator('#swap-button')).toBeDisabled();
  await click(parent, 'swap'); await expect(child.locator('#role-eyebrow')).toContainText('親役'); await expect(parent.locator('#role-eyebrow')).toContainText('子ども役');
  // A phone-sized child screen retains only its own controls and mission.
  await parent.setViewportSize({ width: 390, height: 844 });
  assert.equal(await parent.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await parent.screenshot({ path: 'artifacts/mobile-ja.png', fullPage: true });
  await click(child, 'ready'); await click(parent, 'ready'); await Promise.all([playing(child), playing(parent)]);
  await parent.locator('#joystick').scrollIntoViewIfNeeded();
  const j = await parent.locator('#joystick').boundingBox(), touch = await parent.context().newCDPSession(parent);
  const startX = (await view(child)).child.x;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: j.x + j.width / 2 + 24, y: j.y + j.height / 2 }] });
  await parent.waitForTimeout(400); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await view(child)).child.x > startX + 25);
  assert.deepEqual(errors, []);
  console.log('PASS: separate browsers, room links/codes, role-private payloads and UI, third-player rejection, synchronized movement/walls, reconnect, local gamepads, shared review, mutual role swap, mobile touch and Japanese layout.');
} finally { await browser.close(); }

