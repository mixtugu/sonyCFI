import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createApp } from '../server/index.js';

const app = await createApp({ dev: true, port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${app.port}/test`);
  const result = await page.evaluate(async () => {
    const { createMaze, FISH_RISK_LEVELS } = await import('/src/maze.js');
    const { drawMaze } = await import('/src/maze-renderer.js');
    const s = createMaze();
    s.phase = 'paused';
    const before = JSON.stringify(s, (_, value) => value instanceof Set ? [...value] : value);
    const render = (state, role) => {
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d'), marks = [], colors = [];
      const fillText = context.fillText.bind(context), stroke = context.stroke.bind(context);
      context.fillText = (text, ...args) => { if (/^!+$/.test(text)) marks.push(text); fillText(text, ...args); };
      context.stroke = (...args) => { if (context.shadowColor === '#39bfff') colors.push(context.strokeStyle); stroke(...args); };
      drawMaze(canvas, state, role, state.avatar, 0);
      return { image: canvas.toDataURL(), marks, colors };
    };
    const parent = render(s, 'parent'), child = render(s, 'child');
    const changed = { ...s, items: s.items.map(i => ({ ...i, category: 'red', damage: 2 })) };
    const network = { ...s, items: s.items.map(({ category, damage, ...i }) => ({ ...i, riskLevel: FISH_RISK_LEVELS[category] })) };
    const fallback = { ...s, items: s.items.map(({ fishSize, ...i }) => i) };
    const after = JSON.stringify(s, (_, value) => value instanceof Set ? [...value] : value);
    return {
      marks: parent.marks, childMarks: child.marks, colors: [...new Set(parent.colors)],
      childPrivate: child.image === render(changed, 'child').image,
      parentRiskVisible: parent.image !== render(changed, 'parent').image,
      networkSame: parent.image === render(network, 'parent').image,
      sizeIndependent: render(fallback, 'child').image === render({ ...fallback, items: changed.items.map(({ fishSize, ...i }) => i) }, 'child').image,
      pure: before === after,
    };
  });
  for (const mark of ['!', '!!', '!!!']) assert.equal(result.marks.filter(m => m === mark).length, 4);
  assert.deepEqual(result.childMarks, []);
  assert.deepEqual(result.colors, ['#62d8ff', '#d4f8ff']);
  for (const key of ['childPrivate', 'parentRiskVisible', 'networkSame', 'sizeIndependent', 'pure']) assert.equal(result[key], true, key);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const blinking = await page.evaluate(async () => {
    const { createMaze } = await import('/src/maze.js');
    const { drawMaze } = await import('/src/maze-renderer.js');
    const s = { ...createMaze(), time: undefined };
    const sample = ambient => {
      const canvas = document.createElement('canvas'), context = canvas.getContext('2d'), alpha = [], outlines = [], ratios = [];
      const fillText = context.fillText.bind(context), stroke = context.stroke.bind(context);
      context.fillText = (text, ...args) => { if (/^!+$/.test(text)) alpha.push(context.globalAlpha); fillText(text, ...args); };
      context.stroke = (...args) => {
        if (context.strokeStyle === '#62d8ff') { outlines.push(context.globalAlpha); const m = context.getTransform(); ratios.push(m.a / m.d); }
        stroke(...args);
      };
      drawMaze(canvas, s, 'parent', s.avatar, 0, { ambient });
      return { alpha, outlines, ratios };
    };
    const canvas = document.createElement('canvas'), paused = { ...createMaze(), phase: 'paused' };
    const getAlphas = () => {
      const context = canvas.getContext('2d'), alpha = [], fillText = context.fillText.bind(context);
      context.fillText = (text, ...args) => { if (/^!+$/.test(text)) alpha.push(context.globalAlpha); fillText(text, ...args); };
      drawMaze(canvas, paused, 'parent', paused.avatar, 0);
      context.fillText = fillText;
      return alpha;
    };
    const first = getAlphas();
    await new Promise(resolve => setTimeout(resolve, 150));
    return { bright: sample(0), fading: sample(.8), dark: sample(1.6), returned: sample(3.2), paused: JSON.stringify(first) === JSON.stringify(getAlphas()) };
  });
  for (const [phase, expected] of [['bright', 1], ['fading', .6], ['dark', .2], ['returned', 1]]) {
    assert.equal(blinking[phase].alpha.length, 12);
    assert.ok(blinking[phase].alpha.every(alpha => Math.abs(alpha - expected) < .001), `${phase} opacity`);
    assert.ok(blinking[phase].outlines.every(alpha => alpha === 1), 'outline stays visible');
    assert.ok(blinking[phase].ratios.every(ratio => Math.abs(ratio - 1.15 / 1.1) < .001), 'fish is stretched horizontally');
  }
  assert.equal(blinking.paused, true, 'pause freezes risk blinking');
  const creatures = await page.evaluate(async () => {
    const { CREATURES } = await import('/src/creatures.js');
    const { creatureImage, creatureImageUrl } = await import('/src/creature-art.js');
    const { createMaze } = await import('/src/maze.js');
    const { drawMaze } = await import('/src/maze-renderer.js');
    const ids = Object.keys(CREATURES);
    await Promise.all(ids.map(id => creatureImage(id).decode()));
    for (const id of ids) {
      const image = creatureImage(id), sample = document.createElement('canvas');
      sample.width = image.naturalWidth; sample.height = image.naturalHeight;
      const context = sample.getContext('2d');
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, sample.width, sample.height);
      let opaque = 0, transparent = 0;
      for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) opaque++; else transparent++; }
      if (opaque < 300 || transparent < sample.width * sample.height * .35) throw new Error(`Invalid transparent illustration: ${id}`);
      for (const [x, y] of [[0, 0], [sample.width - 1, 0], [0, sample.height - 1], [sample.width - 1, sample.height - 1]]) {
        if (data[(y * sample.width + x) * 4 + 3] !== 0) throw new Error(`Opaque background corner: ${id}`);
      }
    }
    const state = createMaze(); state.phase = 'paused';
    state.items = state.items.map((item, i) => ({ ...item, taken: true, fishKind: ids[i], damage: [0, 1, 1.5, 2][CREATURES[ids[i]].risk] }));
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d'), drawn = [];
    const drawImage = context.drawImage.bind(context);
    context.drawImage = (image, ...args) => {
      if (image instanceof HTMLImageElement && image.src.includes('/creatures/')) drawn.push({ src: image.src, width: args[2], height: args[3] });
      drawImage(image, ...args);
    };
    for (const role of ['child', 'parent']) {
      drawn.length = 0;
      drawMaze(canvas, state, role, state.avatar, 0);
      ids.forEach((id, index) => {
        const size = CREATURES[id].size, factor = size === 'large' ? 1.4 : size === 'small' ? .8 : 1;
        const image = creatureImage(id), drawing = drawn[index];
        const fit = Math.max(drawing.width / 29, drawing.height / 25);
        if (Math.abs(fit - factor) > .001) throw new Error(`${role}: wrong revealed size for ${id}`);
        if (Math.abs(drawing.width / drawing.height - image.naturalWidth / image.naturalHeight) > .001) throw new Error(`Distorted illustration: ${id}`);
      });
    }
    const gallery = document.createElement('section');
    gallery.id = 'creature-gallery';
    gallery.style.cssText = 'position:relative;z-index:10;background:#08263b;padding:24px;display:grid;grid-template-columns:repeat(6,1fr);gap:16px;color:#fff';
    gallery.innerHTML = ids.map(id => `<div style="text-align:center"><img src="${creatureImageUrl(id)}" alt="${CREATURES[id].name}" style="width:100%;height:130px;object-fit:contain;background:repeating-conic-gradient(#17394c 0% 25%,#21485b 0% 50%) 0/20px 20px"><p>${CREATURES[id].name}</p></div>`).join('');
    document.body.append(gallery);
    await Promise.all([...gallery.querySelectorAll('img')].map(image => image.decode()));
    return { drawn: drawn.length, loaded: ids.every(id => creatureImage(id).naturalWidth > 0) };
  });
  assert.deepEqual(creatures, { drawn: 12, loaded: true });
  await mkdir('artifacts', { recursive: true });
  await page.locator('#creature-gallery').screenshot({ path: 'artifacts/creature-illustrations.png' });
  await page.locator('#creature-gallery').evaluate(element => element.remove());
  await page.screenshot({ path: 'artifacts/fish-navigator-desktop.png', fullPage: true });
  await page.locator('[data-mode=child]').click();
  await page.screenshot({ path: 'artifacts/fish-explorer-desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Desktop fish icons: glowing uniform outline, three risk counts, explorer privacy, network parity, independent sizes and rendering purity passed.');
} finally {
  await browser?.close();
  await app.close();
}
