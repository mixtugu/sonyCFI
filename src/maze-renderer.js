import { neighbor, edge } from './maze.js';
import { drawDiverHD, drawRipple, disc, motionPreference, causticTile } from './ocean-art.js';

// Presentation-only: reads the role's state, never mutates it. Each canvas keeps its own visual
// state (clocks, caches, particles) in a WeakMap, including the tutorial boards.
const scenes = new WeakMap();
const TAU = Math.PI * 2, CELL = 36, PAD = 14;
const hash = n => { n |= 0; n = Math.imul(n ^ n >>> 16, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
const layer = (w, h) => { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; return canvas; };
const backOut = k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
function signature(edges, skip) {
  let h = 2166136261, n = 0;
  for (const e of edges) { if (skip?.has(e)) continue; n++; for (let i = 0; i < e.length; i++) h = Math.imul(h ^ e.charCodeAt(i), 16777619); }
  return [n, h >>> 0];
}
function mix(a, b, k) {
  const pa = a.match(/\w\w/g).map(x => parseInt(x, 16)), pb = b.match(/\w\w/g).map(x => parseInt(x, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
}

// Stacked strokes extrude a wall path toward the viewer; the cast shadow falls down-right.
function extrude(c, path, { height, width, side, top, edge: rim, alpha = 1, shadow = true }) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = alpha;
  if (shadow) for (const [w, a, x, y] of [[width + 8, .09, 5, 6], [width + 4, .14, 3.5, 4.5], [width + 1, .2, 2, 3]]) {
    c.save(); c.translate(x, y); c.strokeStyle = `rgba(0,8,16,${a})`; c.lineWidth = w; c.stroke(path); c.restore();
  }
  const steps = Math.ceil(height);
  for (let i = 0; i < steps; i++) { c.save(); c.translate(0, -i * height / steps); c.strokeStyle = mix(side[0], side[1], i / Math.max(1, steps - 1)); c.lineWidth = width; c.stroke(path); c.restore(); }
  c.save(); c.translate(0, -height); c.strokeStyle = top; c.lineWidth = width; c.stroke(path);
  c.translate(-.5, -.8); c.globalAlpha = alpha * .8; c.strokeStyle = rim; c.lineWidth = 1.1; c.stroke(path); c.restore();
  c.restore();
}

function paintSeabed(cols, rows, variant) {
  const w = cols * CELL + PAD * 2, h = rows * CELL + PAD * 2, canvas = layer(w * 2, h * 2), c = canvas.getContext('2d');
  c.scale(2, 2);
  const sand = c.createLinearGradient(0, 0, w * .35, h);
  sand.addColorStop(0, '#1e6674'); sand.addColorStop(.5, '#134c5d'); sand.addColorStop(1, '#0a3144');
  c.fillStyle = sand; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = hash(i * 7 + variant) * w, y = hash(i * 13 + 5 + variant) * h, r = 16 + hash(i * 3 + 1) * 46, light = hash(i + 99) > .5;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? 'rgba(130,210,195,.08)' : 'rgba(0,18,28,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.lineWidth = 1;
  for (let i = 0; i < h / 7; i++) {
    c.beginPath();
    for (let x = 0; x <= w; x += 6) { const y = i * 7 + Math.sin(x / 23 + i * .9) * 2.2 + Math.sin(x / 9 + i) * .6; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = i % 2 ? 'rgba(150,225,210,.05)' : 'rgba(0,14,24,.11)'; c.stroke();
  }
  for (let i = 0; i < w * h / 36; i++) { c.fillStyle = hash(i * 5 + 1) > .5 ? 'rgba(190,255,240,.08)' : 'rgba(0,10,20,.16)'; c.fillRect(hash(i * 17 + 3) * w, hash(i * 29 + 11) * h, 1, 1); }
  c.translate(PAD, PAD);
  c.strokeStyle = 'rgba(170,240,225,.055)'; c.lineWidth = .6; c.beginPath();
  for (let x = 0; x <= cols; x++) { c.moveTo(x * CELL, 0); c.lineTo(x * CELL, rows * CELL); }
  for (let y = 0; y <= rows; y++) { c.moveTo(0, y * CELL); c.lineTo(cols * CELL, y * CELL); }
  c.stroke();
  // Pebbles, shells, starfish and urchins sit in cell corners, clear of pearls and the diver's path.
  for (let n = 0; n < cols * rows; n++) {
    if (hash(n * 31 + variant * 7 + 1) > .36) continue;
    const corner = Math.floor(hash(n * 11 + variant) * 4), x = (n % cols) * CELL + (corner & 1 ? CELL - 7 : 7), y = Math.floor(n / cols) * CELL + (corner & 2 ? CELL - 7 : 7);
    const kind = Math.floor(hash(n * 5 + 3 + variant) * 5), turn = hash(n * 3 + 9) * TAU;
    c.save(); c.translate(x, y); c.rotate(turn);
    disc(c, 1, 1.4, 3.6, 'rgba(0,8,16,.25)');
    if (kind === 0) { for (const [px, py, r, col] of [[-2, 0, 2.6, '#2f6c74'], [2, 1, 2, '#3c7c80'], [.5, -2, 1.6, '#4e8e8d']]) { disc(c, px, py, r, col); disc(c, px - .6, py - .7, r * .35, 'rgba(200,255,240,.25)'); } }
    if (kind === 1) {
      const g = c.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#f3e1cf'); g.addColorStop(1, '#b79480');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 3); c.arc(0, 3, 4.2, Math.PI * 1.15, Math.PI * 1.85); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(110,70,60,.45)'; c.lineWidth = .5; for (let i = 1; i < 5; i++) { const a = Math.PI * (1.15 + .7 * i / 5); c.beginPath(); c.moveTo(0, 3); c.lineTo(Math.cos(a) * 4, 3 + Math.sin(a) * 4); c.stroke(); }
    }
    if (kind === 2) {
      c.fillStyle = '#e8875c'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10 - Math.PI / 2, r = i % 2 ? 1.5 : 4.2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill(); disc(c, 0, 0, .9, '#ffc49a');
    }
    if (kind === 3) { c.strokeStyle = '#2a2140'; c.lineWidth = .7; c.beginPath(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 4.4, Math.sin(a) * 4.4); } c.stroke(); disc(c, 0, 0, 2.2, '#3b2d57'); disc(c, -.6, -.6, .7, '#8c79b5'); }
    if (kind === 4) { c.strokeStyle = '#d9776c'; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 3); c.lineTo(0, -1); c.lineTo(-2.4, -3.4); c.moveTo(0, -1); c.lineTo(2.2, -3.8); c.moveTo(0, 1); c.lineTo(2.6, -.4); c.stroke(); disc(c, -2.4, -3.4, .9, '#ffb3a0'); disc(c, 2.2, -3.8, .9, '#ffb3a0'); }
    c.restore();
  }
  return canvas;
}

function paintWalls(s, role, cols, rows, segment) {
  const w = cols * CELL + PAD * 2, h = rows * CELL + PAD * 2, canvas = layer(w * 2, h * 2), c = canvas.getContext('2d');
  c.scale(2, 2); c.translate(PAD, PAD);
  const path = new Path2D(), frame = new Path2D(), segments = [];
  frame.rect(0, 0, cols * CELL, rows * CELL);
  for (const e of s.base) {
    if (role === 'child' && s.secrets.has(e)) continue;
    const [a, b] = e.split(':').map(Number), coords = segment(a, b);
    path.moveTo(coords[0], coords[1]); path.lineTo(coords[2], coords[3]); segments.push([coords, a * 131 + b]);
  }
  extrude(c, frame, { height: 5, width: 6.5, side: ['072430', '124050'], top: '#3c7a7b', edge: '#9fd8c8' });
  extrude(c, path, { height: 4.5, width: 5.2, side: ['0a2a35', '1a4a57'], top: '#4f918d', edge: '#addfcf' });
  // Rock texture and small corals on the wall tops.
  for (const [[x1, y1, x2, y2], id] of segments) {
    for (let i = 0; i < 2; i++) { const k = .25 + i * .5 + (hash(id + i) - .5) * .2; disc(c, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k - 4.5, 1.5 + hash(id * 3 + i) * .9, hash(id + i * 7) > .5 ? '#64a49c' : '#3f7d7c'); }
    if (hash(id * 7 + 3) < .2) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 5, hue = hash(id) > .5 ? ['#e88574', '#ffc0a8'] : ['#d9a64c', '#ffe3a0'];
      c.strokeStyle = hue[0]; c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath();
      c.moveTo(mx, my); c.lineTo(mx - 2.5, my - 3.5); c.moveTo(mx, my); c.lineTo(mx + 2.8, my - 3); c.moveTo(mx, my); c.lineTo(mx + .4, my - 4.5); c.stroke();
      for (const [px, py] of [[-2.5, -3.5], [2.8, -3], [.4, -4.5]]) disc(c, mx + px, my + py, .9, hue[1]);
    }
  }
  return { canvas, path };
}

function drawClam(c, x, y, amb, seed, open) {
  c.save(); c.fillStyle = 'rgba(0,10,18,.35)'; c.beginPath(); c.ellipse(x + 2.5, y + 5.5, 11.5, 4.8, 0, 0, TAU); c.fill();
  const shell = (cy, rx, ry, flip, dark, light) => {
    c.save(); c.translate(x, cy); if (flip) c.scale(1, -1);
    const g = c.createLinearGradient(0, 0, 0, ry); g.addColorStop(0, light); g.addColorStop(1, dark);
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(110,70,62,.35)'; c.lineWidth = .6;
    for (let i = 1; i < 6; i++) { const a = Math.PI * i / 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * rx * .94, Math.sin(a) * ry * .94); c.stroke(); }
    c.restore();
  };
  if (!open) { shell(y + 1, 9.5, 5, false, '#8e6f6a', '#c9a99c'); shell(y + 1, 9.5, 3.4, true, '#a08079', '#d8bcae'); c.restore(); return; }
  const breathe = Math.sin(amb * 1.6 + seed) * .08;
  shell(y - 2.5, 10, 7 * (.86 + breathe), true, '#a98178', '#e5c4b6');
  shell(y + 2, 11, 6, false, '#c9a397', '#f7e3d6');
  const g = c.createRadialGradient(x - 2.4, y - 3, .5, x, y - .5, 6.6);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.45, '#f6eed8'); g.addColorStop(1, '#b3a171');
  disc(c, x, y - .5, 6.3, g);
  const a = amb * .8 + seed;
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - 2 + Math.cos(a) * .8, y - 3 + Math.sin(a) * .5, 1.5, .9, -.6, 0, TAU); c.fill();
  c.fillStyle = 'rgba(90,72,40,.72)'; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', x + .3, y + .3);
  c.restore();
}

