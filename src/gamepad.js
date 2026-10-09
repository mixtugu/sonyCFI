// DualSense (PS5) and other controllers through the Gamepad API "standard" mapping.
export const BUTTONS = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, create: 8, options: 9, up: 12, down: 13, left: 14, right: 15, touchpad: 17 };
const REPEAT_DELAY = 280, REPEAT_EVERY = 110, DEAD_ZONE = .5;
// × and ○ carry two actions each: a tap, and a hold that completes after HOLD_MS.
export const HOLD_MS = 650;
const HOLDABLE = ['cross', 'circle'];

const down = (pad, name) => !!pad.buttons[BUTTONS[name]]?.pressed;

// Direction index matching maze.js DIRS: 0 right, 1 down, 2 left, 3 up; -1 when idle.
export function padDirection(pad) {
  if (down(pad, 'right')) return 0; if (down(pad, 'down')) return 1; if (down(pad, 'left')) return 2; if (down(pad, 'up')) return 3;
  return stickDirection(pad.axes[0], pad.axes[1]);
}
// The right stick (axes 2 and 3) aims the parent's wall.
export const padAim = pad => stickDirection(pad.axes[2], pad.axes[3]);
function stickDirection(x = 0, y = 0) {
  if (Math.max(Math.abs(x), Math.abs(y)) < DEAD_ZONE) return -1;
  return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 0 : 2) : (y > 0 ? 1 : 3);
}

// Turns raw pad snapshots into held direction, newly pressed buttons and a key-repeat style step.
// For × and ○ it also reports `tapped` (released before the hold completed), `long` (the hold just
// completed) and `hold` (0–1 progress of a hold in flight, for on-screen feedback).
export function createPadReader() {
  let previous = new Set(), dir = -1, since = 0, lastStep = 0, aim = -1;
  const downAt = {}, fired = {};
  const idle = () => ({ dir: -1, step: -1, aim: -1, pressed: new Set(), tapped: new Set(), long: new Set(), hold: { cross: 0, circle: 0 } });
  // A press that began on another screen must not finish as a tap or hold on this one.
  read.consume = () => { for (const name of HOLDABLE) if (downAt[name] !== undefined) fired[name] = true; };
  return read;
  function read(pad, now) {
    if (!pad) { previous = new Set(); dir = aim = -1; for (const name of HOLDABLE) downAt[name] = fired[name] = undefined; return idle(); }
    const held = new Set(Object.keys(BUTTONS).filter(name => down(pad, name)));
    const pressed = new Set([...held].filter(name => !previous.has(name)));
    const tapped = new Set(), long = new Set(), hold = { cross: 0, circle: 0 };
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
    const nextAim = padAim(pad), aimed = nextAim !== aim ? nextAim : -1; aim = nextAim;
    return { dir, step, aim: aimed, pressed, tapped, long, hold };
  }
}

export function firstPad() { for (const pad of navigator.getGamepads?.() ?? []) if (pad?.connected) return pad; return null; }

export function rumble(pad, strong = .5, weak = .5, duration = 80) {
  pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration, strongMagnitude: strong, weakMagnitude: weak }).catch?.(() => {});
}
