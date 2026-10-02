// Shared, procedural ocean artwork. All coordinates are presentation-only.
const TAU = Math.PI * 2;
export const motionPreference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
export function disc(c, x, y, r, fill) {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill();
}
export function drawWater(c, w, h, time, { surface = false, detail = 1 } = {}) {
  const t = motionPreference.matches ? 0 : time;
  c.save();
  const water = c.createLinearGradient(0, 0, w * .35, h);
  water.addColorStop(0, '#16788a'); water.addColorStop(.35, '#0b4c63'); water.addColorStop(1, '#041c32');
  c.fillStyle = water; c.fillRect(0, 0, w, h);
  // Wide, soft shafts and narrow caustic bands refract at different rates.
  c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const x = w * (i * .21 - .16) + Math.sin(t * .19 + i) * w * .035;
    c.save(); c.transform(1, 0, w * .27 / h, 1, x, 0);
    const light = c.createLinearGradient(0, 0, w * .16, 0);
    light.addColorStop(0, '#b8fff300'); light.addColorStop(.4, '#b8fff311'); light.addColorStop(.6, '#b8fff315'); light.addColorStop(1, '#b8fff300');
    c.fillStyle = light; c.fillRect(0, 0, w * .16, h); c.restore();
  }
  for (let i = 0; i < 11; i++) {
    c.beginPath();
    for (let x = -30; x <= w + 30; x += 18) {
      const y = h * (i / 10) + Math.sin(x / 75 + t * .42 + i * 1.7) * 12 + Math.sin(x / 39 - t * .25 + i) * 4;
      x === -30 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.strokeStyle = '#8ddccd0c'; c.lineWidth = 1.5; c.stroke();
  }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < Math.floor(42 * detail); i++) {
    const x = ((i * 137.37 + Math.sin(t * .3 + i) * 13) % w + w) % w;
    const y = ((i * 79.17 - t * (4 + i % 7)) % h + h) % h;
    disc(c, x, y, i % 5 === 0 ? 1.8 : .8, i % 5 === 0 ? '#b4f6ed66' : '#b4f6ed30');
  }
  // Silhouettes sit behind the navigable world, never over its markers.
  for (let i = 0; i < 16 * detail; i++) {
    const x = (i + .4) / (16 * detail) * w, size = 15 + (i * 31 % 47);
    c.strokeStyle = i % 2 ? '#125459' : '#0a3949'; c.lineWidth = 3; c.lineCap = 'round';
    for (let j = -1; j <= 1; j++) {
      c.beginPath(); c.moveTo(x + j * 5, h + 6); c.bezierCurveTo(x - 8, h - size * .3, x + j * 7 + Math.sin(t * .6 + i) * 9, h - size * .7, x + j * 8 + Math.sin(t * .6 + i) * 7, h - size); c.stroke();
    }
  }
  if (surface) {
    const horizon = h * .16;
    for (let layer = 0; layer < 5; layer++) {
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0);
      for (let x = w; x >= -20; x -= 16) {
        const y = horizon - layer * 13 + Math.sin(x / (95 + layer * 35) + t * (.42 + layer * .08)) * (8 + layer * 2);
        c.lineTo(x, y);
      }
      c.closePath(); c.fillStyle = ['#63c6ca28', '#86e4db28', '#a2f4e33a', '#c1fbe657', '#cceceba0'][layer]; c.fill();
    }
    const sun = c.createRadialGradient(w * .67, 0, 0, w * .67, 0, w * .45);
    sun.addColorStop(0, '#e8fff44d'); sun.addColorStop(1, '#b4fff000'); c.fillStyle = sun; c.fillRect(0, 0, w, h);
  }
  c.restore();
}

