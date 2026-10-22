import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

// A scripted Access controller on WebHID. Tests call window.__access({ buttons: [1–8, 'centre'], stick: [x, y] })
// to send an input report laid out as in ps-access PROTOCOL.md (byte 15 = buttons 1–8, byte 16 bit 0 =
// centre, bytes 0/1 = stick). The Gamepad API meanwhile reports the same controller with remapped,
// unrelated buttons, which the game must ignore while WebHID is open.
const fakeHid = () => {
  const device = new EventTarget();
  Object.assign(device, { vendorId: 0x054c, productId: 0x0e5f, productName: 'Access Controller', opened: false, open: async () => { device.opened = true; } });
  // Permission survives reloads, as it does in a real browser.
  const granted = () => sessionStorage.getItem('hid-granted') === '1';
  Object.defineProperty(navigator, 'hid', { value: Object.assign(new EventTarget(), {
    getDevices: async () => granted() ? [device] : [],
    requestDevice: async () => { sessionStorage.setItem('hid-granted', '1'); return [device]; },
  }) });
  window.__access = ({ buttons = [], stick = [0, 0] } = {}) => {
    const data = new Uint8Array(63);
    data[0] = Math.round(128 + stick[0] * 127); data[1] = Math.round(128 + stick[1] * 127);
    for (const b of buttons) { if (b === 'centre') data[16] |= 1; else data[15] |= 1 << (b - 1); }
    const event = new Event('inputreport'); Object.assign(event, { reportId: 1, data: new DataView(data.buffer), device });
    device.dispatchEvent(event);
  };
  // Once window.__leak is set, the Gamepad API also shows the controller holding □ (settings in /test).
  navigator.getGamepads = () => window.__leak ? [{ id: 'Access Controller (STANDARD GAMEPAD Vendor: 054c Product: 0e5f)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 2, value: i === 2 ? 1 : 0 })) }] : [];
};

const app = await createApp({ port: 0, host: '127.0.0.1' });
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(fakeHid);
  const send = async (state, ms = 150) => { await page.evaluate(s => window.__access(s), state); await page.waitForTimeout(ms); await page.evaluate(() => window.__access()); await page.waitForTimeout(150); };

  // First visit: permission is asked from a click; afterwards the controller reconnects by itself.
  await page.goto(`http://127.0.0.1:${app.port}/`);
  const connect = page.locator('.lobby-card .access-connect');
  await expect(connect).toBeVisible(); await connect.click(); await expect(connect).toBeHidden();
  await page.goto(`http://127.0.0.1:${app.port}/test?pad`); await expect(page.locator('#board-parent')).toBeVisible();
  await expect(page.locator('#settings-dialog .access-connect')).toBeHidden();   // reconnected without asking
  await send({});
  await expect(page.locator('#pad-status')).toBeVisible();
  await expect(page.locator('.gamepad-debug')).toContainText('WebHID Access');

  await page.locator('#start').click(); await expect(page.locator('#phase')).toHaveText('探検中');
  await page.evaluate(() => { window.__leak = true; });
  for (const [number, label] of [[7, '上'], [5, '右'], [3, '下'], [1, '左']]) { await send({ buttons: [number] }); await expect(page.locator('#direction')).toHaveText(label); }
  await expect(page.locator('#settings-dialog')).toBeHidden();   // the Gamepad API's remapped □ was ignored
  const cursorBefore = await page.evaluate(() => document.querySelector('#board-parent').toDataURL());
  await send({ stick: [1, 0] }, 300);
  assert.notEqual(await page.evaluate(() => document.querySelector('#board-parent').toDataURL()), cursorBefore, 'the stick moves the cursor');
  // A D-pad press places a wall by itself (the aim loop above already did); the centre × places nothing.
  await expect(page.locator('#detail-parent')).not.toHaveText('0 / 8');
  const placed = await page.locator('#detail-parent').textContent();
  await send({}); await send({ buttons: ['centre'] }, 300); await send({});
  await expect(page.locator('#detail-parent')).toHaveText(placed);
  assert.deepEqual(errors, []);
  console.log('PASS: Access controller over WebHID: connect button, reconnect, physical 7/5/3/1 aim and place, centre places nothing, stick moves, remapped Gamepad API input ignored, ?pad readout.');
} finally { await browser?.close(); await app.close(); }
