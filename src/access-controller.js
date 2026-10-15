// PlayStation Access controller read directly over WebHID (Chrome / Edge, USB-C).
//
// The browser's Gamepad API only sees the controller's *mapped* actions, and on a PC those do not
// reliably follow the profile set up on a PS5. The controller's own input report also carries the
// *physical* buttons, independent of any profile, so the game reads those instead and applies its
// own fixed layout. Report layout from ps-access (MIT, PROTOCOL.md "Input report"):
//   data byte 0 / 1  stick X / Y (0x80 centred)
//   data byte 15     perimeter buttons 1–8, bit n−1 for button n
//   data byte 16     bit 0 centre button, bit 1 stick click
const FILTER = { vendorId: 0x054c, productId: 0x0e5f };
// This game's layout, by the controller's physical button numbers (1–8 around the ring, as the
// PS5 numbers them with the stick in its default place): the centre button is ×, and the four
// petals at the compass points are the D-pad.
export const ACCESS_LAYOUT = { up: 7, down: 3, left: 1, right: 5 };
const STANDARD_INDEX = { cross: 0, up: 12, down: 13, left: 14, right: 15 };
const DEAD_ZONE = .16;

let device = null, report = null;
const listeners = new Set();
export const accessSupported = () => typeof navigator !== 'undefined' && 'hid' in navigator;
export const accessConnected = () => !!device;
export function onAccessChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
const changed = () => listeners.forEach(listener => listener(!!device));

function onReport(event) {
  if (event.reportId !== 1) return;
  report = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength).slice();
}
async function attach(next) {
  if (device === next) return true;
  try {
    if (!next.opened) await next.open();
  } catch { return false; }   // e.g. another tab or app (such as the ps-access tool) holds it
  device?.removeEventListener('inputreport', onReport);
  device = next; report = null;
  device.addEventListener('inputreport', onReport);
  changed();
  return true;
}
// Re-attach a controller this site was already allowed to use; no prompt, so it runs at start-up.
export async function reconnectAccess() {
  if (!accessSupported()) return false;
  for (const candidate of await navigator.hid.getDevices()) if (candidate.vendorId === FILTER.vendorId && candidate.productId === FILTER.productId && await attach(candidate)) return true;
  return false;
}
// Ask for permission. Browsers allow this only from a click or key press (not a controller button).
export async function requestAccess() {
  if (!accessSupported()) return false;
  const granted = await navigator.hid.requestDevice({ filters: [FILTER] }).catch(() => []);
  for (const candidate of granted) if (await attach(candidate)) return true;
  return false;
}
if (accessSupported()) {
  navigator.hid.addEventListener('connect', () => { if (!device) reconnectAccess(); });
  navigator.hid.addEventListener('disconnect', event => { if (event.device === device) { device.removeEventListener('inputreport', onReport); device = null; report = null; changed(); } });
}

// Physical state: the set of pressed physical buttons (1–8, 'centre', 'stick') and the stick.
export function accessState() {
  if (!device || !report || report.length < 17) return null;
  const buttons = new Set();
  for (let bit = 0; bit < 8; bit++) if (report[15] & 1 << bit) buttons.add(bit + 1);
  if (report[16] & 1) buttons.add('centre');
  if (report[16] & 2) buttons.add('stick');
  const axis = value => { const v = (value - 128) / 128; return Math.abs(v) < DEAD_ZONE ? 0 : Math.max(-1, Math.min(1, v)); };
  return { buttons, stick: [axis(report[0]), axis(report[1])] };
}
// The controller as a standard-layout gamepad, so the rest of the game reads it like any other.
export function accessPad() {
  const state = accessState();
  if (!state) return device ? { id: 'Access Controller (WebHID)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] } : null;
  const pressed = new Set([state.buttons.has('centre') && STANDARD_INDEX.cross, ...Object.entries(ACCESS_LAYOUT).filter(([, number]) => state.buttons.has(number)).map(([name]) => STANDARD_INDEX[name])]);
  return { id: 'Access Controller (WebHID)', connected: true, mapping: 'standard', axes: [...state.stick, 0, 0], buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: pressed.has(i), value: pressed.has(i) ? 1 : 0 })) };
}
// The Gamepad API's view of the same controller, which the WebHID reading replaces while it is open.
export const isAccessGamepad = pad => /054c/i.test(pad.id) && /0e5f/i.test(pad.id) || /Access Controller/i.test(pad.id);
