// The visual shell, Canvas artwork and WebGL water share the same navy foundation.
export const OCEAN = Object.freeze({
  base: '#000066',
  deep: '#000033',
  abyss: '#000019',
  surface: '#333399',
  panel: '#101070',
  raised: '#242487',
  light: '#b8c8ff',
  text: '#eef1ff',
  muted: '#b3bcdf',
});

const channels = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16));
export const oceanGLSL = color => `vec3(${channels(color).map(value => (value / 255).toFixed(6)).join(', ')})`;

export function applyOceanPalette() {
  for (const [name, color] of Object.entries(OCEAN)) {
    document.documentElement.style.setProperty(`--ocean-${name}`, color);
    document.documentElement.style.setProperty(`--ocean-${name}-rgb`, channels(color).join(' '));
  }
}