export function drawDiver(c, x, y, angle, time, speed = 0, scale = 1) {
  const t = motionPreference.matches ? 0 : time;
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  const kick = Math.sin(t * (speed > .1 ? 13 : 2)) * (speed > .1 ? 3.4 : 1);
  c.fillStyle = '#f2c574'; c.strokeStyle = '#082b40'; c.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    c.save(); c.translate(-9, side * 4); c.rotate(side * .18 + kick * .035 * side);
    c.beginPath(); c.moveTo(0, -2); c.lineTo(-10, -3); c.lineTo(-14, side * 3); c.lineTo(-13, side * 6); c.lineTo(-5, 2); c.lineTo(0, 2); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  c.fillStyle = '#e78b60'; c.beginPath(); c.ellipse(-2, 0, 10, 7, 0, 0, TAU); c.fill();
  c.strokeStyle = '#77d6ce'; c.lineWidth = 3; c.lineCap = 'round';
  for (const side of [-1, 1]) { c.beginPath(); c.moveTo(1, side * 5); c.lineTo(5, side * (9 + kick * .25)); c.lineTo(10, side * 8); c.stroke(); }
  c.fillStyle = '#f4d995'; c.beginPath(); c.roundRect(-11, -3, 13, 6, 3); c.fill(); c.fillStyle = '#657c7b'; c.fillRect(-7, -3, 2, 6);
  disc(c, 8, 0, 6.5, '#132e42');
  c.fillStyle = '#b1fff0'; c.beginPath(); c.ellipse(10, 0, 3.5, 5, 0, 0, TAU); c.fill();
  c.strokeStyle = '#f3e4ba'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = '#ffffffb3'; c.fillRect(10, -3, 1, 3);
  c.restore();
}

// A tileable caustic network: domain-warped Worley cell edges give curved, organic light lines.
// Integer frequencies keep the warp periodic, so the tile repeats without seams.
let caustics = null;
export function causticTile(size = 192) {
  if (caustics) return caustics;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const c = canvas.getContext('2d'), image = c.createImageData(size, size);
  let seed = 11; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const points = Array.from({ length: 13 }, () => [random(), random()]);
  const wrap = d => ((d % 1) + 1.5) % 1 - .5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u0 = x / size, v0 = y / size;
    const u = u0 + .05 * Math.sin(TAU * (2 * v0 + .3)) + .025 * Math.sin(TAU * (3 * u0 + 5 * v0));
    const w = v0 + .05 * Math.sin(TAU * (2 * u0 + .7)) + .025 * Math.sin(TAU * (4 * u0 - 3 * v0));
    let f1 = 9, f2 = 9;
    for (const [px, py] of points) {
      const d = Math.hypot(wrap(u - px), wrap(w - py));
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const e = Math.max(0, 1 - (f2 - f1) / .11), line = e * e * (3 - 2 * e);
    const i = (y * size + x) * 4, v = Math.pow(line, 2.2) * (.55 + .45 * Math.min(1, f1 * 5));
    image.data[i] = 205; image.data[i + 1] = 255; image.data[i + 2] = 238; image.data[i + 3] = v * 235;
  }
  c.putImageData(image, 0, 0);
  return caustics = canvas;
}