function drawKelp(c, cols, rows, amb, variant) {
  c.save(); c.lineCap = 'round';
  for (let n = 0; n < cols * rows; n++) {
    if (hash(n * 37 + 5 + variant) > .08) continue;
    const x = (n % cols) * CELL + 6 + hash(n) * 4, y = Math.floor(n / cols) * CELL + CELL - 5;
    for (let j = 0; j < 3; j++) {
      const len = 9 + hash(n * 3 + j) * 7, sway = Math.sin(amb * (1 + j * .3) + n + j) * 3;
      c.strokeStyle = ['#2f8a6e', '#3fa380', '#256f5c'][j]; c.lineWidth = 1.6 - j * .3;
      c.beginPath(); c.moveTo(x + j * 1.6, y); c.quadraticCurveTo(x + j * 1.6 + sway * .4, y - len * .55, x + j * 1.6 + sway, y - len); c.stroke();
    }
  }
  c.restore();
}

function drawFish(c, w, h, amb) {
  for (let k = 0; k < 2; k++) {
    const sp = .07 + k * .045, ph = k * 2.4;
    const cx = w / 2 + Math.sin(amb * sp + ph) * w * .46, cy = h / 2 + Math.sin(amb * sp * 1.7 + ph * 1.3) * h * .4;
    const heading = Math.atan2(Math.cos(amb * sp * 1.7 + ph * 1.3) * h * .4 * 1.7, Math.cos(amb * sp + ph) * w * .46);
    const cos = Math.cos(heading), sin = Math.sin(heading);
    for (let j = 0; j < 7; j++) {
      const row = j % 3, col = Math.floor(j / 3);
      const lx = -row * 9 - col * 6 + Math.sin(amb * 1.3 + j) * 1.5, ly = (col - 1) * 7 + (row - 1) * 3 + Math.cos(amb * 1.1 + j * 2) * 1.5;
      const x = cx + lx * cos - ly * sin, y = cy + lx * sin + ly * cos;
      c.save(); c.translate(x + 4, y + 6); c.rotate(heading); c.fillStyle = 'rgba(0,8,16,.18)'; c.beginPath(); c.ellipse(0, 0, 4, 1.6, 0, 0, TAU); c.fill(); c.restore();
      c.save(); c.translate(x, y); c.rotate(heading + Math.sin(amb * 3 + j) * .12);
      c.fillStyle = k ? 'rgba(255,214,140,.78)' : 'rgba(196,240,255,.72)';
      c.beginPath(); c.ellipse(0, 0, 4.2, 1.7, 0, 0, TAU); c.fill();
      const tail = Math.sin(amb * 9 + j) * 1.3;
      c.beginPath(); c.moveTo(-3.4, 0); c.lineTo(-6.6, -2 + tail); c.lineTo(-6.6, 2 + tail); c.closePath(); c.fill();
      disc(c, 2.3, -.4, .45, 'rgba(10,30,40,.8)');
      c.restore();
    }
  }
}

