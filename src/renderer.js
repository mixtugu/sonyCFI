const W = 1200, H = 720;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function line(a, b, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function circle(x, y, radius, color) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }
  function label(text, x, y, color = '#7fa5a9', size = 12) {
    ctx.fillStyle = color; ctx.font = `${size}px 'Noto Sans JP', sans-serif`; ctx.textAlign = 'center'; ctx.fillText(text, x, y);
  }

  return function draw(view, { role, cursor, vertical, drag, active, frames = [], replay = false, visualChild } = {}, time = 0) {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, W, 500);
    bg.addColorStop(0, '#bee7df'); bg.addColorStop(.5, '#9ed9df'); bg.addColorStop(1, '#79bace');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      for (let y = 0; y <= H + 20; y += 15) {
        const x = 65 + i * 200 + Math.sin(y / 110 + i * .31) * 34 + Math.sin(y / 220 + i) * 45;
        y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#ffffff20'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (let i = 0; i < 15; i++) circle((i * 197.7 + Math.sin(time * .15 + i) * 8) % W, (i * 89.3 - time * (3 + i % 3) + 20000) % H, i % 3 === 0 ? 1.6 : .8, '#ffffff77');
    if (view.haven) {
      const h = view.haven, glow = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r + 40);
      glow.addColorStop(0, '#f7f5d680'); glow.addColorStop(1, '#f7f5d600'); circle(h.x, h.y, h.r + 40, glow);
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.strokeStyle = '#529d8a'; ctx.setLineDash([5, 9]); ctx.stroke(); ctx.setLineDash([]);
      label('静かな入り江', h.x, h.y + 10, '#2c6d63', 17); label('あなたが守りたい場所', h.x, h.y + 34, '#417c71', 10);
    }
    if (view.gate) {
      const g = view.gate;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(g.x, g.y, 23 + i * 12, 50 + i * 9, 0, 0, Math.PI * 2);
        ctx.strokeStyle = view.found.length >= 5 ? `rgba(255,255,241,${.8 - i * .2})` : `rgba(34,113,139,${.3 - i * .07})`; ctx.lineWidth = 2; ctx.stroke();
      }
      label('光の門', g.x, g.y + 94, '#255d77', 14);
    }
    (view.treasures || []).forEach((p, i) => {
      if (view.found.includes(i)) return;
      const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 30); glow.addColorStop(0, '#fff6cf88'); glow.addColorStop(1, '#fff6cf00'); circle(p.x, p.y, 30, glow);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#fff4c3'; ctx.fillRect(-6, -6, 12, 12); ctx.strokeStyle = '#b68d49'; ctx.strokeRect(-11, -11, 22, 22); ctx.restore();
    });
    for (const [x, y] of [[90, 640], [355, 650], [735, 650], [955, 80], [65, 125]]) {
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * 8, y); ctx.quadraticCurveTo(x + i * 12 + Math.sin(time + i) * 5, y - 24, x + i * 6, y - 42 - Math.abs(i) * 5); ctx.strokeStyle = '#468f9533'; ctx.lineWidth = 3; ctx.stroke();
      }
    }
    if (replay && frames.length) {
      ctx.beginPath(); frames.filter(f => f.time <= view.time).forEach((f, i) => i ? ctx.lineTo(f.child.x, f.child.y) : ctx.moveTo(f.child.x, f.child.y)); ctx.strokeStyle = '#216e8690'; ctx.lineWidth = 2; ctx.stroke();
    }
    for (const wall of view.walls) {
      ctx.save(); ctx.globalAlpha = Math.max(.15, Math.min(1, (1 - (view.time - wall.born) / 12) * 3)); ctx.lineCap = 'round';
      line(wall.a, wall.b, '#fff0dd70', 19); line(wall.a, wall.b, wall.pressure > 0 ? '#b64d43' : '#e37a65', 5);
      circle(wall.a.x, wall.a.y, 6, '#d46152'); circle(wall.b.x, wall.b.y, 6, '#d46152');
      if (wall.pressure > 0) line(wall.a, { x: wall.a.x + (wall.b.x - wall.a.x) * wall.pressure / 1.4, y: wall.a.y + (wall.b.y - wall.a.y) * wall.pressure / 1.4 }, '#fff5e9', 8);
      ctx.restore();
    }
    if (role === 'parent' && active && cursor) {
      const c = cursor, a = drag ? drag.a : { x: c.x - (vertical ? 0 : 70), y: c.y - (vertical ? 70 : 0) };
      let b = drag ? drag.b : { x: c.x + (vertical ? 0 : 70), y: c.y + (vertical ? 70 : 0) };
      const length = Math.hypot(a.x - b.x, a.y - b.y);
      if (length > 180) b = { x: a.x + (b.x - a.x) * 180 / length, y: a.y + (b.y - a.y) * 180 / length };
      ctx.save(); ctx.setLineDash([5, 5]); line(a, b, '#b95c5199', 3); ctx.setLineDash([]); ctx.strokeStyle = '#b95c51'; ctx.strokeRect(c.x - 6, c.y - 6, 12, 12); label('壁を置く', c.x, c.y - 24, '#8b5149', 11); ctx.restore();
    }
    const p = visualChild || view.child;
    circle(p.x, p.y, 25, '#ffffff33'); circle(p.x, p.y, 18, '#ffffff66');
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle || 0); ctx.fillStyle = '#277b8a';
    ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-22, -11); ctx.lineTo(-18, 0); ctx.lineTo(-22, 11); ctx.lineTo(-10, 5); ctx.fill();
    ctx.fillStyle = '#195e78'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#effbf4'; ctx.beginPath(); ctx.ellipse(7, 0, 5, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    label(role === 'child' ? 'あなた' : '小さな探検家', p.x, p.y - 29, '#234f67', 12);
    if (replay) label('航海の記録 · ' + view.time.toFixed(1) + '秒', 600, 675, '#234f67', 12);
  };
}