// Top-down scuba diver with contact shadow; `lift` scales the shadow offset (0 hides it).
export function drawDiverHD(c, x, y, angle, time, speed = 0, scale = 1, lift = 1) {
  const t = motionPreference.matches ? 0 : time, swim = speed > .1;
  const kick = Math.sin(t * (swim ? 11 : 2.2)), hover = Math.sin(t * 1.4), reach = Math.sin(t * (swim ? 6 : 1.3));
  if (lift) {
    c.save(); c.translate(x + 5 * scale * lift, y + 7 * scale * lift); c.rotate(angle); c.scale(scale, scale);
    const shade = c.createRadialGradient(-6, 0, 2, -6, 0, 24);
    shade.addColorStop(0, `rgba(0,10,20,${.36 - hover * .05})`); shade.addColorStop(1, 'rgba(0,10,20,0)');
    c.fillStyle = shade; c.beginPath(); c.ellipse(-6, 0, 26, 11, 0, 0, TAU); c.fill(); c.restore();
  }
  c.save(); c.translate(x, y); c.rotate(angle); const s = scale * (1 + hover * .025); c.scale(s, s);
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const k = kick * side * (swim ? 1 : .35);
    c.save(); c.translate(-5, side * 3.3); c.rotate(side * .1 + k * .14);
    c.fillStyle = '#10293a'; c.beginPath(); c.roundRect(-10, -2.3, 11, 4.6, 2.3); c.fill();
    c.translate(-10, 0); c.rotate(k * .24);
    const fin = c.createLinearGradient(-15, 0, 0, 0); fin.addColorStop(0, '#ffe27e'); fin.addColorStop(1, '#f39436');
    c.fillStyle = fin; c.beginPath(); c.moveTo(0, -2.2); c.quadraticCurveTo(-7, -5.8, -15, -4.6); c.quadraticCurveTo(-12.8, 0, -15, 4.6); c.quadraticCurveTo(-7, 5.8, 0, 2.2); c.closePath(); c.fill();
    c.strokeStyle = '#a4561c99'; c.lineWidth = .6; c.stroke();
    c.strokeStyle = '#fff4d08c'; c.lineWidth = .5; c.beginPath(); c.moveTo(-2, -1.1); c.lineTo(-12, -2.7); c.moveTo(-2, 1.1); c.lineTo(-12, 2.7); c.stroke();
    c.restore();
  }
  const suit = c.createLinearGradient(0, -7, 0, 7); suit.addColorStop(0, '#2d5d75'); suit.addColorStop(.5, '#173b51'); suit.addColorStop(1, '#0c2433');
  c.fillStyle = suit; c.beginPath(); c.ellipse(1, 0, 9, 6.7, 0, 0, TAU); c.fill();
  c.fillStyle = '#ef7b52'; for (const side of [-1, 1]) { c.beginPath(); c.ellipse(4.6, side * 4.3, 3.6, 2.3, side * .25, 0, TAU); c.fill(); }
  for (const side of [-1, 1]) {
    const r = side * reach * 1.4, arm = new Path2D();
    arm.moveTo(4.6, side * 5); arm.quadraticCurveTo(9, side * (8 + r), 13.6, side * (4.8 + r * .5));
    c.strokeStyle = '#173b51'; c.lineWidth = 3.3; c.stroke(arm); c.strokeStyle = '#62dcc9'; c.lineWidth = .9; c.stroke(arm);
  }
  c.fillStyle = '#d8e4e7'; c.beginPath(); c.roundRect(12.6, 3.3 + reach * .7, 5.2, 2.5, 1); c.fill(); disc(c, 17.9, 4.55 + reach * .7, 1.4, '#fff7c9');
  const tank = c.createLinearGradient(0, -3, 0, 3); tank.addColorStop(0, '#fff2ab'); tank.addColorStop(.45, '#e9c24b'); tank.addColorStop(1, '#a37b1c');
  c.fillStyle = tank; c.beginPath(); c.roundRect(-8.5, -2.9, 12.5, 5.8, 2.9); c.fill();
  c.fillStyle = '#6f8087'; c.fillRect(3.2, -1.4, 2.2, 2.8); c.fillStyle = '#ffffff8a'; c.fillRect(-7, -2, 8.5, .8);
  c.strokeStyle = '#243039'; c.lineWidth = .9; c.beginPath(); c.moveTo(5.2, -1); c.quadraticCurveTo(8.2, -5.2, 11.2, -2.6); c.stroke();
  disc(c, 10.6, 0, 4.8, '#0e2231');
  c.fillStyle = '#a3f5ea'; c.beginPath(); c.ellipse(13.1, 0, 2.1, 3.7, 0, 0, TAU); c.fill(); c.strokeStyle = '#f2e6bd'; c.lineWidth = .9; c.stroke();
  c.fillStyle = '#ffffffd9'; c.beginPath(); c.ellipse(13.6, -1.4, .6, 1.2, 0, 0, TAU); c.fill();
  c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(160,255,235,.2)'; c.lineWidth = 1;
  c.beginPath(); c.ellipse(1, 0, 9, 6.7, 0, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  c.restore();
}

// An expanding wake can also represent pickup and wall-placement feedback.
export function drawRipple(c, x, y, age, color = '#a7f9e6', radius = 28) {
  if (age < 0 || age > 1 || motionPreference.matches) return;
  c.save(); c.globalAlpha = (1 - age) * .65; c.strokeStyle = color; c.lineWidth = 1.4;
  c.beginPath(); c.ellipse(x, y, 3 + age * radius, 2 + age * radius * .65, 0, 0, TAU); c.stroke(); c.restore();
}
