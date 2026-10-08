import { drawDiverHD, disc, motionPreference, causticTile } from './ocean-art.js';
import { OCEAN } from './ocean-palette.js';

const TAU = Math.PI * 2;
// The report header: the diver rises toward a sunlit, rippling surface.
export function createResultScene(canvas) {
  const c = canvas.getContext('2d');
  let raf = 0, start = 0, pattern = null;
  function draw(now) {
    raf = 0;
    const w = canvas.clientWidth || 480, h = canvas.clientHeight || 180, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const still = motionPreference.matches, t = still ? 4 : (now - start) / 1000;
    const water = c.createLinearGradient(0, 0, 0, h);
    water.addColorStop(0, OCEAN.light); water.addColorStop(.2, OCEAN.surface); water.addColorStop(.62, OCEAN.base); water.addColorStop(1, OCEAN.deep);
    c.fillStyle = water; c.fillRect(0, 0, w, h);
    const sun = c.createRadialGradient(w * .68, -10, 0, w * .68, -10, h * 1.1);
    sun.addColorStop(0, 'rgba(255,248,220,.6)'); sun.addColorStop(1, 'rgba(255,248,220,0)'); c.fillStyle = sun; c.fillRect(0, 0, w, h);
    pattern ||= c.createPattern(causticTile(), 'repeat');
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .16; c.translate((t * 9) % 160, (t * 4) % 160); c.fillStyle = pattern; c.fillRect(-160, -160, w + 320, h + 320); c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = w * (i / 6) + Math.sin(t * .4 + i * 1.3) * 18;
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(220,255,245,${.12 + .05 * Math.sin(t + i)})`); g.addColorStop(1, 'rgba(220,255,245,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 8, 0); c.lineTo(x + 10, 0); c.lineTo(x + 40, h); c.lineTo(x + 6, h); c.closePath(); c.fill();
    }
    c.restore();
    // The surface from below: a bright, moving band with a meniscus line.
    const wave = x => 20 + Math.sin(x / 38 + t * 1.6) * 3 + Math.sin(x / 17 - t * 2.3) * 1.4;
    c.beginPath(); c.moveTo(0, 0); for (let x = 0; x <= w + 8; x += 8) c.lineTo(x, wave(x)); c.lineTo(w, 0); c.closePath();
    const band = c.createLinearGradient(0, 0, 0, 26); band.addColorStop(0, '#f4fff9'); band.addColorStop(1, '#9fe6dd'); c.fillStyle = band; c.fill();
    c.beginPath(); for (let x = 0; x <= w + 8; x += 8) x ? c.lineTo(x, wave(x)) : c.moveTo(x, wave(x));
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.5; c.stroke();
    for (let i = 0; i < 28; i++) {
      const speed = .5 + (i * 37 % 10) / 10, x = (i * 53.7) % w + Math.sin(t * 2 + i) * 4;
      const y = h + 12 - ((t * speed * 36 + i * 29) % (h + 20));
      if (y < 24) continue;
      c.strokeStyle = 'rgba(225,255,250,.55)'; c.lineWidth = .8; c.beginPath(); c.arc(x, y, 1 + i % 4, 0, TAU); c.stroke();
    }
    const rise = still ? 1 : 1 - (1 - Math.min(1, t / 2.4)) ** 3;
    const dx = w * .5 + Math.sin(t * .9) * 10, dy = h + 40 - rise * (h * .42 + 40) + Math.sin(t * 1.4) * 2 * rise;
    for (let i = 0; i < 7; i++) {
      const age = (t * .8 + i / 7) % 1, y = dy - 16 - age * (dy - 26);
      if (y > 24) { c.strokeStyle = `rgba(230,255,250,${(1 - age) * .8})`; c.lineWidth = .9; c.beginPath(); c.arc(dx + Math.sin(age * 8 + i) * 4, y, 1.2 + age * 2.5, 0, TAU); c.stroke(); }
    }
    drawDiverHD(c, dx, dy, -Math.PI / 2 + Math.sin(t * 1.3) * .12, t, rise < 1 ? 1 : .2, 1.3, 0);
    for (let i = 0; i < 9; i++) {
      const tw = Math.max(0, Math.sin(t * 2.2 + i * 1.9)) ** 8, x = (i * 97.3) % w, y = 24 + (i * 13) % 20;
      if (tw > .05) disc(c, x, y, 1 + tw * 1.8, `rgba(255,255,240,${tw})`);
    }
    if (!still && canvas.isConnected) raf = requestAnimationFrame(draw);
  }
  return {
    play() { cancelAnimationFrame(raf); start = performance.now(); raf = requestAnimationFrame(draw); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}
