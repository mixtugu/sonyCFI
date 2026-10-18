export function removeLightVideoBackground(data, backgroundBrightness = 210) {
  for (let i = 0; i < data.length; i += 4) {
    const high = Math.max(data[i], data[i + 1], data[i + 2]);
    const low = Math.min(data[i], data[i + 1], data[i + 2]);
    const brightnessKey = Math.max(0, Math.min(1, (low - backgroundBrightness + 35) / 35));
    const neutralKey = 1 - Math.max(0, Math.min(1, (high - low - 12) / 20));
    data[i + 3] = Math.round(data[i + 3] * (1 - brightnessKey * neutralKey));
  }
}

export function createCreatureVideoMatte(width, height) {
  const count = width * height;
  const foreground = new Uint8Array(count);
  const expanded = new Uint8Array(count);
  const barrier = new Uint8Array(count);
  const exterior = new Uint8Array(count);
  const queue = new Uint32Array(count);

  return data => {
    for (let p = 0; p < count; p++) {
      const i = p * 4;
      const high = Math.max(data[i], data[i + 1], data[i + 2]);
      const low = Math.min(data[i], data[i + 1], data[i + 2]);
      foreground[p] = data[i + 3] > 0 && high > 24 && high - low >= 20 ? 1 : 0;
    }

    // Close small gaps in the outline before finding the outside background.
    expanded.fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!foreground[y * width + x]) continue;
        for (let dy = Math.max(0, y - 1); dy <= Math.min(height - 1, y + 1); dy++) {
          for (let dx = Math.max(0, x - 1); dx <= Math.min(width - 1, x + 1); dx++) {
            expanded[dy * width + dx] = 1;
          }
        }
      }
    }
    barrier.set(foreground);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        if (expanded[p - width - 1] && expanded[p - width] && expanded[p - width + 1]
          && expanded[p - 1] && expanded[p] && expanded[p + 1]
          && expanded[p + width - 1] && expanded[p + width] && expanded[p + width + 1]) {
          barrier[p] = 1;
        }
      }
    }

    exterior.fill(0);
    let head = 0, tail = 0;
    const visit = p => {
      if (barrier[p] || exterior[p]) return;
      exterior[p] = 1;
      queue[tail++] = p;
    };
    for (let x = 0; x < width; x++) {
      visit(x);
      visit((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      visit(y * width);
      visit(y * width + width - 1);
    }
    while (head < tail) {
      const p = queue[head++], x = p % width;
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p < count - width) visit(p + width);
    }
    for (let p = 0; p < count; p++) {
      if (exterior[p]) data[p * 4 + 3] = 0;
    }
  };
}
