const artwork = import.meta.glob('./assets/creatures/transparent/*.png', { eager: true, query: '?url', import: 'default' });

export function creatureImageUrl(id) {
  const url = artwork[`./assets/creatures/transparent/${id}.png`];
  if (!url) throw new Error(`Missing creature illustration: ${id}`);
  return url;
}

const images = new Map();
export function creatureImage(id) {
  if (!images.has(id)) {
    const image = new Image();
    image.src = creatureImageUrl(id);
    image.onerror = () => console.error(`Failed to load creature illustration: ${id}`);
    images.set(id, image);
  }
  return images.get(id);
}
