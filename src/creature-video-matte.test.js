import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreatureVideoMatte, removeLightVideoBackground } from './creature-video-matte.js';

test('keys light checkerboard without removing black equipment or colored explorer pixels', () => {
  const data = new Uint8ClampedArray([
    255, 255, 255, 255, 225, 225, 225, 255,
    12, 12, 12, 255, 85, 85, 85, 255,
    210, 155, 40, 255, 50, 220, 235, 255,
  ]);
  removeLightVideoBackground(data);
  assert.deepEqual([3, 7, 11, 15, 19, 23].map(i => data[i]), [0, 0, 255, 255, 255, 255]);
});

test('keys the hurt explorer gray background while preserving dark equipment and yellow fabric', () => {
  const data = new Uint8ClampedArray([
    208, 206, 206, 255, 206, 203, 204, 255,
    195, 195, 195, 255, 85, 85, 85, 255,
    210, 155, 40, 255, 12, 12, 12, 255,
  ]);
  removeLightVideoBackground(data, 195);
  assert.deepEqual([3, 7, 11, 15, 19, 23].map(i => data[i]), [0, 0, 0, 255, 255, 255]);
});

function fixture() {
  const width = 15, height = 15;
  const data = new Uint8ClampedArray(width * height * 4);
  const set = (x, y, color) => data.set(color, (y * width + x) * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gray = (x + y) % 2 ? 60 : 200;
      set(x, y, [gray, gray, gray, 255]);
    }
  }
  for (let y = 3; y <= 11; y++) {
    for (let x = 3; x <= 11; x++) {
      if (x === 3 || x === 11 || y === 3 || y === 11) set(x, y, [40, 130, 180, 255]);
    }
  }
  return { width, height, data, set, alpha: (x, y) => data[(y * width + x) * 4 + 3] };
}

test('removes exterior checkerboard and black, preserving neutral colors inside the outline', () => {
  const f = fixture();
  f.set(0, 0, [0, 0, 0, 255]);
  f.set(5, 5, [0, 0, 0, 255]);
  f.set(6, 6, [255, 255, 255, 255]);
  f.set(7, 7, [120, 120, 120, 255]);
  f.set(8, 8, [100, 110, 115, 255]);
  const original = f.data.slice();
  createCreatureVideoMatte(f.width, f.height)(f.data);
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      assert.equal(f.alpha(x, y), x >= 3 && x <= 11 && y >= 3 && y <= 11 ? 255 : 0);
      const i = (y * f.width + x) * 4;
      assert.deepEqual(f.data.slice(i, i + 3), original.slice(i, i + 3));
    }
  }
});

test('closes a small outline gap without erasing the interior', () => {
  const f = fixture();
  f.set(7, 3, [120, 120, 120, 255]);
  createCreatureVideoMatte(f.width, f.height)(f.data);
  assert.equal(f.alpha(7, 3), 255);
  assert.equal(f.alpha(7, 7), 255);
  assert.equal(f.alpha(7, 1), 0);
});

test('retains background between separate subjects and resets the mask between frames', () => {
  const f = fixture();
  const apply = createCreatureVideoMatte(f.width, f.height);
  f.set(0, 0, [40, 130, 180, 255]);
  apply(f.data);
  assert.equal(f.alpha(0, 0), 255);
  assert.equal(f.alpha(1, 0), 0);
  assert.equal(f.alpha(7, 7), 255);
  for (let p = 0; p < f.width * f.height; p++) f.data.set([80, 80, 80, 255], p * 4);
  apply(f.data);
  for (let p = 0; p < f.width * f.height; p++) assert.equal(f.data[p * 4 + 3], 0);
});
