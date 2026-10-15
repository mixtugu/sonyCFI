import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createApp } from '../server/index.js';

const app = await createApp({ dev: true, port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${app.port}/test`);
  const result = await page.evaluate(async () => {
    const { drawDiverHD } = await import('/src/ocean-art.js');
    const urls = ['/src/assets/explorer/body.png', '/src/assets/explorer/fin-far.png', '/src/assets/explorer/fin-near.png'];
    const images = await Promise.all(urls.map(async url => {
      const image = new Image(); image.src = url; await image.decode(); return image;
    }));
    await new Promise(requestAnimationFrame);
    for (const image of images) {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let transparent = 0, visible = 0;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) transparent++;
        else { visible++; colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); }
      }
      if (transparent < canvas.width * canvas.height * .5 || visible < 200 || colors.size < 150) throw new Error('Explorer must retain detailed artwork with a transparent background');
      if (data[3] !== 0 || data[data.length - 1] !== 0) throw new Error('Opaque explorer background');
    }
    const gallery = document.createElement('section');
    gallery.id = 'explorer-gallery';
    gallery.style.cssText = 'background:#08263b;display:flex;position:relative;z-index:20;color:#fff;padding:20px;gap:20px';
    const render = (time, speed, angle = 0, append = false) => {
      const canvas = document.createElement('canvas'); canvas.width = 420; canvas.height = 280;
      const context = canvas.getContext('2d'), draws = [], water = [];
      const ellipse = context.ellipse.bind(context);
      context.ellipse = (...args) => {
        if (context.globalCompositeOperation === 'lighter') water.push(args);
        ellipse(...args);
      };
      const drawImage = context.drawImage.bind(context);
      context.drawImage = (image, ...args) => {
        if (image instanceof HTMLImageElement) {
          const m = context.getTransform();
          draws.push({ src: image.src, angle: Math.atan2(m.b, m.a), scale: Math.hypot(m.a, m.b) });
        }
        drawImage(image, ...args);
      };
      drawDiverHD(context, 225, 130, angle, time, speed, 5);
      if (append) gallery.append(canvas);
      return { draws, water: water.length, pixels: canvas.toDataURL() };
    };
    document.body.append(gallery);
    const first = render(0, 1, 0, true), next = render(.14, 1, 0, true);
    render(.14, 1, -Math.PI / 2, true);
    const idle = render(.14, 0);
    const halfTime = render(.07, 1);
    window.explorerReducedCheck = () => render(0, 1).pixels === render(10, 1).pixels;
    return { first: first.draws, next: next.draws, idle: idle.draws, halfTime: halfTime.draws, water: first.water, idleWater: idle.water, animated: first.pixels !== next.pixels };
  });
  assert.equal(result.first.length, 3);
  assert.equal(result.animated, true);
  for (const index of [0, 2]) {
    assert.ok(Math.abs(result.next[index].angle - result.first[index].angle) > .05, 'both fins kick');
    assert.ok(Math.abs(result.idle[index].angle - result.first[index].angle) > .05, 'stationary fins keep kicking visibly');
    assert.ok(Math.abs(result.idle[index].angle - result.halfTime[index].angle) < .001, 'stationary fins run at exactly half swimming speed');
  }
  assert.equal(result.next[1].angle, result.first[1].angle, 'helmet stays straight during kicks');
  assert.equal(result.water, 6, 'movement emits six wake bubbles');
  assert.equal(result.idleWater, 0, 'idle does not emit movement effects');
  assert.ok(Math.abs(result.first[1].scale - 5 * .37) < .001, 'top-down illustration preserves enlarged display size');
  assert.ok(Math.abs(result.first[1].angle - Math.PI / 2) < .001, 'back-view illustration faces straight ahead');
  const movement = await page.evaluate(async () => {
    const { createMaze, neighbor } = await import('/src/maze.js');
    const { drawMaze } = await import('/src/maze-renderer.js');
    const state = createMaze();
    state.phase = 'playing';
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    const drawImage = context.drawImage.bind(context), samples = [];
    let parts = [], clock = 1000;
    const original = Object.getOwnPropertyDescriptor(performance, 'now');
    Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
    context.drawImage = (image, ...args) => {
      if (image instanceof HTMLImageElement && /explorer|data:image/.test(image.src)) {
        const m = context.getTransform();
        parts.push({ angle: Math.atan2(m.b, m.a), length: Math.hypot(m.c, m.d) });
      }
      drawImage(image, ...args);
    };
    try {
      const frame = () => {
        parts = [];
        drawMaze(canvas, state, 'child', state.avatar, 0);
        if (parts.length !== 3) throw new Error('Explorer layers not rendered on maze');
        return parts.map(part => ({ angle: part.angle - parts[1].angle, length: part.length / parts[1].length }));
      };
      frame();
      state.avatar = [0, 1, 2, 3].map(dir => neighbor(state, state.avatar, dir)).find(cell => cell >= 0);
      state.moves++;
      frame();
      let elapsed = 0, phase = 0, speed = 3.5;
      for (let i = 0; i < 45; i++) {
        const previousTime = clock / 1000;
        clock += 50;
        state.time += .05;
        const dt = Math.min(.05, clock / 1000 - previousTime);
        elapsed += dt;
        const target = elapsed < .95 ? 7 : 3.5, decay = Math.exp(-dt / .3);
        phase += target * dt + (speed - target) * .3 * (1 - decay);
        speed = target + (speed - target) * decay;
        const sample = frame();
        if (Math.abs(sample[0].length - (1 - Math.sin(phase) * .3)) > .001) throw new Error(`Kick phase mismatch at ${i}: ${sample[0].length}, expected ${1 - Math.sin(phase) * .3}`);
        samples.push(sample);
      }
      state.phase = 'paused';
      const paused = frame();
      clock += 500;
      if (JSON.stringify(frame()) !== JSON.stringify(paused)) throw new Error('Pause must freeze the kick phase');
      return samples;
    } finally {
      if (original) Object.defineProperty(performance, 'now', original);
      else delete performance.now;
    }
  });
  for (const index of [0, 2]) {
    assert.ok(movement.some(sample => sample[index].length > 1.2), 'leg visibly extends during real maze movement');
    assert.ok(movement.some(sample => sample[index].length < .8), 'leg visibly retracts during real maze movement');
  }
  assert.ok(movement[5][0].angle * movement[5][2].angle < 0, 'legs kick in opposite phases after position interpolation ends');
  await mkdir('artifacts', { recursive: true });
  await page.locator('#explorer-gallery').screenshot({ path: 'artifacts/explorer-illustration.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => window.explorerReducedCheck()), true);
  assert.deepEqual(errors, []);
  console.log('Detailed explorer: straight heading, larger scale, alternating kicks, movement-only wake bubbles, idle cadence and reduced motion passed.');
} finally {
  await browser?.close();
  await app.close();
}
