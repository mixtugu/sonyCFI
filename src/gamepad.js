import { accessPad } from './access-controller.js';

// DualSense / Access controller and others through the Gamepad API "standard" mapping, plus the
// hat-switch D-pad of controllers the browser reports without one.
export const BUTTONS = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, create: 8, options: 9, up: 12, down: 13, left: 14, right: 15, touchpad: 17 };
const REPEAT_DELAY = 280, REPEAT_EVERY = 110, DEAD_ZONE = .5;
// Directional holds are independent of × / ○ so only ← / → navigate the tutorial.
export const HOLD_MS = 650;
const HOLDABLE = ['cross', 'circle', 'left', 'right', 'up'];
const DPAD = ['right', 'down', 'left', 'up'];

// Controllers the browser has no layout for (mapping "") report the D-pad as one "hat switch" axis
// instead of buttons 12–15: -1 is up, then each 2/7 step turns 45° clockwise; at rest it reads
// above 1. The PlayStation Access controller can arrive this way.
const HAT_DIRECTIONS = [['up'], ['up', 'right'], ['right'], ['right', 'down'], ['down'], ['down', 'left'], ['left'], ['left', 'up']];
const hatAxes = new Map();
function hatDirections(pad) {
  if (pad.mapping === 'standard' || !pad.axes) return [];
  // The hat is the only axis that rests above 1; until it has been seen at rest, assume the usual slot.
  let index = hatAxes.get(pad.id);
  if (index === undefined) {
    index = pad.axes.findIndex(value => value > 1.05 && value < 1.5);
    if (index >= 0) hatAxes.set(pad.id, index); else index = pad.axes.length > 9 ? 9 : -1;
  }
  const value = pad.axes[index];
  if (index < 0 || !(Math.abs(value) <= 1.001)) return [];
  const step = Math.round((value + 1) * 3.5);
  return Math.abs((value + 1) * 3.5 - step) < .2 ? HAT_DIRECTIONS[step % 8] : [];
}
// Every named button held on a pad (or on any of several connected pads).
export function heldButtons(pad) {
  if (pad.pads) return new Set(pad.pads.flatMap(p => [...heldButtons(p)]));
  const held = new Set(Object.keys(BUTTONS).filter(name => !!pad.buttons[BUTTONS[name]]?.pressed));
  for (const name of hatDirections(pad)) held.add(name);
  return held;
}

// Direction index matching maze.js DIRS: 0 right, 1 down, 2 left, 3 up; -1 when idle.
export const padDirection = pad => stickDirection(pad.axes[0], pad.axes[1]);
// The right stick (axes 2 and 3) aims the parent's wall. Without a standard layout those axes may be
// triggers resting at -1, so only the D-pad aims there.
export const padAim = pad => pad.mapping === '' ? -1 : stickDirection(pad.axes[2], pad.axes[3]);
function stickDirection(x = 0, y = 0) {
  if (Math.max(Math.abs(x), Math.abs(y)) < DEAD_ZONE) return -1;
  return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 0 : 2) : (y > 0 ? 1 : 3);
}

// Turns raw pad snapshots into held direction, newly pressed buttons and a key-repeat style step.
// For ×, ○, ← and → it also reports `tapped` (released before the hold completed), `long` (the hold just
// completed) and `hold` (0–1 progress of a hold in flight, for on-screen feedback).
export function createPadReader() {
  let previous = new Set(), dir = -1, since = 0, lastStep = 0, aim = -1;
  const downAt = {}, fired = {};
  const idle = () => ({ dir: -1, step: -1, aim: -1, pressed: new Set(), tapped: new Set(), long: new Set(), hold: { cross: 0, circle: 0, left: 0, right: 0, up: 0 } });
  // A press that began on another screen must not finish as a tap or hold on this one.
  read.consume = () => { for (const name of HOLDABLE) if (downAt[name] !== undefined) fired[name] = true; };
  return read;
  function read(pad, now) {
    if (!pad) { previous = new Set(); dir = aim = -1; for (const name of HOLDABLE) downAt[name] = fired[name] = undefined; return idle(); }
    const held = heldButtons(pad);
    const pressed = new Set([...held].filter(name => !previous.has(name)));
    const tapped = new Set(), long = new Set(), hold = { cross: 0, circle: 0, left: 0, right: 0, up: 0 };
    for (const name of HOLDABLE) {
      if (pressed.has(name)) { downAt[name] = now; fired[name] = false; }
      if (held.has(name) && downAt[name] !== undefined) {
        const progress = Math.min(1, (now - downAt[name]) / HOLD_MS);
        if (progress >= 1 && !fired[name]) { fired[name] = true; long.add(name); }
        hold[name] = fired[name] ? 0 : progress;
      } else if (!held.has(name) && previous.has(name)) {
        if (downAt[name] !== undefined && !fired[name]) tapped.add(name);
        downAt[name] = undefined;
      }
    }
    previous = held;
    const next = padDirection(pad); let step = -1;
    if (next !== dir) { dir = next; since = lastStep = now; step = next; }
    else if (dir >= 0 && now - since >= REPEAT_DELAY && now - lastStep >= REPEAT_EVERY) { lastStep = now; step = dir; }
    const nextAim = padAim(pad), dpad = DPAD.findIndex(name => pressed.has(name));
    const aimed = dpad >= 0 ? dpad : nextAim !== aim ? nextAim : -1; aim = nextAim;
    return { dir, step, aim: aimed, pressed, tapped, long, hold };
  }
}

// Only the PlayStation Access controller opened over WebHID is read (access-controller.js); the
// Gamepad API is ignored so a profile set up on a PS5 can never change the layout.
export const firstPad = () => accessPad();

export function rumble(pad, strong = .5, weak = .5, duration = 80) {
  pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration, strongMagnitude: strong, weakMagnitude: weak }).catch?.(() => {});
}
