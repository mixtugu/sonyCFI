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
  water.addColorStop(0, '#2457a2'); water.addColorStop(.35, '#103573'); water.addColorStop(1, '#04132f');
  c.fillStyle = water; c.fillRect(0, 0, w, h);
  // Wide, soft shafts and narrow caustic bands refract at different rates.
  c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const x = w * (i * .21 - .16) + Math.sin(t * .19 + i) * w * .035;
    c.save(); c.transform(1, 0, w * .27 / h, 1, x, 0);
    const light = c.createLinearGradient(0, 0, w * .16, 0);
    light.addColorStop(0, '#d6e5ff00'); light.addColorStop(.4, '#d6e5ff11'); light.addColorStop(.6, '#d6e5ff15'); light.addColorStop(1, '#d6e5ff00');
    c.fillStyle = light; c.fillRect(0, 0, w * .16, h); c.restore();
  }
  for (let i = 0; i < 11; i++) {
    c.beginPath();
    for (let x = -30; x <= w + 30; x += 18) {
      const y = h * (i / 10) + Math.sin(x / 75 + t * .42 + i * 1.7) * 12 + Math.sin(x / 39 - t * .25 + i) * 4;
      x === -30 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.strokeStyle = '#a8c8ff0c'; c.lineWidth = 1.5; c.stroke();
  }
  c.globalCompositeOperation = 'source-over';
  for (let i = 0; i < Math.floor(42 * detail); i++) {
    const x = ((i * 137.37 + Math.sin(t * .3 + i) * 13) % w + w) % w;
    const y = ((i * 79.17 - t * (4 + i % 7)) % h + h) % h;
    disc(c, x, y, i % 5 === 0 ? 1.8 : .8, i % 5 === 0 ? '#d0e2ff66' : '#d0e2ff30');
  }
  // Silhouettes sit behind the navigable world, never over its markers.
  for (let i = 0; i < 16 * detail; i++) {
    const x = (i + .4) / (16 * detail) * w, size = 15 + (i * 31 % 47);
    c.strokeStyle = i % 2 ? '#18376b' : '#0b214e'; c.lineWidth = 3; c.lineCap = 'round';
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
      c.closePath(); c.fillStyle = ['#6592df28', '#88b0f328', '#adcaff3a', '#c8dcff57', '#dce8ff9a'][layer]; c.fill();
    }
    const sun = c.createRadialGradient(w * .67, 0, 0, w * .67, 0, w * .45);
    sun.addColorStop(0, '#edf4ff4d'); sun.addColorStop(1, '#b4d0ff00'); c.fillStyle = sun; c.fillRect(0, 0, w, h);
  }
  c.restore();
}

