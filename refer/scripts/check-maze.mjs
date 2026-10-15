import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createApp } from '../server/index.js';
import { createMaze, neighbor, edge } from '../src/maze.js';

const app = await createApp({ port: 0, host: '127.0.0.1' });
const url = `http://127.0.0.1:${app.server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // The opening screen sets up a room; the CPU practice modes live at /test.
  await page.goto(url); await expect(page.locator('#lobby')).toBeVisible(); await expect(page.locator('.workspace')).toBeHidden();
  await expect(page.locator('#maze-create button')).toBeEnabled(); await expect(page.locator('#lobby-summary')).toContainText('30秒');
  await expect(page.locator('#lobby-summary')).toContainText('10');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/room-creation-desktop.png', fullPage: true });
  await page.goto(`${url}/test`); await expect(page.locator('#lobby')).toBeHidden();
  await expect(page.locator('#board-parent')).toBeVisible();
  await expect(page.locator('#board-child')).toBeHidden();
  await expect(page.locator('#timer')).toHaveText('00:30');
  await expect(page.locator('#status-parent')).toHaveText('HP 30 / 30');
  await expect(page.locator('#navigator-hearts .hp-heart')).toHaveCount(30);
  await expect(page.locator('#navigator-hearts')).toHaveAttribute('aria-valuemax', '30');
  const heartRows = await page.locator('#navigator-hearts .hp-heart').evaluateAll(hearts => {
    const rows = new Map();
    for (const heart of hearts) { const y = Math.round(heart.getBoundingClientRect().top); rows.set(y, (rows.get(y) || 0) + 1); }
    return [...rows.values()];
  });
  assert.deepEqual(heartRows, [15, 15], 'hearts form two rows of fifteen');
  for (const selector of ['.hp-heart i', '.wall-stock-icon']) {
    const background = await page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundImage);
    assert.notEqual(background, 'none', 'illustrated icon background is present');
    const imageUrl = background.match(/^url\(["']?(.*?)["']?\)$/)[1];
    assert.equal(await page.evaluate(async url => { const image = new Image(); image.src = url; await image.decode(); return image.naturalWidth > 0; }, imageUrl), true, 'icon artwork decodes');
  }
  await expect(page.locator('#wall-stock-count')).toHaveText('壁 10 / 10 枚');
  const headingStyles = await page.locator('#status-parent, #wall-stock-count, .fish-risk-legend h3').evaluateAll(elements => elements.map(el => {
    const style = getComputedStyle(el);
    return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.color];
  }));
  assert.deepEqual(headingStyles[1], headingStyles[0], 'wall heading matches HP typography');
  assert.equal(headingStyles[2][0], headingStyles[0][0], 'safety heading matches HP font family');
  await expect(page.locator('.wall-stock-icon:not(.used)')).toHaveCount(10);
  assert.equal(await page.locator('.wall-stock-icon').evaluateAll(elements => new Set(elements.map(el => el.getBoundingClientRect().top)).size), 1, 'walls fit one row');
  await expect(page.locator('.fish-risk-legend h3')).toHaveText('安全にGOALまで進めよう');
  await expect(page.locator('.fish-risk-legend p').first()).toHaveText('魚に会う、壁を立てることでHPが減ります');
  await expect(page.locator('.risk-fish-icon')).toHaveCount(3);
  await expect(page.locator('.risk-wall-icon')).toHaveCount(1);
  const headingFit = await page.locator('.fish-risk-legend h3').evaluate(el => ({
    width: el.clientWidth, textWidth: el.firstElementChild.getBoundingClientRect().width,
    whiteSpace: getComputedStyle(el).whiteSpace,
  }));
  assert.equal(headingFit.whiteSpace, 'nowrap');
  assert.ok(headingFit.textWidth <= headingFit.width + .5 && headingFit.textWidth > headingFit.width - 3, 'heading uses largest one-line size');
  await expect(page.locator('.fish-risk-legend small')).toHaveCount(0);
  assert.equal(await page.locator('.fish-risk-legend').evaluate(el => getComputedStyle(el).borderTopStyle), 'solid');
  const heartsBox = await page.locator('#navigator-hearts').boundingBox(), wallsBox = await page.locator('.wall-stock').boundingBox();
  assert.ok(wallsBox.y >= heartsBox.y + heartsBox.height, 'remaining walls appear below HP hearts');
  await expect(page.locator('#detail-parent')).toHaveCount(0);
  const hpBox = await page.locator('#status-parent').boundingBox();
  assert.ok(heartsBox.y >= hpBox.y + hpBox.height && heartsBox.y - hpBox.y - hpBox.height < 30, 'hearts appear directly below HP');
  const riskBox = await page.locator('.fish-risk-legend').boundingBox();
  assert.ok(riskBox.y >= wallsBox.y + wallsBox.height, 'risk explanation appears below wall images');
  await expect(page.locator('#fish-catalog .catalog-entry.unknown')).toHaveCount(12);
  await expect(page.locator('[id^=score-]')).toHaveCount(0);
  const assertSidebar = async role => {
    const canvas = await page.locator(`#board-${role}`).boundingBox();
    const sidebar = await page.locator(`.board-card.${role} .board-sidebar`).boundingBox();
    assert.ok(sidebar.x >= canvas.x + canvas.width - 1, 'status panel is to the right of the maze');
    const strongSize = await page.locator(`#status-${role}`).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(strongSize >= 30, 'status text is at least 30px');
    assert.ok(sidebar.width >= 280, 'status sidebar is at least 280px wide');
  };
  await assertSidebar('parent');
  await page.locator('[data-mode=child]').click();
  await expect(page.locator('#board-parent')).toBeHidden();
  await expect(page.locator('#board-child')).toBeVisible();
  await assertSidebar('child');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/maze-explorer-desktop.png', fullPage: true });
  await page.locator('[data-mode=parent]').click();
  await expect(page.locator('#board-child')).toBeHidden();
  await mkdir('artifacts', { recursive: true });
  await expect(page.locator('.ocean-intro')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/maze-desktop.png', fullPage: true });
  await page.locator('#settings-open').click(); await expect(page.locator('#settings-dialog')).toBeVisible();
  await expect(page.locator('[name=wallCost], [name=rewardMin], [name=redMin]')).toHaveCount(0);
  await page.locator('[name=duration]').fill('5'); await page.locator('[name=moveMs]').fill('1200'); await page.locator('#settings button[type=submit]').click();
  await expect(page.locator('#settings-dialog')).toBeHidden();
  await page.locator('[data-mode=cpu]').click();
  await expect(page.locator('#board-parent')).toBeVisible(); await expect(page.locator('#board-child')).toBeVisible();
  await page.locator('#start').click();
  await expect(page.locator('#phase')).toHaveText('探検中');
  await page.waitForTimeout(800); await page.locator('#start').click();
  const timer = await page.locator('#timer').textContent(); await page.waitForTimeout(250); await expect(page.locator('#timer')).toHaveText(timer);
  await page.locator('#start').click(); await expect(page.locator('#result')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#final-stats')).toContainText('マスの旅');
  await page.screenshot({ path: 'artifacts/maze-result.png', fullPage: true });
  await page.locator('#close-result').click(); await page.locator('#fullscreen').click(); await page.locator('#reset').click();
  await page.locator('[data-mode=parent]').click(); await page.locator('#start').click();
  // Find an open edge through the same public module, then exercise actual pointer placement.
  const target = (() => { const s = createMaze({ duration: 5 }, 260831); const { cols, rows } = s.settings; for (let a = 0; a < cols * rows; a++) { const b = neighbor(s, a, 0); if (b >= 0 && !s.base.has(edge(a, b))) return { x: (a % cols + 1) * 36 + 13, y: (Math.floor(a / cols) + .5) * 36 + 14, w: cols * 36 + 28, h: rows * 36 + 28 }; } })();
  const box = await page.locator('#board-parent').boundingBox();
  const hpBeforeWall = Number(await page.locator('#navigator-hearts').getAttribute('aria-valuenow'));
  await page.mouse.click(box.x + target.x / target.w * box.width, box.y + target.y / target.h * box.height);
  await expect(page.locator('#detail-parent')).toHaveCount(0);
  await expect(page.locator('#wall-stock-count')).toHaveText('壁 9 / 10 枚');
  await expect(page.locator('.wall-stock-icon:not(.used)')).toHaveCount(9);
  await expect(page.locator('.wall-stock-icon.used')).toHaveCount(1);
  const hp = await page.locator('#navigator-hearts').getAttribute('aria-valuenow');
  assert.equal(Number(hp), Math.max(0, hpBeforeWall - 2), 'successful wall consumes two HP, floored at zero');
  await page.mouse.click(box.x + target.x / target.w * box.width, box.y + target.y / target.h * box.height);
  await expect(page.locator('#navigator-hearts')).toHaveAttribute('aria-valuenow', hp);
  await expect(page.locator('#wall-stock-count')).toHaveText('壁 9 / 10 枚');
  // The round ends with an exchange: the next one puts this player on the other side.
  await expect(page.locator('#result')).toBeVisible({ timeout: 9000 });
  await expect(page.locator('#again')).toHaveText('交代してもう一度');
  await page.locator('#again').click();
  await expect(page.locator('#badge-child')).toHaveText('あなた'); await expect(page.locator('#badge-parent')).toHaveText('CPU');
  await expect(page.locator('#board-parent')).toBeHidden(); await expect(page.locator('#board-child')).toBeVisible();
  await page.locator('#fullscreen').click(); await page.locator('#reset').click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('f'); await expect(page.locator('body')).toHaveClass(/immersive/);
  for (const hidden of ['.top', '.mode-group', '#control-hint']) await expect(page.locator(hidden)).toBeHidden();
  for (const shown of ['#board-child', '#oxygen', '#start', '#settings-open']) await expect(page.locator(shown)).toBeVisible();
  await expect(page.locator('#board-parent')).toBeHidden();
  await assertSidebar('child');
  // The settings dialog has to stay reachable while the game fills the screen.
  await page.locator('#settings-open').click(); await expect(page.locator('#settings-dialog')).toBeVisible();
  await expect(page.locator('[name=duration]')).toBeVisible(); await page.locator('#settings-close').click();
  const fits = await page.evaluate(() => [...document.querySelectorAll('.board-card:not([hidden]) canvas')].every(c => c.getBoundingClientRect().bottom <= innerHeight) && document.documentElement.scrollHeight <= innerHeight);
  assert.equal(fits, true, 'immersive boards fit the viewport');
  await page.screenshot({ path: 'artifacts/maze-fullscreen.png' });
  await page.locator('#fullscreen').click(); await expect(page.locator('body')).not.toHaveClass(/immersive/); await expect(page.locator('.top')).toBeVisible();
  await page.locator('#help-open').click(); await expect(page.locator('#help')).toBeVisible(); await page.locator('#help-close').click();
  await page.locator('[data-mode=parent]').click();
  await page.locator('#settings-open').click();
  await page.locator('[name=wallLimit]').fill('0'); await page.locator('#settings button[type=submit]').click();
  await expect(page.locator('#wall-stock-count')).toHaveText('壁 0 / 0 枚');
  await expect(page.locator('.wall-stock-icon')).toHaveCount(0);
  await page.locator('#settings-open').click(); await page.locator('#defaults').click(); await page.locator('#settings-close').click();
  await expect(page.locator('#wall-stock-count')).toHaveText('壁 10 / 10 枚');
  await expect(page.locator('.wall-stock-icon:not(.used)')).toHaveCount(10);
  await page.locator('#settings-open').click();
  await page.locator('[name=duration]').fill('120'); await page.locator('[name=moveMs]').fill('100');
  await page.locator('#settings button[type=submit]').click();
  await page.locator('#start').click();
  const encounterImage = page.locator('#fish-catalog .discovered img').first();
  await expect(encounterImage).toHaveAttribute('alt', /.+/, { timeout: 20000 });
  assert.equal(await encounterImage.evaluate(async image => { await image.decode(); return image.naturalWidth > 0; }), true);
  await page.locator('#start').click(); await page.locator('#fullscreen').click();
  await page.locator('[data-mode=child]').click();
  await expect(encounterImage).toBeVisible();
  await page.screenshot({ path: 'artifacts/creature-encounter-desktop.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Desktop: selected-role visibility, large right-side HP/catalog, CPU observer, pause, swap, wall pointer, help and fullscreen passed.');
} finally { await browser?.close(); await app.close(); }