function drawJelly(c, w, h, amb) {
  const x = w * (.5 + .34 * Math.sin(amb * .031 + 1)), y = h * (.5 + .3 * Math.sin(amb * .043 + 2)), pulse = Math.sin(amb * 1.8);
  c.save(); c.globalCompositeOperation = 'lighter';
  const glow = c.createRadialGradient(x, y, 1, x, y, 20); glow.addColorStop(0, 'rgba(220,150,255,.2)'); glow.addColorStop(1, 'rgba(220,150,255,0)'); disc(c, x, y, 20, glow);
  c.strokeStyle = 'rgba(240,190,255,.35)'; c.lineWidth = .7;
  for (let i = 0; i < 5; i++) { const ox = (i - 2) * 2.2; c.beginPath(); c.moveTo(x + ox, y + 2); c.bezierCurveTo(x + ox + Math.sin(amb * 2 + i) * 2, y + 7, x + ox - Math.sin(amb * 2.3 + i) * 2, y + 11, x + ox + Math.sin(amb * 1.7 + i) * 1.5, y + 15 - pulse); c.stroke(); }
  const bell = c.createRadialGradient(x - 1.5, y - 2, .5, x, y, 8); bell.addColorStop(0, 'rgba(255,235,255,.55)'); bell.addColorStop(1, 'rgba(200,130,240,.18)');
  c.fillStyle = bell; c.beginPath(); c.ellipse(x, y, 7 * (1 + pulse * .08), 5.5 * (1 - pulse * .06), 0, Math.PI, TAU); c.quadraticCurveTo(x, y + 3, x - 7 * (1 + pulse * .08), y); c.fill();
  c.restore();
}

