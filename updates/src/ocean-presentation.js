import './ocean.css';
import oceanTitle from './ocean-title.svg';
import { drawWater, drawDiverHD, drawRipple, motionPreference, causticTile } from './ocean-art.js';
import { createDepths } from './ocean-depths.js';
import { drawFish, drawJelly } from './maze-renderer.js';

// Camera targets per in-game phase: depth 0 is the surface, 1 the deep; surface 1 lifts the camera out.
const SCENES = { ready: { depth: .34 }, countdown: { depth: .7 }, playing: { depth: .8 }, result: { depth: .02 }, summary: { depth: .02 }, ending: { depth: 0, surface: 1 } };

// A single bounded ambient canvas follows the whole journey; gameplay never waits for it.
// The lobby keeps the 2D sea; from the briefing on, a WebGL ocean takes over where available.
export function createOceanPresentation() {
  document.body.classList.add('ocean-world');
  try { document.documentElement.style.setProperty('--caustics', `url(${causticTile().toDataURL()})`); } catch { /* CSS falls back to plain glass. */ }
  const canvas = document.createElement('canvas');
  canvas.className = 'ocean-backdrop'; canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const c = canvas.getContext('2d');
  const depthCanvas = document.createElement('canvas');
  depthCanvas.className = 'ocean-depths'; depthCanvas.setAttribute('aria-hidden', 'true');
  canvas.after(depthCanvas);
  const lifeCanvas = document.createElement('canvas');
  lifeCanvas.className = 'ocean-life'; lifeCanvas.setAttribute('aria-hidden', 'true');
  depthCanvas.after(lifeCanvas);
  const life = lifeCanvas.getContext('2d');
  let depths = null;
  try { depths = createDepths(depthCanvas); } catch { depths = null; }
  if (!depths) depthCanvas.remove();
  const intro = document.createElement('div');
  intro.className = 'ocean-intro';
  intro.innerHTML = `<div class="ocean-intro-copy"><span class="ocean-kicker">BETWEEN TIDES</span><h1 class="ocean-wordmark"><img src="${oceanTitle}" alt="YOU SEE / I SEE"></h1><p>光をたどって、まだ知らない海へ。</p><span class="dive-line" aria-hidden="true"></span><small>海へ、潜ろう。</small></div><button type="button" class="ocean-skip">スキップ ↘</button>`;
  let dismissed = motionPreference.matches;
  const close = () => { dismissed = true; intro.remove(); document.body.classList.remove('ocean-entering'); };
  if (!dismissed) {
    document.body.classList.add('ocean-entering'); document.body.append(intro);
    intro.querySelector('button').onclick = close;
  }
  const started = performance.now();
  let phase = 'lobby', phaseAt = started, lastDraw = 0, lastTick = started, w = 0, h = 0, pointer = { x: .5, y: .5 }, drift = { x: .5, y: .5 };
  let oxygen = 1, shownAt = 0, hiddenAt = -1e9, frozenDrawn = false, quality = .55, pace = 1 / 30;
  const sim = { clock: 0, depth: SCENES.ready.depth, surface: 0, danger: 0, scroll: 0, bubble: 0, kick: 0, pulseAt: -99, ripple: null };
  const ripples = [];
  const inGame = () => !!depths && dismissed && phase !== 'lobby';
  const onPointer = event => { pointer = { x: event.clientX / innerWidth, y: event.clientY / innerHeight }; };
  const onDown = event => {
    if (motionPreference.matches) return;
    ripples.push({ x: event.clientX / innerWidth, y: event.clientY / innerHeight, at: performance.now() }); if (ripples.length > 8) ripples.shift();
    if (inGame() && phase !== 'paused') sim.ripple = { x: (event.clientX / innerWidth - .5) * innerWidth / innerHeight, y: .5 - event.clientY / innerHeight, at: sim.clock };
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  const onKey = event => { if (event.key === 'Escape') close(); };
  window.addEventListener('keydown', onKey);

  function drawFlat(now) {
    if (w !== innerWidth || h !== innerHeight) {
      w = innerWidth; h = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const frozen = phase === 'paused';
    const time = motionPreference.matches ? 0 : (frozen ? phaseAt : now) / 1000;
    c.save();
    const dive = dismissed ? 1 : Math.min(1, Math.max(0, (now - started - 400) / 2000));
    const offset = motionPreference.matches ? 0 : (drift.x - .5) * 15;
    const ascent = ['result', 'summary', 'ending'].includes(phase) ? (motionPreference.matches ? 1 : Math.min(1, (now - phaseAt) / 2200)) : 0;
    c.translate(offset - 20, -dive * h * .14 + ascent * h * .08);
    drawWater(c, w + 40, h * 1.2, time, { surface: true, detail: w < 600 ? .7 : 1.7 });
    if (!dismissed || phase === 'lobby' || ascent) {
      const mobile = w < 600, swimRate = .48, swimTime = motionPreference.matches ? -Math.PI / 2 : (now - started) / 1000 * swimRate - Math.PI / 2;
      const introTrack = !dismissed, centerX = introTrack ? w * .5 : w * (mobile ? .82 : .42);
      const radiusX = w * (introTrack ? mobile ? .18 : .3 : mobile ? .055 : .05);
      const centerY = h * (introTrack ? mobile ? .075 : .16 : mobile ? .085 : .18);
      const radiusY = h * (introTrack ? mobile ? .025 : .06 : mobile ? .025 : .075);
      const dx = centerX + Math.cos(swimTime) * radiusX;
      const dy = centerY + Math.sin(swimTime) * radiusY + dive * h * .14;
      const angle = ascent ? -.65 : phase === 'lobby'
        ? Math.atan2(Math.cos(swimTime) * radiusY * swimRate, -Math.sin(swimTime) * radiusX * swimRate)
        : .8;
      const diverX = ascent ? w * .28 : dx, diverY = ascent ? h * (.88 - ascent * .18) : dy;
      drawDiverHD(c, diverX + Math.sin(time * .3) * (mobile ? 6 : 15), diverY + Math.sin(time * .7) * (mobile ? 3 : 6), angle, time, .1, mobile ? 2.2 : 3.3, 0);
      for (let i = 0; i < 12; i++) {
        const age = (time * .3 + i / 12) % 1;
        c.beginPath(); c.arc(diverX - Math.cos(angle) * age * 100 + Math.sin(i + time) * 8, diverY - Math.sin(angle) * age * 100 + Math.cos(i + time) * 5, 1 + age * 4, 0, Math.PI * 2); c.strokeStyle = `rgba(186,246,240,${(1 - age) * .35})`; c.lineWidth = 1; c.stroke();
      }
    }
    c.restore();
    for (const ripple of ripples) drawRipple(c, ripple.x * w, ripple.y * h, (now - ripple.at) / 1000, '#bcfff2', 65);
    while (ripples.length && now - ripples[0].at > 1000) ripples.shift();
    const transition = (now - phaseAt) / 1400;
    if (phase === 'playing' && transition < 1 && !motionPreference.matches) {
      // Transparent descent bubbles leave the timer and controls readable.
      for (let i = 0; i < 18; i++) drawRipple(c, (i * .137 % 1) * w, h * (1.2 - transition * 1.5) + i % 4 * 30, transition, '#d7fff3', 30 + i % 3 * 18);
    }
  }

  function drawDeep(dtReal) {
    const reduced = motionPreference.matches, frozen = phase === 'paused';
    if (frozen && frozenDrawn) return;
    frozenDrawn = frozen;
    const dt = frozen || reduced ? 0 : dtReal;
    sim.clock += dt;
    // Slow devices drop the shader's resolution rather than the frame rate.
    if (dt) { pace += (dtReal - pace) * .1; if (pace > .05 && quality > .25) { quality *= .85; pace = 1 / 30; } }
    const scene = SCENES[phase] || SCENES.ready;
    const ease = tau => reduced ? 1 : 1 - Math.exp(-dt / tau);
    const before = sim.depth;
    // Oxygen running low takes the diver deeper into darker water.
    const goal = phase === 'playing' ? scene.depth + (1 - oxygen) * .12 : scene.depth;
    sim.depth += (goal - sim.depth) * ease(['result', 'summary'].includes(phase) ? .85 : 1.25);
    sim.surface += ((scene.surface || 0) - sim.surface) * ease(scene.surface ? 1.1 : .45);
    sim.danger += ((phase === 'playing' ? Math.max(0, Math.min(1, (.3 - oxygen) / .3)) : 0) - sim.danger) * ease(.5);
    sim.scroll += (sim.depth - before) * 16;
    sim.kick *= reduced ? 0 : Math.exp(-dt * 1.2);
    const rush = Math.min(1.4, Math.abs(sim.depth - before) / Math.max(dt, 1e-3) * 1.6 + sim.kick);
    sim.bubble += dt * (1.1 + rush * 4);
    const age = sim.clock - sim.pulseAt, rippleAge = sim.ripple ? sim.clock - sim.ripple.at : 9;
    depths.render({
      width: innerWidth, height: innerHeight, scale: Math.min(devicePixelRatio || 1, 1.5) * quality,
      time: sim.clock % 1000 + 7, depth: sim.depth, surface: sim.surface, danger: sim.danger, scroll: sim.scroll, bubble: sim.bubble, rush,
      pointer: reduced ? [0, 0] : [drift.x - .5, .5 - drift.y],
      pulse: [0, 0, reduced ? 0 : Math.max(0, 1 - age / 1.5)], pulseR: age * .85,
      ripple: sim.ripple && !reduced ? [sim.ripple.x, sim.ripple.y, Math.max(0, 1 - rippleAge / 1.2), rippleAge * .7] : [0, 0, 0, 0],
    });
  }

  function drawLife(now) {
    const scale = Math.min(devicePixelRatio || 1, 1.5), width = innerWidth, height = innerHeight;
    const pixelWidth = Math.round(width * scale), pixelHeight = Math.round(height * scale);
    if (lifeCanvas.width !== pixelWidth || lifeCanvas.height !== pixelHeight) { lifeCanvas.width = pixelWidth; lifeCanvas.height = pixelHeight; }
    life.setTransform(scale, 0, 0, scale, 0, 0); life.globalCompositeOperation = 'source-over'; life.globalAlpha = 1;
    life.clearRect(0, 0, width, height);
    const time = motionPreference.matches ? 0 : (phase === 'paused' ? phaseAt : now) / 1000;
    drawFish(life, width, height, time); drawJelly(life, width, height, time);
    life.globalCompositeOperation = 'destination-out';
    for (const board of document.querySelectorAll('.board-card:not([hidden])')) {
      const rect = board.getBoundingClientRect();
      if (rect.width && rect.height) life.fillRect(rect.left - 8, rect.top - 8, rect.width + 16, rect.height + 16);
    }
    life.globalCompositeOperation = 'source-over';
  }

  let raf;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || now - lastDraw < (motionPreference.matches ? 250 : 33)) return;
    const dtReal = Math.min(.1, (now - lastTick) / 1000);
    lastDraw = lastTick = now;
    if (!dismissed && (now - started > 3200 || motionPreference.matches)) close();
    if (phase !== 'paused') { drift.x += (pointer.x - drift.x) * .025; drift.y += (pointer.y - drift.y) * .025; }
    const deep = inGame();
    if (deep && !shownAt) shownAt = now;
    if (!deep && shownAt) { shownAt = 0; hiddenAt = now; }
    depthCanvas.classList.toggle('is-visible', deep);
    // The flat sea stops painting once the WebGL ocean fully covers it.
    if (!deep || now - shownAt < 1300) drawFlat(now);
    if (depths && (deep || now - hiddenAt < 1300)) drawDeep(dtReal);
    drawLife(now);
  }
  raf = requestAnimationFrame(frame);
  return {
    setPhase(next) {
      const mapped = { ready: 'ready', waiting: 'ready', countdown: 'countdown', review: 'result' }[next] || next;
      if (mapped === phase) return;
      const previous = phase;
      phase = mapped; phaseAt = performance.now(); document.body.dataset.oceanPhase = phase; frozenDrawn = false;
      if (phase === 'playing') close();
      if (phase === 'paused') ripples.length = 0;
      if (phase === 'playing' && ['ready', 'countdown'].includes(previous)) { sim.kick = 1; sim.pulseAt = sim.clock; }
      if (['result', 'summary'].includes(phase)) sim.kick = .8;
      if (phase === 'ending') { sim.kick = .6; sim.ripple = null; }
    },
    pulse() { if (phase !== 'paused') sim.pulseAt = sim.clock; },
    setOxygen(value) { oxygen = Math.max(0, Math.min(1, +value || 0)); },
    destroy() { cancelAnimationFrame(raf); close(); canvas.remove(); depthCanvas.remove(); lifeCanvas.remove(); window.removeEventListener('pointermove', onPointer); window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); }
  };
}
