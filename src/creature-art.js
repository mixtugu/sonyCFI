// Creature illustrations for the encyclopedia, the contact card, the report and the maze. The
// transparent PNGs come from the encyclopedia design sheet; undiscovered entries show the same picture
// as a silhouette (see .creature-art.is-hidden).
const pictures = import.meta.glob('./assets/creatures/*.png', { eager: true, query: '?url', import: 'default' });
export function creatureImageUrl(id) {
  const url = pictures[`./assets/creatures/${id}.png`];
  if (!url) throw new Error(`Missing creature illustration: ${id}`);
  return url;
}

export function creatureArt(id, { hidden = false, label = '' } = {}) {
  return `<img class="creature-art${hidden ? ' is-hidden' : ''}" src="${creatureImageUrl(id)}" alt="${label}"${label ? '' : ' aria-hidden="true"'} draggable="false">`;
}

// The same picture for the maze canvas, once it has loaded (null until then).
const bitmaps = new Map();
export function creatureBitmap(id) {
  if (typeof Image !== 'function') return null;
  if (!bitmaps.has(id)) {
    const image = new Image();
    image.addEventListener('error', () => console.error(`Creature illustration failed to load: ${id}`));
    image.src = creatureImageUrl(id);
    bitmaps.set(id, image);
  }
  const image = bitmaps.get(id);
  return image.complete && image.naturalWidth > 0 ? image : null;
}