function drawAnchor(c, x, y) {
  const glow = c.createRadialGradient(x, y, 2, x, y, 17); glow.addColorStop(0, 'rgba(120,210,200,.3)'); glow.addColorStop(1, 'rgba(120,210,200,0)'); disc(c, x, y, 17, glow);
  c.save(); c.strokeStyle = 'rgba(190,240,228,.55)'; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath(); c.arc(x, y, 13, 0, TAU); c.stroke(); c.setLineDash([]);
  c.strokeStyle = '#d8f5ea'; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
  c.arc(x, y - 7, 1.8, 0, TAU); c.moveTo(x, y - 5); c.lineTo(x, y + 6); c.moveTo(x - 3.8, y - 2.6); c.lineTo(x + 3.8, y - 2.6);
  c.moveTo(x - 6, y + 1); c.quadraticCurveTo(x - 5, y + 6.5, x, y + 6.5); c.quadraticCurveTo(x + 5, y + 6.5, x + 6, y + 1); c.stroke(); c.restore();
}

export function drawMaze(canvas, s, role, cursor, direction, options = {}) {
  const { cols, rows } = s.settings, cell = CELL, pad = PAD;
  const width = cols * cell + pad * 2, height = rows * cell + pad * 2;
  if (canvas.width !== width * 2 || canvas.height !== height * 2) { canvas.width = width * 2; canvas.height = height * 2; }
  const c = canvas.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const center = n => [(n % cols + .5) * cell, (Math.floor(n / cols) + .5) * cell];
  const segment = (a, b) => {
    const x = a % cols, y = Math.floor(a / cols);
    return Math.abs(a - b) === 1 ? [Math.max(x, b % cols) * cell, y * cell, Math.max(x, b % cols) * cell, (y + 1) * cell] : [x * cell, Math.max(y, Math.floor(b / cols)) * cell, (x + 1) * cell, Math.max(y, Math.floor(b / cols)) * cell];
  };
  // Tutorial fixtures have no game clock: they move immediately and animate only ambient water.
  const still = motionPreference.matches, onDemand = !Number.isFinite(s.time), animate = !still && !onDemand;
  const now = performance.now() / 1000;
  let v = scenes.get(canvas);
  // Server snapshots replace the state object: reset by maze identity and round progress.
  if (!v || v.cols !== cols || v.rows !== rows || (!onDemand && (s.time < v.gameTime || s.moves < v.moves || (s.phase === 'ready' && v.phase !== 'ready')))) {
    const [x, y] = center(s.avatar);
    v = { cols, rows, x, y, fromX: x, fromY: y, avatar: s.avatar, angle: -.6, movedAt: 0, last: now, time: 0, ambient: 0, beat: -1,
      bubbles: [], events: [], sparks: [], puffs: [], births: new Map(), walls: new Set(s.walls), taken: new Set(s.items.filter(i => i.taken).map(i => i.cell)),
      explored: layer(width, height), fog: layer(width, height), stamped: 0, stampedAvatar: -1, fogLevel: null, phase: s.phase };
    scenes.set(canvas, v);
  }
  const dt = Math.min(.05, Math.max(0, now - v.last)); v.last = now;
  if (animate) { if (s.phase === 'playing') v.time += dt; if (['ready', 'countdown', 'playing'].includes(s.phase)) v.ambient += dt; }
  const amb = still ? 0 : onDemand ? options.ambient ?? 0 : v.ambient, t = v.time;
  v.gameTime = s.time; v.moves = s.moves; v.phase = s.phase;
  if (s.avatar !== v.avatar) {
    // Finish the preceding cell before turning, so the diver never cuts across a corner.
    const [oldX, oldY] = center(v.avatar), [nx, ny] = center(s.avatar);
    const adjacent = Math.abs(nx - oldX) + Math.abs(ny - oldY) === cell;
    v.fromX = adjacent && animate ? oldX : nx; v.fromY = adjacent && animate ? oldY : ny;
    if (adjacent) v.angle = Math.atan2(ny - oldY, nx - oldX);
    v.movedAt = t;
    if (animate && adjacent) {
      for (let i = 0; i < 5; i++) v.bubbles.push({ x: oldX + (nx - oldX) * i / 5, y: oldY + (ny - oldY) * i / 5, at: t, seed: i, clock: 'time' });
      v.puffs.push({ x: oldX, y: oldY, at: t, n: 6, spread: 10 });
      v.events.push({ x: oldX, y: oldY, at: t, color: '#8ee4df', radius: 18 });
    }
    v.avatar = s.avatar;
  }
  const [targetX, targetY] = center(s.avatar);
  const travel = animate ? Math.min(1, Math.max(0, (t - v.movedAt) / Math.min(.2, s.settings.moveMs / 1000 * .8))) : 1;
  const ease = travel * travel * (3 - 2 * travel);
  v.x = v.fromX + (targetX - v.fromX) * ease; v.y = v.fromY + (targetY - v.fromY) * ease;

  // Explored water stays lit: every visited cell is stamped once into a persistent light mask.
  const ex = v.explored.getContext('2d');
  const stamp = n => {
    const [x, y] = center(n), r = cell * 1.2, g = ex.createRadialGradient(x + pad, y + pad, 4, x + pad, y + pad, r);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ex.fillStyle = g; ex.fillRect(x + pad - r, y + pad - r, r * 2, r * 2);
  };
  if (s.trail.length < v.stamped) { ex.clearRect(0, 0, width, height); v.stamped = 0; v.stampedAvatar = -1; }
  for (; v.stamped < s.trail.length; v.stamped++) stamp(s.trail[v.stamped]);
  if (v.stampedAvatar !== s.avatar) { stamp(s.avatar); v.stampedAvatar = s.avatar; }

  const [baseCount, baseHash] = signature(s.base);
  const variant = (baseHash % 997) + baseCount;
  const seabedKey = `${cols}x${rows}:${variant}`;
  if (v.seabedKey !== seabedKey) { v.seabed = paintSeabed(cols, rows, variant); v.seabedKey = seabedKey; }
  const wallsKey = `${seabedKey}:${role}:${role === 'child' ? signature(s.base, s.secrets).join(':') : ''}`;
  if (v.wallsKey !== wallsKey) { v.wallsLayer = paintWalls(s, role, cols, rows, segment); v.wallsKey = wallsKey; }
  c.drawImage(v.seabed, 0, 0, width, height);

  // Two drifting caustic sheets at different scales interfere into a living light net on the sand.
  // The sheets are pre-tiled once per board and only slide per frame (pattern fills render inconsistently).
  if (v.sheetsKey !== `${width}x${height}`) {
    v.sheets = [[192, 7, 3.5, .15], [278, -5, 4.5, .1]].map(([size, sx, sy, alpha]) => {
      const sheet = layer(width + size, height + size), g = sheet.getContext('2d');
      for (let y = 0; y < height + size; y += size) for (let x = 0; x < width + size; x += size) g.drawImage(causticTile(), x, y, size, size);
      return { sheet, size, sx, sy, alpha };
    });
    v.sheetsKey = `${width}x${height}`;
  }
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const { sheet, size, sx, sy, alpha } of v.sheets) {
    const ox = ((amb * sx) % size + size) % size, oy = ((amb * sy) % size + size) % size;
    c.globalAlpha = alpha; c.drawImage(sheet, ox - size, oy - size, width + size, height + size);
  }
  c.restore();

  c.save(); c.translate(pad, pad);
  if (s.trail.length > 1) {
    const trail = new Path2D(); s.trail.forEach((n, i) => { const [x, y] = center(n); if (i) trail.lineTo(x, y); else trail.moveTo(x, y); });
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = c.lineCap = 'round';
    c.strokeStyle = role === 'parent' ? 'rgba(110,225,205,.06)' : 'rgba(110,240,210,.09)'; c.lineWidth = 12; c.stroke(trail);
    c.strokeStyle = 'rgba(160,255,230,.13)'; c.lineWidth = 2.2; c.stroke(trail);
    c.setLineDash([1, 7]); c.lineDashOffset = -amb * 6; c.strokeStyle = 'rgba(220,255,245,.45)'; c.lineWidth = 1.2; c.stroke(trail);
    c.restore();
  }
  drawKelp(c, cols, rows, amb, variant);
  drawAnchor(c, ...center((rows - 1) * cols));
  const palette = { red: '#e58a78', yellow: '#e8c170', green: '#72d4b5' };
  for (const item of s.items) {
    const [x, y] = center(item.cell);
    if (item.taken && !v.taken.has(item.cell)) {
      v.taken.add(item.cell);
      if (animate) { v.events.push({ x, y, at: t, color: '#ffe4a7', radius: 32 }); v.sparks.push({ x, y, at: t }); }
    }
    // A sealed pearl reveals neither category nor risk before collection.
    drawClam(c, x, y, amb, item.cell, !item.taken);
    if (item.taken) {
      disc(c, x, y - 3, 8.5, role === 'parent' ? palette[item.category] : '#1f5f5c');
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y - 3, 8.5, 0, TAU); c.stroke();
      c.fillStyle = role === 'parent' ? '#172f3b' : '#b7f8e6'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(role === 'parent' ? `−${item.risk}` : '✓', x, y - 2);
    }
  }
  c.drawImage(v.wallsLayer.canvas, -pad, -pad, width, height);
  for (const e of s.walls) {
    const [a, b] = e.split(':').map(Number), coords = segment(a, b);
    if (!v.walls.has(e)) {
      v.walls.add(e);
      if (animate) { v.births.set(e, t); v.events.push({ x: (coords[0] + coords[2]) / 2, y: (coords[1] + coords[3]) / 2, at: t, color: '#ffb797', radius: 26 }); v.puffs.push({ x: (coords[0] + coords[2]) / 2, y: (coords[1] + coords[3]) / 2, at: t, n: 12, spread: 20, line: coords }); }
    }
    if (role === 'child' && s.secrets.has(e)) continue;
    const born = v.births.get(e), k = born === undefined ? 1 : Math.min(1, (t - born) / .5), rise = k >= 1 ? 1 : backOut(k);
    const wall = new Path2D(); wall.moveTo(coords[0], coords[1]); wall.lineTo(coords[2], coords[3]);
    extrude(c, wall, { height: 5.5 * Math.max(.05, rise), width: 5.8, side: ['4a1d2a', '823445'], top: '#f0917a', edge: '#ffd8bf', alpha: Math.min(1, k * 2.5) });
    for (let i = 0; i < 4; i++) { const q = (i + .5) / 4; disc(c, coords[0] + (coords[2] - coords[0]) * q, coords[1] + (coords[3] - coords[1]) * q - 5.5 * rise, .9 + .3 * Math.sin(amb * 3 + i + a), 'rgba(255,225,205,.85)'); }
    if (k < 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * .6; c.strokeStyle = '#ff9f86'; c.lineWidth = 14; c.lineCap = 'round'; c.stroke(wall); c.restore(); }
  }
  drawFish(c, cols * cell, rows * cell, amb);
  c.restore();

  // Unexplored water is murky; the diver's torch and visited cells cut through it.
  const fogGoal = onDemand ? .22 : s.phase === 'result' ? 0 : role === 'child' ? .58 : .32;
  v.fogLevel = v.fogLevel === null || !animate ? fogGoal : v.fogLevel + (fogGoal - v.fogLevel) * (1 - Math.exp(-dt / .8));
  const dx = v.x + pad, dy = v.y + pad;
  if (v.fogLevel > .005) {
    const f = v.fog.getContext('2d');
    f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, width, height);
    f.fillStyle = `rgba(1,9,20,${v.fogLevel})`; f.fillRect(0, 0, width, height);
    f.globalCompositeOperation = 'destination-out';
    f.globalAlpha = .72; f.drawImage(v.explored, 0, 0); f.globalAlpha = 1;
    const flicker = 1 + Math.sin(amb * 9) * .015 + Math.sin(amb * 23) * .01, r = cell * 2.3 * flicker;
    const pool = f.createRadialGradient(dx, dy, 6, dx, dy, r); pool.addColorStop(0, 'rgba(0,0,0,1)'); pool.addColorStop(.55, 'rgba(0,0,0,.6)'); pool.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = pool; f.beginPath(); f.arc(dx, dy, r, 0, TAU); f.fill();
    f.save(); f.translate(dx, dy); f.rotate(v.angle);
    const beam = f.createLinearGradient(8, 0, cell * 3.3, 0); beam.addColorStop(0, 'rgba(0,0,0,.9)'); beam.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = beam; f.beginPath(); f.moveTo(8, -4); f.lineTo(cell * 3.3, -cell * 1.15); f.quadraticCurveTo(cell * 3.6, 0, cell * 3.3, cell * 1.15); f.lineTo(8, 4); f.closePath(); f.fill();
    f.restore();
    c.drawImage(v.fog, 0, 0, width, height);
    // Wall crests stay faintly traceable in the dark, like a sonar outline.
    c.save(); c.translate(pad, pad - 4.5); c.globalAlpha = Math.min(.35, v.fogLevel * .55); c.strokeStyle = '#b8f0de'; c.lineWidth = 1; c.lineCap = 'round'; c.stroke(v.wallsLayer.path); c.restore();
  }

  // Sun shafts and marine snow drift over everything, fog included.
  c.save(); c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const x = width * (i * .3 - .12) + Math.sin(amb * .2 + i * 1.7) * 22;
    c.save(); c.transform(1, 0, .38, 1, x, 0);
    const g = c.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(170,255,235,0)'); g.addColorStop(.5, `rgba(170,255,235,${.05 + .025 * Math.sin(amb * .5 + i)})`); g.addColorStop(1, 'rgba(170,255,235,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, height); c.restore();
  }
  for (let i = 0; i < 34; i++) {
    const x = ((hash(i * 3 + 1) * width + Math.sin(amb * .3 + i) * 10) % width + width) % width;
    const y = ((hash(i * 7 + 2) * height + amb * (3 + i % 5)) % height + height) % height;
    disc(c, x, y, i % 6 === 0 ? 1.4 : .7, `rgba(200,255,240,${i % 6 === 0 ? .35 : .22})`);
  }
  c.restore();

  c.save(); c.translate(pad, pad);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const item of s.items) {
    if (item.taken) continue;
    const [x, y] = center(item.cell), pulse = .75 + .25 * Math.sin(amb * 2.2 + item.cell * 1.3), r = 20 + pulse * 3;
    const glow = c.createRadialGradient(x, y, 2, x, y, r); glow.addColorStop(0, `rgba(255,228,165,${.3 * pulse})`); glow.addColorStop(1, 'rgba(255,228,165,0)'); disc(c, x, y, r, glow);
    const tw = Math.max(0, Math.sin(amb * 1.7 + item.cell * 2.1)) ** 6;
    if (tw > .02) { c.strokeStyle = `rgba(255,250,225,${tw * .9})`; c.lineWidth = .8; c.beginPath(); c.moveTo(x - 2 - 5 * tw, y - 3); c.lineTo(x - 2 + 5 * tw, y - 3); c.moveTo(x - 2, y - 3 - 5 * tw); c.lineTo(x - 2, y - 3 + 5 * tw); c.stroke(); }
  }
  c.restore();
  drawJelly(c, cols * cell, rows * cell, amb);
  if (role === 'parent') {
    // The exit is a column of daylight from an opening in the surface.
    const [x, y] = center(s.goal), sway = Math.sin(amb * 1.3) * .06;
    c.save(); c.globalCompositeOperation = 'lighter';
    const glow = c.createRadialGradient(x, y, 2, x, y, 28); glow.addColorStop(0, 'rgba(255,222,160,.45)'); glow.addColorStop(1, 'rgba(255,222,160,0)'); disc(c, x, y, 28, glow);
    c.translate(x, y); c.rotate(sway);
    const column = c.createLinearGradient(0, -y - pad, 0, 6); column.addColorStop(0, 'rgba(255,236,190,0)'); column.addColorStop(1, 'rgba(255,236,190,.28)');
    c.fillStyle = column; c.beginPath(); c.moveTo(-6, -y - pad); c.lineTo(6, -y - pad); c.lineTo(12, 4); c.lineTo(-12, 4); c.closePath(); c.fill(); c.restore();
    c.save(); c.translate(x, y); c.rotate(amb * .6); c.strokeStyle = 'rgba(255,225,170,.8)'; c.lineWidth = 1.4; c.setLineDash([3, 4]); c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.stroke(); c.restore();
    c.strokeStyle = '#fff1c9'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - 2, y + 7); c.lineTo(x - 2, y - 7); c.stroke();
    c.fillStyle = '#ffcf7a'; c.beginPath(); c.moveTo(x - 2, y - 7); c.quadraticCurveTo(x + 3, y - 6 + Math.sin(amb * 4) * 1, x + 6, y - 4); c.lineTo(x - 2, y - 1.5); c.closePath(); c.fill();
  }
  if (role === 'child') for (const e of s.secrets) {
    const [a, b] = e.split(':').map(Number), coords = segment(a, b), passage = new Path2D(); passage.moveTo(coords[0], coords[1]); passage.lineTo(coords[2], coords[3]);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    c.strokeStyle = 'rgba(120,255,220,.18)'; c.lineWidth = 9; c.stroke(passage);
    c.setLineDash([3, 5]); c.lineDashOffset = -amb * 8; c.strokeStyle = '#8bffe0'; c.lineWidth = 2.6; c.stroke(passage); c.setLineDash([]);
    const horizontal = coords[1] === coords[3];
    for (let i = 0; i < 3; i++) { const q = (amb * .7 + i / 3) % 1, along = .2 + .6 * hash(i * 7 + a), across = (q - .5) * 16; disc(c, coords[0] + (coords[2] - coords[0]) * along + (horizontal ? 0 : across), coords[1] + (coords[3] - coords[1]) * along + (horizontal ? across : 0), 1.1, `rgba(190,255,235,${Math.sin(q * Math.PI) * .9})`); }
    c.restore();
  }

  // Short-lived feedback: ripples, sand puffs, pickup sparkles and wake bubbles.
  for (const event of v.events) drawRipple(c, event.x, event.y, t - event.at, event.color, event.radius);
  v.events = v.events.filter(e => t - e.at < 1).slice(-24);
  for (const puff of v.puffs) {
    const age = (t - puff.at) / .8; if (age < 0 || age > 1) continue;
    for (let i = 0; i < puff.n; i++) {
      const a = hash(i * 13 + puff.n) * TAU, d = (.3 + hash(i * 7) * .7) * puff.spread * (1 - (1 - age) ** 2);
      const along = puff.line ? hash(i * 5 + 1) - .5 : 0;
      const bx = puff.line ? puff.x + (puff.line[2] - puff.line[0]) * along : puff.x, by = puff.line ? puff.y + (puff.line[3] - puff.line[1]) * along : puff.y;
      disc(c, bx + Math.cos(a) * d, by + Math.sin(a) * d * .6 - age * 4, 1.6 + age * 3, `rgba(205,228,210,${(1 - age) * .35})`);
    }
  }
  v.puffs = v.puffs.filter(p => t - p.at < .8).slice(-16);
  for (const spark of v.sparks) {
    const age = (t - spark.at) / 1.1; if (age < 0 || age > 1) continue;
    c.save(); c.globalCompositeOperation = 'lighter';
    const flash = c.createRadialGradient(spark.x, spark.y, 1, spark.x, spark.y, 30 * (.4 + age)); flash.addColorStop(0, `rgba(255,240,190,${(1 - age) ** 2 * .7})`); flash.addColorStop(1, 'rgba(255,240,190,0)'); disc(c, spark.x, spark.y, 30 * (.4 + age), flash);
    for (let i = 0; i < 14; i++) {
      const a = i * TAU / 14 + hash(i + 3) * .4, d = (8 + hash(i * 5) * 22) * (1 - (1 - age) ** 3), size = (1 - age) * (1.4 + hash(i) * 1.6);
      const px = spark.x + Math.cos(a) * d, py = spark.y + Math.sin(a) * d - age * 6;
      c.strokeStyle = `rgba(255,236,170,${1 - age})`; c.lineWidth = .8; c.beginPath(); c.moveTo(px - size * 1.6, py); c.lineTo(px + size * 1.6, py); c.moveTo(px, py - size * 1.6); c.lineTo(px, py + size * 1.6); c.stroke();
    }
    for (let i = 0; i < 5; i++) { const b = (age * 1.3 + i * .12) % 1; c.strokeStyle = `rgba(200,255,240,${(1 - b) * (1 - age)})`; c.lineWidth = .7; c.beginPath(); c.arc(spark.x + (i - 2) * 4 + Math.sin(b * 6 + i) * 2, spark.y - b * 26, 1 + b * 2, 0, TAU); c.stroke(); }
    c.restore();
  }
  v.sparks = v.sparks.filter(p => t - p.at < 1.1).slice(-8);
  // The regulator breathes out a cluster of bubbles every couple of seconds.
  const beat = Math.floor(amb / 1.8);
  if (!still && beat !== v.beat) {
    if (v.beat >= 0) { const hx = v.x + Math.cos(v.angle) * 7, hy = v.y + Math.sin(v.angle) * 7; for (let i = 0; i < 4; i++) v.bubbles.push({ x: hx + (i - 1.5) * 1.5, y: hy, at: amb + i * .07, seed: i + beat, clock: 'ambient' }); }
    v.beat = beat;
  }
  v.bubbles = v.bubbles.filter(b => (b.clock === 'ambient' ? amb : t) - b.at < 1.6).slice(-40);
  for (const bubble of v.bubbles) {
    const age = ((bubble.clock === 'ambient' ? amb : t) - bubble.at) / 1.6; if (age < 0) continue;
    c.strokeStyle = `rgba(200,255,244,${(1 - age) * .7})`; c.lineWidth = .8;
    c.beginPath(); c.arc(bubble.x + Math.sin(age * 5 + bubble.seed) * 3, bubble.y - age * 24, 1 + age * 2.2, 0, TAU); c.stroke();
    disc(c, bubble.x + Math.sin(age * 5 + bubble.seed) * 3 - .5, bubble.y - age * 24 - .6, .45, `rgba(255,255,255,${(1 - age) * .8})`);
  }

  // Torch beam, halo and the diver on top.
  c.save(); c.globalCompositeOperation = 'lighter';
  c.save(); c.translate(v.x, v.y); c.rotate(v.angle);
  const torch = c.createLinearGradient(10, 0, cell * 2.9, 0); torch.addColorStop(0, 'rgba(255,240,190,.22)'); torch.addColorStop(1, 'rgba(255,240,190,0)');
  c.fillStyle = torch; c.beginPath(); c.moveTo(10, -2.5); c.lineTo(cell * 2.9, -cell * .9); c.quadraticCurveTo(cell * 3.1, 0, cell * 2.9, cell * .9); c.lineTo(10, 2.5); c.closePath(); c.fill(); c.restore();
  const halo = c.createRadialGradient(v.x, v.y, 1, v.x, v.y, 30); halo.addColorStop(0, 'rgba(185,255,225,.16)'); halo.addColorStop(1, 'rgba(185,255,225,0)'); disc(c, v.x, v.y, 30, halo);
  c.restore();
  drawDiverHD(c, v.x, v.y, v.angle, amb + t, travel < 1 ? 1 : 0, .64);

  if (role === 'parent' && s.mode === 'parent' && s.phase !== 'result') {
    const [x, y] = center(cursor), pulse = .5 + .5 * Math.sin(amb * 4);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,210,150,.08)'; c.beginPath(); c.roundRect(x - 16, y - 16, 32, 32, 6); c.fill();
    c.strokeStyle = `rgba(255,228,170,${.6 + .4 * pulse})`; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.moveTo(x + sx * 15, y + sy * 9); c.lineTo(x + sx * 15, y + sy * 15); c.lineTo(x + sx * 9, y + sy * 15); }
    c.stroke(); c.restore();
    const b = neighbor(s, cursor, direction);
    if (b >= 0) {
      const valid = !s.base.has(edge(cursor, b)) && !s.walls.has(edge(cursor, b)) && s.walls.size < s.settings.wallLimit, coords = segment(cursor, b);
      const ghost = new Path2D(); ghost.moveTo(coords[0], coords[1]); ghost.lineTo(coords[2], coords[3]);
      c.save(); c.lineCap = 'round';
      if (valid) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,200,140,${.18 + .12 * pulse})`; c.lineWidth = 14; c.stroke(ghost); c.globalCompositeOperation = 'source-over'; }
      c.globalAlpha = valid ? .7 + .3 * pulse : .6; c.strokeStyle = valid ? '#ffe1a3' : '#768e98'; c.lineWidth = 5; c.stroke(ghost); c.restore();
    }
  }
  c.restore();

  const vignette = c.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .35, width / 2, height / 2, Math.max(width, height) * .72);
  vignette.addColorStop(0, 'rgba(0,6,14,0)'); vignette.addColorStop(1, 'rgba(0,6,14,.45)'); c.fillStyle = vignette; c.fillRect(0, 0, width, height);
}
export function pointerCell(canvas, s, event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * (s.settings.cols * 36 + 28) - 14;
  const y = (event.clientY - rect.top) / rect.height * (s.settings.rows * 36 + 28) - 14;
  const col = Math.floor(x / 36), row = Math.floor(y / 36);
  if (col < 0 || row < 0 || col >= s.settings.cols || row >= s.settings.rows) return null;
  const fx = x % 36, fy = y % 36, distances = [36 - fx, 36 - fy, fx, fy];
  return { cell: row * s.settings.cols + col, direction: distances.indexOf(Math.min(...distances)) };
}
