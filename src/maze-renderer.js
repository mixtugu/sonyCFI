import { neighbor, edge } from './maze.js';
export function drawMaze(canvas, s, role, cursor, direction) {
  const cell = 36, pad = 14, { cols, rows } = s.settings;
  const width = cols * cell + pad * 2, height = rows * cell + pad * 2;
  if (canvas.width !== width * 2 || canvas.height !== height * 2) { canvas.width = width * 2; canvas.height = height * 2; }
  const c = canvas.getContext('2d'); c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, width, height);
  c.fillStyle = '#fafbf7'; c.fillRect(0, 0, width, height); c.translate(pad, pad);
  const center = n => [(n % cols + .5) * cell, (Math.floor(n / cols) + .5) * cell];
  const segment = (a, b) => {
    const x = a % cols, y = Math.floor(a / cols);
    return Math.abs(a - b) === 1 ? [Math.max(x, b % cols) * cell, y * cell, Math.max(x, b % cols) * cell, (y + 1) * cell] : [x * cell, Math.max(y, Math.floor(b / cols)) * cell, (x + 1) * cell, Math.max(y, Math.floor(b / cols)) * cell];
  };
  const line = (coords, color, weight = 2) => { c.strokeStyle = color; c.lineWidth = weight; c.beginPath(); c.moveTo(coords[0], coords[1]); c.lineTo(coords[2], coords[3]); c.stroke(); };
  for (let x = 0; x <= cols; x++) line([x * cell, 0, x * cell, rows * cell], '#e9ece3', .6);
  for (let y = 0; y <= rows; y++) line([0, y * cell, cols * cell, y * cell], '#e9ece3', .6);
  if (s.trail.length > 1) { c.strokeStyle = role === 'parent' ? '#e2e5d7' : '#d2e8e1'; c.lineWidth = 9; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); s.trail.forEach((n, i) => { const p = center(n); if (i) c.lineTo(...p); else c.moveTo(...p); }); c.stroke(); }
  const [sx, sy] = center((rows - 1) * cols); c.fillStyle = '#d8e8dd'; c.fillRect(sx - 14, sy - 14, 28, 28);
  if (role === 'parent') { const [x, y] = center(s.goal); c.fillStyle = '#c68c33'; c.font = 'bold 23px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⚑', x, y); }
  for (const item of s.items) {
    const [x, y] = center(item.cell), palette = { red: '#d26951', yellow: '#c9a041', green: '#669579' };
    c.beginPath(); c.arc(x, y, item.taken ? 9 : 11, 0, Math.PI * 2); c.fillStyle = item.taken ? (role === 'parent' ? palette[item.category] : '#deeadb') : '#f2e4ac'; c.fill();
    c.fillStyle = item.taken && role === 'parent' ? '#fff' : '#756332'; c.font = `bold ${item.taken ? 10 : 14}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(item.taken ? (role === 'parent' ? `−${item.risk}` : '✓') : '?', x, y + 1);
  }
  for (const e of s.base) { const [a, b] = e.split(':').map(Number); if (role !== 'child' || !s.secrets.has(e)) line(segment(a, b), '#657366', 2.5); }
  for (const e of s.walls) { const [a, b] = e.split(':').map(Number); if (role !== 'child' || !s.secrets.has(e)) line(segment(a, b), '#d46c51', 5); }
  if (role === 'child') for (const e of s.secrets) { const [a, b] = e.split(':').map(Number); c.setLineDash([3, 5]); line(segment(a, b), '#289c8e', 3); c.setLineDash([]); }
  c.strokeStyle = '#657366'; c.lineWidth = 3; c.strokeRect(0, 0, cols * cell, rows * cell);
  if (role === 'parent' && s.mode === 'parent' && s.phase !== 'result') {
    const [x, y] = center(cursor); c.strokeStyle = '#c58e42'; c.lineWidth = 2; c.strokeRect(x - 14, y - 14, 28, 28);
    const b = neighbor(s, cursor, direction); if (b >= 0) { const valid = !s.base.has(edge(cursor, b)) && !s.walls.has(edge(cursor, b)) && s.walls.size < s.settings.wallLimit; line(segment(cursor, b), valid ? '#e8a12f' : '#a8aca2', 5); }
  }
  const [ax, ay] = center(s.avatar); c.beginPath(); c.arc(ax, ay + 2, 12, 0, Math.PI * 2); c.fillStyle = '#c1cdc1'; c.fill(); c.beginPath(); c.arc(ax, ay, 11, 0, Math.PI * 2); c.fillStyle = '#244d40'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ax - 3, ay - 2, 1.5, 0, 7); c.arc(ax + 3, ay - 2, 1.5, 0, 7); c.fill();
}
export function pointerCell(canvas, s, event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * (s.settings.cols * 36 + 28) - 14;
  const y = (event.clientY - rect.top) / rect.height * (s.settings.rows * 36 + 28) - 14;
  const col = Math.floor(x / 36), row = Math.floor(y / 36);
  if (col < 0 || row < 0 || col >= s.settings.cols || row >= s.settings.rows) return null;
  const fx = x % 36, fy = y % 36, distances = [36 - fx, 36 - fy, fx, fy];
  return { cell: row * s.settings.cols + col, direction: distances.indexOf(Math.min(...distances)) };
}
