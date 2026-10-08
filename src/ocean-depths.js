// Full-screen WebGL ocean for the in-game journey: light shafts, caustics, parallax reef and
// marine snow, bubble columns, the surface seen from below, and the camera breaking the surface.
import { OCEAN, oceanGLSL } from './ocean-palette.js';
const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes, uPointer;
uniform float uTime, uDepth, uSurface, uScroll, uBubble, uRush, uDanger, uPulseR;
uniform vec3 uPulse;
uniform vec4 uRipple;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return v; }
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.;
  vec2 i = p; float c = 1.;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1. - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1. / length(vec2(p.x / (sin(i.x + tt) / .005), p.y / (cos(i.y + tt) / .005)));
  }
  c /= 4.; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.), 0., 1.);
}
float ring(vec2 p, vec2 c, float r, float w) { float d = (length(p - c) - r) / w; return exp(-d * d); }

vec3 skyAndSea(vec2 p, float t, float aspect, float horizon) {
  vec3 sky = mix(vec3(1., .84, .66), vec3(.34, .62, .86), smoothstep(horizon, horizon + .5, p.y));
  vec2 sun = vec2(.2 * aspect, horizon + .15);
  float sd = length(p - sun);
  sky += vec3(1., .9, .68) * (smoothstep(.05, .04, sd) * .8 + exp(-sd * 5.5) * .45);
  float cl = fbm(vec2(p.x * 1.4 + t * .012, p.y * 4.5));
  sky = mix(sky, vec3(1., .97, .93), smoothstep(.52, .8, cl) * .45 * smoothstep(horizon + .03, horizon + .2, p.y));
  float k = clamp((p.y - (horizon - .22)) / .22, 0., 1.);
  vec3 sea = mix(${oceanGLSL(OCEAN.base)}, ${oceanGLSL(OCEAN.light)}, pow(k, 1.8));
  float z = 1. / max(horizon - p.y, .012);
  sea += (noise(vec2(p.x * z * .9 + t * .25, z * 1.6 - t * .7)) - .5) * .09;
  float glit = pow(noise(vec2(p.x * 34., p.y * 75. + t * 2.4)), 9.) * 2.2;
  sea += vec3(1., .95, .8) * glit * exp(-abs(p.x - sun.x) * 3.) * k;
  sea += vec3(1., .88, .66) * exp(-abs(p.x - sun.x) * 6.) * pow(k, 4.) * .45;
  vec3 col = p.y > horizon ? sky : sea;
  return mix(col, vec3(.98, .92, .82), exp(-abs(p.y - horizon) * 70.) * .55);
}

