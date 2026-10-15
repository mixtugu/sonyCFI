import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';
import { mkdir } from 'node:fs/promises';

const app = await createApp({ port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = `http://127.0.0.1:${app.port}`;
  await page.goto(`${url}/test`);
  await page.locator('[data-mode=parent]').click();
  await expect(page.locator('#mode-description')).toBeHidden();
  await page.locator('[data-mode=child]').click();
  await expect(page.locator('#status-child')).toHaveText('図鑑 0 / 12 種');
  await expect(page.locator('#detail-child')).toHaveText('魚を捕まえて、図鑑を完成させよう');
  await expect(page.locator('#mode-description')).toBeHidden();
  await expect(page.locator('.catalog-tray')).not.toContainText('出会える生き物たち');
  await expect(page.locator('.catalog-tray')).not.toContainText('大・中・小サイズ別');
  const groups = [
    ['large', ['squid', 'shark', 'mermaid']],
    ['medium', ['turtle', 'octopus', 'lionfish', 'butterflyfish']],
    ['small', ['clownfish', 'shrimp', 'jellyfish', 'seahorse', 'stonefish']],
  ];
  const rarities = { shark: 4, mermaid: 5, squid: 4, turtle: 3, octopus: 3, lionfish: 3, butterflyfish: 3, clownfish: 1, shrimp: 1, jellyfish: 2, seahorse: 3, stonefish: 3 };
  for (const [size, species] of groups) {
    const count = species.length;
    const entries = page.locator(`.catalog-group.${size} .catalog-entry`);
    const heading = page.locator(`.catalog-group.${size} h3`);
    await expect(heading.locator('.catalog-size-icon')).toHaveAttribute('data-size', size);
    assert.ok(await heading.locator('small').evaluate(el => parseFloat(getComputedStyle(el).fontSize)) >= 16);
    assert.ok(await heading.locator('canvas').evaluate(canvas => {
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      return data.some((value, index) => index % 4 === 3 && value > 0);
    }), 'size icon is painted');
    await expect(entries).toHaveCount(count);
    await expect(entries.locator('small')).toHaveText(Array(count).fill('？？？'));
    await expect(entries.locator('.catalog-rarity')).toHaveText(species.map(id => '★'.repeat(rarities[id])));
    for (let i = 0; i < count; i++) {
      const name = await entries.nth(i).locator('small').boundingBox();
      const stars = await entries.nth(i).locator('.catalog-rarity').boundingBox();
      assert.ok(stars.y >= name.y + name.height - 1, 'rarity appears below name');
    }
    const images = await entries.locator('img').evaluateAll(elements => elements.map(el => ({
      src: el.src, alt: el.alt, filter: getComputedStyle(el).filter,
    })));
    images.forEach((image, index) => {
      assert.match(image.src, new RegExp(`/${species[index]}-`));
      assert.equal(image.alt, '未発見の生物のシルエット');
      assert.notEqual(image.filter, 'none');
    });
    const boxes = await entries.evaluateAll(elements => elements.map(el => ({ x: el.offsetLeft, y: el.getBoundingClientRect().top, w: el.getBoundingClientRect().width })));
    assert.equal(new Set(boxes.map(box => box.y)).size, 1, `${size} fits one row`);
  }
  const large = await page.locator('.catalog-group.large img').first().boundingBox();
  const small = await page.locator('.catalog-group.small img').first().boundingBox();
  assert.ok(large.width > small.width * 1.5 && large.height > small.height * 1.5);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/catalog-size-groups.png', fullPage: true });
  await page.goto(url);
  await page.locator('#maze-create button').click();
  const room = app.mazeRooms.rooms.get('A');
  const member = room.members[0];
  member.role = 'child';
  room.game.items[0].taken = room.game.items[1].taken = true;
  room.game.items[0].fishKind = room.game.items[1].fishKind = 'shark';
  room.game.collected = 2;
  app.mazeRooms.broadcast(room);
  await expect(page.locator('#status-child')).toHaveText('図鑑 1 / 12 種');
  await expect(page.locator('#fish-catalog .discovered')).toHaveCount(1);
  await expect(page.locator('#fish-catalog .discovered small')).toHaveText('サメ');
  await expect(page.locator('#fish-catalog .discovered .catalog-rarity')).toHaveText('★★★★');
  await expect(page.locator('.catalog-group.large h3 small')).toHaveText('1 / 3 種');
  await expect(page.locator('.catalog-size-icon')).toHaveCount(3);
  assert.equal(await page.locator('#fish-catalog .discovered img').evaluate(el => getComputedStyle(el).filter), 'none');
  await expect(page.locator('#fish-catalog .unknown')).toHaveCount(11);
  room.game.items.forEach(item => { item.taken = false; });
  room.game.collected = 0;
  app.mazeRooms.broadcast(room);
  await expect(page.locator('#fish-catalog .unknown')).toHaveCount(12);
  await expect(page.locator('.catalog-group.large .catalog-rarity')).toHaveText(['★★★★', '★★★★', '★★★★★']);
  assert.deepEqual(errors, []);
  console.log('Desktop catalog: 3/4/5 size rows, larger large-species art, hidden names, species deduplication, reveal and reset passed.');
} finally {
  await browser?.close();
  await app.close();
}
