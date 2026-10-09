import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createApp } from '../server/index.js';

const app = await createApp({ dev: true, port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const url = `http://127.0.0.1:${app.port}`;
  await mkdir('artifacts', { recursive: true });
  await page.goto(url);
  await expect(page.locator('.ocean-intro')).toBeVisible();
  await page.screenshot({ path: 'artifacts/ocean-intro.png' });
  await expect(page.locator('.ocean-intro')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('#maze-create button')).toBeVisible();
  await page.screenshot({ path: 'artifacts/ocean-lobby.png' });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `lobby fits ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/ocean-mobile.png', fullPage: true });
  await page.goto(`${url}/test`);
  await page.locator('.ocean-skip').click();
  await expect(page.locator('.ocean-intro')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.screenshot({ path: 'artifacts/ocean-maze-ready.png' });
  await page.locator('[data-mode=cpu]').click(); await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-ocean-phase', 'playing');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'artifacts/ocean-exploration.png' });
  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-ocean-phase', 'paused');
  const board = () => page.locator('#board-child').evaluate(c => c.toDataURL());
  const paused = await board(); await page.waitForTimeout(180); assert.equal(await board(), paused, 'paused board freezes its visual clock');
  const backdrop = () => page.locator('.ocean-backdrop').evaluate(c => c.toDataURL());
  const stoppedWater = await backdrop(); await page.waitForTimeout(180); assert.equal(await backdrop(), stoppedWater, 'paused ambient water stays still');

  // Isolated render fixtures verify visual privacy and animation without changing gameplay.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    const { createMaze, start, move, autoDirection } = await import('/src/maze.js');
    const { drawMaze } = await import('/src/maze-renderer.js');
    window.fixture = { createMaze, start, move, autoDirection, drawMaze };
  });
  const invariants = await page.evaluate(() => {
    const { createMaze, start, move, autoDirection, drawMaze } = window.fixture;
    const s = createMaze(); start(s);
    // The navigator's public high-risk warning is independent of exact hidden values.
    s.items = s.items.map(item => ({ ...item, highRisk: item.category === 'red' }));
    const render = (state, role) => { const c = document.createElement('canvas'); drawMaze(c, state, role, state.avatar, 0); return c.toDataURL(); };
    const child = render(s, 'child'), parent = render(s, 'parent');
    const changedSecretData = { ...s, goal: 0, items: s.items.map(i => ({ ...i, category: 'red', risk: 49, reward: 49 })) };
    const sameChild = child === render(changedSecretData, 'child');
    const sealedPearls = parent === render({ ...changedSecretData, goal: s.goal }, 'parent');
    const before = JSON.stringify(s, (_, value) => value instanceof Set ? [...value] : value);
    render(s, 'child'); render(s, 'parent');
    const noMutation = before === JSON.stringify(s, (_, value) => value instanceof Set ? [...value] : value);
    const c = document.createElement('canvas'); drawMaze(c, s, 'child', s.avatar, 0); const still = c.toDataURL();
    drawMaze(c, s, 'child', s.avatar, 0); const stable = c.toDataURL() === still;
    move(s, autoDirection(s)); drawMaze(c, s, 'child', s.avatar, 0); const moved = c.toDataURL() !== still;
    // Tutorial fixtures are drawn on demand and must move immediately, even with animation enabled.
    window.fixture.state = s;
    return { sameChild, sealedPearls, noMutation, stable, moved };
  });
  assert.deepEqual(invariants, { sameChild: true, sealedPearls: true, noMutation: true, stable: true, moved: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const tutorialMoves = await page.evaluate(() => {
    const { drawMaze, state } = window.fixture;
    const c = document.createElement('canvas'), s = { ...state, time: undefined };
    drawMaze(c, s, 'child', 0, 0); const a = c.toDataURL(); s.avatar++;
    drawMaze(c, s, 'child', 0, 0); return a !== c.toDataURL();
  });
  assert.ok(tutorialMoves, 'on-demand tutorial moves immediately');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url); await expect(page.locator('.ocean-intro')).toHaveCount(0);
  const reducedWater = await backdrop(); await page.waitForTimeout(300); assert.equal(await backdrop(), reducedWater, 'reduced-motion water is static');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#maze-create button')).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS: intro auto-finish/skip, responsive ocean, diver movement, frozen pause, reduced motion, tutorial redraw, render purity and role privacy.');
} finally { await browser?.close(); await app.close(); }