void main() {
  float aspect = uRes.x / uRes.y, t = uTime;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2((uv.x - .5) * aspect, uv.y - .5);

  // Shock rings (countdown ticks, taps) bend and brighten the water.
  float pw = uPulse.z * ring(p, uPulse.xy, uPulseR, .045);
  float rw = uRipple.z * ring(p, uRipple.xy, uRipple.w, .018);
  p += normalize(p - uPulse.xy + 1e-4) * pw * .018 + normalize(p - uRipple.xy + 1e-4) * rw * .01;

  float d = uDepth, s = smoothstep(0., 1., uSurface);
  float wlFlat = mix(.95, -.06, s);
  float wl = wlFlat + (.022 * sin(p.x * 5. + t * 1.4) + .011 * sin(p.x * 12.7 - t * 2.3)) * s;

  vec3 top = mix(${oceanGLSL(OCEAN.surface)}, ${oceanGLSL(OCEAN.base)}, d);
  vec3 bot = mix(${oceanGLSL(OCEAN.base)}, ${oceanGLSL(OCEAN.abyss)}, d);
  vec3 col = mix(bot, top, pow(clamp(uv.y + uPointer.y * .04, 0., 1.), 1.3));
  vec2 sun = vec2(.22 * aspect + uPointer.x * .1, .72);
  col += vec3(.25, .3, .65) * exp(-length((p - sun) * vec2(.75, 1.3)) * 2.1) * (1. - d * .75) * .6;

  float a = atan(p.x - sun.x, sun.y + .3 - p.y);
  float rays = smoothstep(.45, 1., noise(vec2(a * 8. + 1.3, t * .11)));
  rays += .75 * smoothstep(.5, 1., noise(vec2(a * 15. - 4., t * .17 + 3.)));
  rays += .5 * smoothstep(.55, 1., noise(vec2(a * 29. + 7., t * .23)));
  rays *= smoothstep(-.75, .45, p.y) * (1. - d * .5) * (1. + s * 1.5);
  col += ${oceanGLSL(OCEAN.light)} * rays * .2;

  float cz = caustic(vec2(p.x * .55 + uPointer.x * .05, p.y * .9), t * .42);
  col += vec3(.4, .5, .9) * cz * .05 * (1. - d * .6);

  // Reef floor: three parallax silhouettes, caustic-lit, with kelp on the nearest.
  for (int L = 0; L < 3; L++) {
    float fl = float(L), par = .3 + fl * .5;
    float x = p.x * (1. + fl * .5) + uPointer.x * par * .5 + fl * 3.7;
    float base = mix(-.95 - fl * .03, -.2 - fl * .09, d);
    float prof = base + .11 * fbm(vec2(x * 1.3, fl * 1.7)) + .03 * noise(vec2(x * 7., fl * 3.1));
    float m = smoothstep(prof + .005, prof - .005, p.y);
    vec3 rock = mix(col, ${oceanGLSL(OCEAN.abyss)}, .45 + fl * .2);
    rock += vec3(.4, .5, .9) * cz * (.22 - fl * .05) * (1. - d * .45) * smoothstep(prof - .2, prof, p.y);
    col = mix(col, rock, m);
    if (L == 2) {
      float q = x * 4.5, id = floor(q), hh = hash(vec2(id, 4.2));
      float tip = prof + .1 + .3 * hh;
      float sway = sin(t * .7 + id * 1.7 + p.y * 5.) * .18 * clamp((p.y - prof) * 3., 0., 1.);
      float kelp = step(.7, hh) * smoothstep(.09, .04, abs(fract(q) - .5 - sway)) * smoothstep(tip, tip - .03, p.y) * step(prof - .03, p.y);
      col = mix(col, vec3(.015, .11, .1) + vec3(.1, .3, .2) * (1. - d), kelp * .9);
    }
  }

  // Marine snow in three depth layers; near motes are large, soft and move the most.
  for (int L = 0; L < 3; L++) {
    float fl = float(L), sc = 3. + fl * 4., par = 1.5 - fl * .45;
    vec2 q = p * sc;
    q.x += uPointer.x * par * 1.4;
    q.y += (t * .025 - uScroll * .1 * par) * sc;
    vec2 id = floor(q), f = fract(q) - .5;
    float h = hash(id + fl * 19.7);
    vec2 o = (vec2(hash(id + 3.1), hash(id + 7.3)) - .5) * .7 + .1 * vec2(sin(t * .6 + h * 30.), cos(t * .45 + h * 17.));
    float r = mix(.03, .08, hash(id + 1.9)) * (L == 0 ? 2.4 : 1.);
    float b = (1. - smoothstep(L == 0 ? 0. : r * .4, r, length(f - o))) * step(.6, h);
    col += vec3(.7, .95, .9) * b * (L == 0 ? .09 : .3 - fl * .07) * (1. - d * .35);
  }

  // Bubble columns race upward while the camera moves.
  {
    vec2 q = p * vec2(7., 5.);
    q.y -= uBubble;
    vec2 id = floor(q), f = fract(q) - .5;
    float lane = hash(vec2(id.x, 7.7)), h = hash(id);
    float on = step(.76 - uRush * .3, lane) * step(.3, h);
    vec2 o = vec2((hash(id + .7) - .5) * .4 + .1 * sin(t * 2.2 + h * 40.), (hash(id + .3) - .5) * .5);
    float r = mix(.07, .17, hash(id + 2.2));
    vec2 e = (f - o) * vec2(1., 1.4);
    float dd = length(e);
    float rim = smoothstep(r, r - .03, dd) * smoothstep(r - .08, r - .035, dd);
    float hl = smoothstep(.05, 0., length(e - vec2(-r * .35, r * .4)));
    col += vec3(.75, 1., .96) * (rim * .3 + hl * .5 + (1. - smoothstep(0., r, dd)) * .04) * on;
  }

  // The rippling surface seen from below (Snell's window) near the top of the water.
  float ns = (1. - smoothstep(0., .28, d)) * (1. - s);
  float sl = .5 - .15 * ns + .012 * sin(p.x * 9. + t * 1.7) + .007 * sin(p.x * 23. - t * 2.6);
  vec3 window = vec3(.5, .86, .88) + .45 * caustic(vec2(p.x * .9, p.y * 2.2 + t * .02), t * .7);
  window += vec3(.5, .45, .3) * exp(-length(p - vec2(sun.x, .62)) * 3.);
  col = mix(col, window, smoothstep(sl - .006, sl + .006, p.y) * ns * .92);
  col += vec3(.85, 1., .95) * ns * exp(-abs(p.y - sl) * 70.) * .5;

  col += vec3(.25, .55, .52) * exp(-max(wl - p.y, 0.) * 5.) * s * .55;
  col += vec3(.6, 1., .92) * (pw * .3 + rw * .22);
  if (s > .001 && p.y > wl) col = skyAndSea(p, t, aspect, wlFlat + .22);
  col += vec3(1.) * exp(-abs(p.y - wl) * 120.) * .55 * s;

  float vig = smoothstep(.55, 1.35, length(vec2((uv.x - .5) * 1.6, (uv.y - .5) * 1.25)) * 1.25);
  col *= 1. - vig * (.5 - s * .3);
  col = mix(col, vec3(.5, .07, .06), vig * uDanger * (.5 + .22 * sin(t * 5.2)));
  col += (hash(gl_FragCoord.xy + fract(t) * 91.) - .5) * .012;
  gl_FragColor = vec4(col, 1.);
}`;

export function createDepths(canvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  let program = null, uniforms = {};
  function init() {
    const shader = (type, source) => {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link');
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(program, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    uniforms = Object.fromEntries(['uRes', 'uPointer', 'uTime', 'uDepth', 'uSurface', 'uScroll', 'uBubble', 'uRush', 'uDanger', 'uPulseR', 'uPulse', 'uRipple'].map(n => [n, gl.getUniformLocation(program, n)]));
  }
  try { init(); } catch { return null; }
  canvas.addEventListener('webglcontextlost', event => event.preventDefault());
  canvas.addEventListener('webglcontextrestored', () => { try { init(); } catch { program = null; } });
  return {
    render(o) {
      if (!program || gl.isContextLost()) return;
      const w = Math.max(1, Math.round(o.width * o.scale)), h = Math.max(1, Math.round(o.height * o.scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      const u = uniforms;
      gl.uniform2f(u.uRes, w, h); gl.uniform2f(u.uPointer, o.pointer[0], o.pointer[1]);
      gl.uniform1f(u.uTime, o.time); gl.uniform1f(u.uDepth, o.depth); gl.uniform1f(u.uSurface, o.surface);
      gl.uniform1f(u.uScroll, o.scroll); gl.uniform1f(u.uBubble, o.bubble); gl.uniform1f(u.uRush, o.rush);
      gl.uniform1f(u.uDanger, o.danger); gl.uniform1f(u.uPulseR, o.pulseR);
      gl.uniform3f(u.uPulse, ...o.pulse); gl.uniform4f(u.uRipple, ...o.ripple);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