export function drawDiver(c, x, y, angle, time, speed = 0, scale = 1) {
  const t = motionPreference.matches ? 0 : time;
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale); c.globalAlpha = .84;
  const swimming = speed > .1, kick = Math.sin(t * (swimming ? 6.5 : 1.4)) * (swimming ? 1.8 : .45);
  c.strokeStyle = 'rgba(35,81,105,.42)'; c.lineWidth = .9; c.lineJoin = 'round'; c.lineCap = 'round';
  const shadow = c.createRadialGradient(-2, 4, 1, -2, 4, 19);
  shadow.addColorStop(0, 'rgba(14,48,63,.16)'); shadow.addColorStop(1, 'rgba(14,48,63,0)');
  c.fillStyle = shadow; c.beginPath(); c.ellipse(-2, 4, 19, 8, 0, 0, TAU); c.fill();
  for (const side of [-1, 1]) {
    c.save(); c.translate(-8, side * 3.6); c.rotate(side * .08 + kick * .02 * side);
    c.strokeStyle = 'rgba(35,81,105,.42)'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(3, -side); c.lineTo(-1, 0); c.stroke();
    c.strokeStyle = 'rgba(237,198,126,.68)'; c.lineWidth = 2.1; c.stroke();
    c.fillStyle = '#587684'; c.beginPath(); c.roundRect(-2.2, -2.2, 5.6, 4.4, 2); c.fill(); c.strokeStyle = 'rgba(35,81,105,.36)'; c.lineWidth = .6; c.stroke();
    const fin = c.createLinearGradient(-13, -2, -1, 2); fin.addColorStop(0, '#294456'); fin.addColorStop(.55, '#49697b'); fin.addColorStop(1, '#8da8ad');
    c.fillStyle = fin; c.beginPath(); c.moveTo(-1, -2); c.quadraticCurveTo(-7, -3.6, -12.5, -3); c.quadraticCurveTo(-15, 0, -12.5, 3); c.quadraticCurveTo(-7, 3.6, -1, 2); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(35,81,105,.36)'; c.lineWidth = .5; c.stroke();
    c.strokeStyle = 'rgba(188,219,220,.5)'; c.lineWidth = .4; c.beginPath(); c.moveTo(-3, -.8); c.lineTo(-11, -1.35); c.moveTo(-3, .8); c.lineTo(-11, 1.35); c.stroke(); c.restore();
  }
  c.save(); c.translate(-10, 0); c.rotate(.42);
  const pack = c.createLinearGradient(-3.5, 0, 3.5, 0); pack.addColorStop(0, '#304a5c'); pack.addColorStop(.22, '#617d8b'); pack.addColorStop(.48, '#c0d1cc'); pack.addColorStop(.7, '#8ba6a8'); pack.addColorStop(1, '#3a5a68');
  c.fillStyle = pack; c.beginPath(); c.roundRect(-3.5, -7, 7, 14, 3.5); c.fill(); c.strokeStyle = 'rgba(35,81,105,.4)'; c.lineWidth = .7; c.stroke();
  c.fillStyle = 'rgba(53,83,101,.6)'; c.beginPath(); c.roundRect(-3.3, -6.5, 6.6, 2.1, 1); c.fill(); c.beginPath(); c.roundRect(-3.3, 4.5, 6.6, 2.1, 1); c.fill();
  c.fillStyle = '#e3c77f'; c.fillRect(-3.4, -2.6, 6.8, 1.1); c.fillRect(-3.4, 2.1, 6.8, 1.1);
  c.fillStyle = '#d3e0df'; c.beginPath(); c.roundRect(-2.1, -8.2, 4.2, 2.2, 1); c.fill(); c.strokeStyle = 'rgba(35,81,105,.48)'; c.lineWidth = .6; c.stroke();
  c.restore();
  const suit = c.createRadialGradient(-4, -5, 1, 1, 1, 13); suit.addColorStop(0, '#fff5d9'); suit.addColorStop(.38, '#f8dca6'); suit.addColorStop(.76, '#e7bd83'); suit.addColorStop(1, '#bd8662');
  c.fillStyle = suit; c.beginPath(); c.ellipse(-1, 0, 9.3, 6.9, -.12, 0, TAU); c.fill(); c.strokeStyle = 'rgba(129,91,62,.36)'; c.lineWidth = .7; c.stroke();
  for (const side of [-1, 1]) {
    const arm = new Path2D(); arm.moveTo(1.5, side * 3.5); arm.quadraticCurveTo(3.5, side * (5.8 + kick * .1), 5.2, side * 7.1);
    c.strokeStyle = 'rgba(58,87,94,.42)'; c.lineWidth = 3.6; c.stroke(arm); c.strokeStyle = 'rgba(246,211,150,.78)'; c.lineWidth = 2.4; c.stroke(arm);
    c.fillStyle = '#536973'; c.beginPath(); c.arc(5.3, side * 7.1, 2.1, 0, TAU); c.fill();
  }
  c.strokeStyle = 'rgba(35,81,105,.42)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-8, -4.3); c.quadraticCurveTo(-3, -7.5, 2.5, -5.1); c.stroke();
  c.strokeStyle = 'rgba(194,148,94,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, -2.5); c.quadraticCurveTo(-2, 0, 2.7, 3.7); c.stroke();
  c.strokeStyle = 'rgba(35,81,105,.5)'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(-7, -5); c.bezierCurveTo(-4, -11, 1, -10, 4, -7); c.stroke();
  c.strokeStyle = 'rgba(169,202,204,.62)'; c.lineWidth = .55; c.beginPath(); c.moveTo(-6.5, -5.2); c.bezierCurveTo(-3.7, -9.7, .4, -9.2, 3.6, -6.8); c.stroke();
  const helmet = c.createRadialGradient(3.5, -5.2, .5, 7, 0, 10); helmet.addColorStop(0, '#fff4b7'); helmet.addColorStop(.32, '#ffe18a'); helmet.addColorStop(.7, '#f0b947'); helmet.addColorStop(1, '#a96332');
  c.fillStyle = helmet; c.beginPath(); c.arc(7, 0, 7.8, 0, TAU); c.fill(); c.strokeStyle = 'rgba(123,91,55,.42)'; c.lineWidth = .75; c.stroke();
  c.fillStyle = 'rgba(255,249,221,.48)'; c.beginPath(); c.ellipse(4.3, -5.2, 2.2, .8, -.35, 0, TAU); c.fill();
  c.fillStyle = 'rgba(75,112,128,.7)'; c.beginPath(); c.ellipse(10.1, 0, 4.6, 4.2, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(225,195,126,.62)'; c.lineWidth = .8; c.stroke();
  const glass = c.createRadialGradient(9.2, -1.5, .4, 10.1, 0, 4.4); glass.addColorStop(0, '#77d5d9'); glass.addColorStop(.18, '#286479'); glass.addColorStop(.55, '#14283f'); glass.addColorStop(1, '#071323');
  c.fillStyle = glass; c.beginPath(); c.ellipse(10.1, 0, 3.9, 3.1, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(108,201,207,.62)'; c.lineWidth = .6; c.stroke();
  c.fillStyle = 'rgba(233,255,251,.72)'; c.beginPath(); c.ellipse(9.5, -1.2, .9, 1, -.25, 0, TAU); c.fill();
  c.fillStyle = 'rgba(75,107,119,.82)'; c.beginPath(); c.arc(3.2, -4.6, 2, 0, TAU); c.fill(); c.strokeStyle = 'rgba(216,191,120,.68)'; c.lineWidth = .6; c.stroke();
  c.fillStyle = '#fff0a0'; c.beginPath(); c.arc(14, 0, 1.3, 0, TAU); c.fill();
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
    shade.addColorStop(0, `rgba(14,48,63,${.24 - hover * .03})`); shade.addColorStop(1, 'rgba(14,48,63,0)');
    c.fillStyle = shade; c.beginPath(); c.ellipse(-6, 0, 26, 11, 0, 0, TAU); c.fill(); c.restore();
  }
  c.save(); c.translate(x, y); c.rotate(angle); const s = scale * (1 + hover * .025); c.scale(s, s); c.globalAlpha = .84;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const suit = c.createLinearGradient(0, -7.5, 0, 7.5); suit.addColorStop(0, '#fff2cd'); suit.addColorStop(.44, '#f0d3a1'); suit.addColorStop(1, '#c9946c');
  c.fillStyle = suit; c.beginPath(); c.ellipse(1, 0, 9.7, 7.3, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(35,81,105,.42)'; c.lineWidth = .7; c.stroke();
  c.fillStyle = '#d6a271'; for (const side of [-1, 1]) { c.beginPath(); c.ellipse(4.6, side * 4.5, 3.6, 2.4, side * .25, 0, TAU); c.fill(); }
  for (const side of [-1, 1]) {
    const r = side * reach * 1.4, arm = new Path2D();
    arm.moveTo(4.6, side * 5); arm.quadraticCurveTo(9, side * (8 + r), 13.6, side * (4.8 + r * .5));
    c.strokeStyle = 'rgba(35,81,105,.42)'; c.lineWidth = 3.8; c.stroke(arm); c.strokeStyle = 'rgba(241,207,148,.78)'; c.lineWidth = 2.6; c.stroke(arm);
    disc(c, 13.6, side * (4.8 + r * .5), 1.9, '#536a73');
  }
  c.fillStyle = '#486271'; c.beginPath(); c.roundRect(12.6, 3.3 + reach * .7, 5.2, 2.5, 1); c.fill(); disc(c, 17.9, 4.55 + reach * .7, 1.4, '#fff2c6');
  const tank = c.createLinearGradient(-13, 0, -2, 0); tank.addColorStop(0, '#344f63'); tank.addColorStop(.22, '#7898a4'); tank.addColorStop(.46, '#d1dfd9'); tank.addColorStop(.7, '#91afb0'); tank.addColorStop(1, '#426576');
  c.fillStyle = tank; c.beginPath(); c.roundRect(-12.5, -3.8, 9.5, 7.6, 3.8); c.fill(); c.strokeStyle = 'rgba(35,81,105,.4)'; c.lineWidth = .7; c.stroke();
  c.fillStyle = '#ddc286'; c.fillRect(-10.2, -3.2, 1.35, 6.4); c.fillRect(-5.7, -3.2, 1.2, 6.4);
  c.fillStyle = '#486775'; c.beginPath(); c.roundRect(-13.2, -2, 2, 4, 1); c.fill();
  c.fillStyle = '#b9ccca'; c.beginPath(); c.roundRect(-3.6, -2.1, 2.6, 4.2, 1); c.fill(); c.strokeStyle = 'rgba(35,81,105,.5)'; c.lineWidth = .5; c.stroke();
  c.strokeStyle = 'rgba(35,81,105,.44)'; c.lineWidth = 1.25; c.beginPath(); c.moveTo(-2.8, -2.5); c.quadraticCurveTo(1, -7, 6, -5); c.lineTo(8, -3.5); c.stroke();
  for (const side of [-1, 1]) {
    const k = kick * side * (swim ? 1 : .35);
    c.save(); c.translate(-9, side * 3.8); c.rotate(side * .04 + k * .1);
    c.strokeStyle = 'rgba(218,176,111,.78)'; c.lineWidth = 3; c.beginPath(); c.moveTo(4, -side * 1.1); c.lineTo(0, 0); c.stroke();
    c.fillStyle = '#4a6572'; c.beginPath(); c.roundRect(-1.8, -1.7, 4.4, 3.4, 1.5); c.fill();
    const fin = c.createLinearGradient(-8, 0, -1, 0); fin.addColorStop(0, '#294456'); fin.addColorStop(.7, '#496b7b'); fin.addColorStop(1, '#829fa7');
    c.fillStyle = fin; c.beginPath(); c.moveTo(-1, -1.4); c.quadraticCurveTo(-4, -2.8, -6.2, -2.1); c.quadraticCurveTo(-8.5, 0, -6.2, 2.1); c.quadraticCurveTo(-4, 2.8, -1, 1.4); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(35,81,105,.36)'; c.lineWidth = .45; c.stroke();
    c.strokeStyle = 'rgba(188,219,220,.5)'; c.lineWidth = .35; c.beginPath(); c.moveTo(-2.2, -.5); c.lineTo(-6.8, -.85); c.moveTo(-2.2, .5); c.lineTo(-6.8, .85); c.stroke(); c.restore();
  }
  const helmet = c.createRadialGradient(7, -6, 1, 10, 0, 10); helmet.addColorStop(0, '#fff5d7'); helmet.addColorStop(.45, '#f2dc9e'); helmet.addColorStop(1, '#c99358');
  c.fillStyle = helmet; c.beginPath(); c.arc(10, 0, 7.3, 0, TAU); c.fill(); c.strokeStyle = 'rgba(123,91,55,.42)'; c.lineWidth = .75; c.stroke();
  c.strokeStyle = 'rgba(239,216,166,.6)'; c.lineWidth = .6; c.beginPath(); c.arc(10, 0, 6.2, -.88, .88); c.stroke();
  const visor = c.createLinearGradient(11, -4, 16, 4); visor.addColorStop(0, '#78b6b9'); visor.addColorStop(.46, '#456f7c'); visor.addColorStop(1, '#25495e');
  c.fillStyle = visor; c.beginPath(); c.ellipse(13.1, 0, 3.25, 4.8, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(13.1, -4.8); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(108,201,207,.62)'; c.lineWidth = .6; c.stroke();
  c.fillStyle = 'rgba(233,255,251,.72)'; c.beginPath(); c.ellipse(13.1, -2, .75, 1.35, -.35, 0, TAU); c.fill();
  c.fillStyle = '#fff0a0'; c.beginPath(); c.arc(17, 0, 1.5, 0, TAU); c.fill();
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
