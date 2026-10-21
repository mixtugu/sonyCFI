export function connectMaze({ settings, onState, onLeave, notice }) {
  // Joining a room is the opening screen; the room's own panel lives in the settings dialog,
  // which stays reachable while the game fills the screen.
  // Roles are fixed at the start: the host is the parent, the guest the child. They swap every round.
  const lobbyMarkup = `<p id="net-status" role="status">接続中…</p><div id="net-lobby"><form id="maze-create"><button class="primary wide" disabled>部屋をつくる（ナビゲーターではじめる）</button></form><form id="maze-join"><input name="code" aria-label="迷路の部屋コード" value="A" maxlength="6" minlength="1" pattern="[A-Za-z0-9]{1,6}" autocomplete="off" autocapitalize="characters" spellcheck="false" required><button class="secondary" disabled>参加</button></form></div>`;
  const roomMarkup = `<div id="net-room" hidden><p><strong id="maze-code"></strong> <b id="maze-role"></b> <span id="maze-partner"></span></p><div class="invite-row"><button type="button" id="maze-leave" class="secondary home-icon-button" aria-label="退出" title="退出"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h12"/></svg><span>退出</span></button></div></div>`;
  const lobbyMount = document.getElementById('net-lobby-mount'), roomMount = document.getElementById('net-room-mount');
  if (lobbyMount && roomMount) { lobbyMount.innerHTML = lobbyMarkup; roomMount.innerHTML = roomMarkup; }
  else document.querySelector('.toolbar').insertAdjacentHTML('beforebegin', `<section class="multiplayer">${lobbyMarkup}${roomMarkup}</section>`);
  const $ = id => document.getElementById(id);
  const client = { active: false, connected: false, state: null, send: data => { if (socket?.readyState === 1) socket.send(JSON.stringify(data)); } };
  let socket, ticket = null, stopped = false, durable = false, pending = null, targetCode = '', retry;
  const invited = new URLSearchParams(location.search).get('maze');
  try { ticket = JSON.parse(sessionStorage.getItem('maze-session') || 'null'); } catch {}
  const validCode = code => /^[A-Z0-9]{1,6}$/.test(code || '');
  const roomInput = () => document.querySelector('#maze-join [name=code]').value.trim().toUpperCase();
  if (ticket && !validCode(ticket.code)) { ticket = null; try { sessionStorage.removeItem('maze-session'); } catch {} }
  if (ticket && invited && ticket.code !== invited.toUpperCase()) ticket = null;
  function persist() { try { if (ticket) sessionStorage.setItem('maze-session', JSON.stringify(ticket)); else sessionStorage.removeItem('maze-session'); } catch {} }
  function connection() { $('net-status').textContent = client.connected ? client.active ? '接続済み' : '' : stopped ? '別の画面で接続されました。再読み込みしてください。' : '接続中…'; $('net-status').hidden = client.connected && !client.active; document.querySelectorAll('#net-lobby button').forEach(b => b.disabled = !client.connected); }
  function connect() {
    clearTimeout(retry);
    const previous = socket;
    const current = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/maze-socket${durable ? '?code=' + encodeURIComponent(ticket?.code || targetCode) : ''}`);
    socket = current; previous?.close();
    current.onopen = () => { if (socket !== current) return; client.connected = true; connection(); if (ticket) client.send({ type: 'resume', ...ticket }); else if (pending) { client.send(pending); pending = null; } };
    current.onmessage = event => {
      if (socket !== current) return;
      const packet = JSON.parse(event.data);
      if (packet.type === 'session') { ticket = { code: packet.code, token: packet.token }; persist(); history.replaceState(null, '', `?maze=${packet.code}`); }
      if (packet.type === 'state') {
        client.active = true; client.state = packet; $('net-lobby').hidden = true; $('net-room').hidden = false;
        $('maze-code').textContent = packet.code; $('maze-role').textContent = packet.role === 'parent' ? 'ナビゲーター' : 'エクスプローラー';
        $('maze-partner').textContent = packet.partner.connected ? packet.partner.ready ? '相手は準備完了' : '相手が接続中' : '相手を待っています';
        connection(); onState(packet);
      }
      if (packet.type === 'left') leave();
      if (packet.type === 'error') { notice(packet.message); if (packet.code === 'missing' || durable && !ticket) leave(); }
    };
    current.onclose = event => { if (socket !== current) return; client.connected = false; if (event.code === 4001) { stopped = true; ticket = null; persist(); } if (durable && !client.active) { leave(); notice('部屋に接続できません。コードを確認してもう一度参加してください。'); return; } connection(); if (!stopped) retry = setTimeout(connect, 1000); };
    current.onerror = () => {};
  }
  function leave() { if (durable) { const previous = socket; socket = null; previous?.close(); clearTimeout(retry); pending = null; client.connected = true; } ticket = null; persist(); client.active = false; client.state = null; $('net-lobby').hidden = false; $('net-room').hidden = true; history.replaceState(null, '', '/'); connection(); onLeave(); }
  $('maze-create').onsubmit = async event => {
    event.preventDefault(); const code = roomInput(); if (!validCode(code)) { notice('部屋コードは英数字1〜6文字で入力してください。'); return; }
    const data = { type: 'create', code, role: 'parent', settings: settings() };
    if (!durable) { client.send(data); return; }
    client.connected = false; connection();
    try {
      const response = await fetch('/maze-api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '部屋を作れません。');
      ticket = result; persist(); connect();
    } catch (error) { client.connected = true; connection(); notice(error.message); }
  };
  $('maze-join').onsubmit = event => { event.preventDefault(); const code = roomInput(); if (!validCode(code)) { notice('部屋コードは英数字1〜6文字で入力してください。'); return; } const data = { type: 'join', code }; if (!durable) { client.send(data); return; } ticket = null; persist(); targetCode = data.code; pending = data; client.connected = false; connection(); connect(); };
  $('maze-leave').onclick = () => client.send({ type: 'leave' });
  fetch('/connection-info').then(r => r.json()).then(data => {
    durable = !!data.durable;
    if (durable && !ticket) { client.connected = true; connection(); return; }
    connect();
  }).catch(() => connect());
  return client;
}
