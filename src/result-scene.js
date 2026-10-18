import { drawDiverHD, disc, motionPreference, causticTile } from './ocean-art.js';
import { resultCondition } from './result-condition.js';
import { removeLightVideoBackground } from './creature-video-matte.js';
import healthyEndingVideo from './assets/explorer-healthy-ending.mp4';
import hurtEndingVideo from './assets/explorer-hurt-ending.mp4';
import steadyEndingVideo from './assets/explorer-steady-ending.mp4';

const TAU = Math.PI * 2;

// The report header: the diver rises toward a sunlit, rippling surface.
export function createResultScene(canvas) {
  const c = canvas.getContext('2d');
  let raf = 0, start = 0, pattern = null, condition = 'steady';
  function draw(now) {
    raf = 0;
    const w = canvas.clientWidth || 480, h = canvas.clientHeight || 180, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const still = motionPreference.matches, t = still ? 4 : (now - start) / 1000;
    const water = c.createLinearGradient(0, 0, 0, h);
    water.addColorStop(0, '#86ded8'); water.addColorStop(.2, '#3eaab4'); water.addColorStop(.62, '#15607a'); water.addColorStop(1, '#0c3b51');
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
    const riseDuration = condition === 'healthy' ? 1.8 : condition === 'hurt' ? 2.8 : 2.4;
    const rise = still ? 1 : 1 - (1 - Math.min(1, t / riseDuration)) ** 3;
    const swimTime = Math.max(0, t - riseDuration), swimBlend = condition === 'healthy' ? still ? 1 : Math.min(1, swimTime / .55) : 0;
    const swimPhase = swimTime * .65, surfaceY = condition === 'hurt' ? 32 : 28;
    let dx = w * .5, dy = h + 40 - rise * (h + 40 - surfaceY), angle = -Math.PI / 2, speed = rise < 1 ? .8 : .25, kickPhase;
    if (condition === 'healthy') {
      const swimAngle = Math.atan2(Math.cos(swimTime * 2.4) * 5, Math.cos(swimPhase) * w * .34 * .65);
      dx += Math.sin(swimPhase) * w * .34 * swimBlend;
      dy += Math.sin(swimTime * 2.4) * 2.5 * swimBlend;
      angle = -Math.PI / 2 * (1 - swimBlend) + swimAngle * swimBlend;
      speed = 1.1;
    } else if (condition === 'hurt') {
      dx += Math.sin(t * .4) * 3;
      dy += Math.sin(t * 1.2) * 2 * rise;
      angle *= 1 - rise;
      speed = rise < 1 ? .35 : 0;
      kickPhase = rise < 1 ? undefined : 0;
    } else {
      dx += Math.sin(t * .55) * 4;
      dy += Math.sin(t * .9) * 2 * rise;
      angle += .12 + Math.sin(t * .8) * .05;
      speed = rise < 1 ? .65 : .3;
    }
    if (condition !== 'healthy') {
      const glow = condition === 'hurt' ? .2 : .08;
      const damage = c.createRadialGradient(dx, dy + 7, 2, dx, dy + 7, 34);
      damage.addColorStop(0, `rgba(255,115,91,${glow})`); damage.addColorStop(1, 'rgba(255,115,91,0)');
      c.fillStyle = damage; c.fillRect(dx - 34, dy - 27, 68, 68);
    }
    const bubbleCount = condition === 'hurt' ? 3 : 7;
    for (let i = 0; i < bubbleCount; i++) {
      const age = (t * .8 + i / bubbleCount) % 1, y = dy - 16 - age * (dy - 26);
      if (y > 24) { c.strokeStyle = `rgba(230,255,250,${(1 - age) * .8})`; c.lineWidth = .9; c.beginPath(); c.arc(dx + Math.sin(age * 8 + i) * 4, y, 1.2 + age * 2.5, 0, TAU); c.stroke(); }
    }
    drawDiverHD(c, dx, dy, angle, t, speed, 1.3, 0, kickPhase);
    for (let i = 0; i < 9; i++) {
      const tw = Math.max(0, Math.sin(t * 2.2 + i * 1.9)) ** 8, x = (i * 97.3) % w, y = 24 + (i * 13) % 20;
      if (tw > .05) disc(c, x, y, 1 + tw * 1.8, `rgba(255,255,240,${tw})`);
    }
    if (!still && canvas.isConnected) raf = requestAnimationFrame(draw);
  }
  return {
    play(hp, maxHp) { cancelAnimationFrame(raf); condition = resultCondition(hp, maxHp); start = performance.now(); raf = requestAnimationFrame(draw); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}

export function createEndingExplorerScene(canvas) {
  const c = canvas.getContext('2d');
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = 320; frameCanvas.height = 180;
  const frameContext = frameCanvas.getContext('2d', { willReadFrequently: true });
  let raf = 0, start = 0, video = null, lastVideoTime = -1, lastDraw = -Infinity, condition = 'steady';
  function stop() {
    cancelAnimationFrame(raf); raf = 0;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video = null;
    }
  }
  function draw(now) {
    raf = 0;
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const t = motionPreference.matches ? 0 : (now - start) / 1000;
    if (video) {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (video.currentTime !== lastVideoTime && now - lastDraw >= 1000 / 30 - 1) {
          lastDraw = now; lastVideoTime = video.currentTime;
          frameContext.clearRect(0, 0, 320, 180);
          frameContext.drawImage(video, 0, 0, 320, 180);
          const pixels = frameContext.getImageData(0, 0, 320, 180);
          removeLightVideoBackground(pixels.data, condition === 'hurt' ? 195 : 210);
          frameContext.putImageData(pixels, 0, 0);
        }
        const riseDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3.6;
        const rise = motionPreference.matches ? 1 : 1 - (1 - Math.min(1, t / riseDuration)) ** 3;
        const swimTime = Math.max(0, t - riseDuration);
        const videoX = w * .5 + Math.sin(swimTime * .35) * w * .025;
        const videoY = h + 117 - rise * (h + 117 - h * .58);
        c.drawImage(frameCanvas, videoX - 208, videoY - 117 + Math.sin(swimTime * 1.1) * 7, 416, 234);
      }
    }
    if (!motionPreference.matches && canvas.isConnected) raf = requestAnimationFrame(draw);
  }
  return {
    play(hp, maxHp) {
      stop();
      lastVideoTime = -1; lastDraw = -Infinity;
      frameContext.clearRect(0, 0, 320, 180);
      start = performance.now();
      condition = resultCondition(hp, maxHp);
      const playback = document.createElement('video');
      video = playback;
      playback.muted = true; playback.playsInline = true;
      playback.src = { hurt: hurtEndingVideo, steady: steadyEndingVideo, healthy: healthyEndingVideo }[condition];
      playback.addEventListener('error', () => {
        if (video === playback) console.error(`${condition} ending explorer video failed to load.`, playback.error);
      });
      if (motionPreference.matches) {
        playback.addEventListener('loadeddata', () => {
          if (video === playback) playback.currentTime = Math.max(0, playback.duration - .05);
        }, { once: true });
        playback.addEventListener('seeked', () => {
          if (video === playback) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
        });
      } else {
        playback.play().catch(error => {
          if (video === playback) console.error(`${condition} ending explorer video failed to play:`, error);
        });
      }
      raf = requestAnimationFrame(draw);
    },
    stop,
  };
}
