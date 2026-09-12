export function connectMaze({ settings, onState, onLeave, notice }) {
  document.querySelector('.toolbar').insertAdjacentHTML('beforebegin', `<section class="multiplayer"><div><p class="eyebrow">PLAY TOGETHER</p><h2>二人で一緒に探検する</h2><p id="net-status" role="status">サーバーに接続しています…</p></div><div id="net-lobby"><form id="maze-create"><label>自分の役割 <select name="role" aria-label="自分の役割"><option value="parent">親・壁を設置</option><option value="child">子ども・迷路を探検</option></select></label><button class="primary" disabled>部屋をつくる ↗</button></form><form id="maze-join"><input name="code" aria-label="迷路の部屋コード" placeholder="6桁の部屋コード" maxlength="6" minlength="6" pattern="[A-Fa-f0-9]{6}" required><button class="secondary" disabled>参加する</button></form><small>一人で練習する場合は、下の親・子ども・CPUモードを選んでください。</small></div><div id="net-room" hidden><p>部屋コード <strong id="maze-code"></strong> · <b id="maze-role"></b> <span id="maze-partner"></span></p><div class="invite-row"><input id="maze-link" readonly aria-label="迷路の招待リンク"><button id="maze-copy" class="secondary">リンクをコピー</button><button id="maze-leave" class="text-button">部屋を出る</button></div><small>同じWi-Fiの相手に、リンクまたはサーバーのURLと部屋コードを伝えてください。</small></div></section>`);
  const $ = id => document.getElementById(id);
  const client = { active: false, connected: false, state: null, send: data => { if (socket?.readyState === 1) socket.send(JSON.stringify(data)); } };
  let socket, ticket = null, stopped = false, shareOrigin = location.origin, durable = false, pending = null, targetCode = '', retry;
  const invited = new URLSearchParams(location.search).get('maze');
  try { ticket = JSON.parse(sessionStorage.getItem('maze-session') || 'null'); } catch {}
  if (ticket && invited && ticket.code !== invited.toUpperCase()) ticket = null;
  if (invited) $('maze-join').elements.code.value = invited.toUpperCase();
  function persist() { try { if (ticket) sessionStorage.setItem('maze-session', JSON.stringify(ticket)); else sessionStorage.removeItem('maze-session'); } catch {} }
  function connection() { $('net-status').textContent = client.connected ? client.active ? '同じ迷路につながっています。' : 'それぞれのブラウザーで同じ部屋に参加してください。' : stopped ? '別の画面で接続されました。再読み込みして参加し直せます。' : '接続を確認しています。少しお待ちください。'; document.querySelectorAll('#net-lobby button').forEach(b => b.disabled = !client.connected); }
  function link() { if (ticket) $('maze-link').value = `${shareOrigin}/?maze=${ticket.code}`; }
  function connect() {
    clearTimeout(retry);
    const previous = socket;
    const current = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/maze-socket${durable ? '?code=' + encodeURIComponent(ticket?.code || targetCode) : ''}`);
    socket = current; previous?.close();
    current.onopen = () => { if (socket !== current) return; client.connected = true; connection(); if (ticket) client.send({ type: 'resume', ...ticket }); else if (pending) { client.send(pending); pending = null; } };
    current.onmessage = event => {
      if (socket !== current) return;
      const packet = JSON.parse(event.data);
      if (packet.type === 'session') { ticket = { code: packet.code, token: packet.token }; persist(); history.replaceState(null, '', `?maze=${packet.code}`); link(); }
      if (packet.type === 'state') {
        client.active = true; client.state = packet; $('net-lobby').hidden = true; $('net-room').hidden = false;
        $('maze-code').textContent = packet.code; $('maze-role').textContent = packet.role === 'parent' ? '親役' : '子ども役';
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
    event.preventDefault(); const data = { type: 'create', role: event.target.elements.role.value, settings: settings() };
    if (!durable) { client.send(data); return; }
    client.connected = false; connection();
    try {
      const response = await fetch('/maze-api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '部屋を作れません。');
      ticket = result; persist(); connect();
    } catch (error) { client.connected = true; connection(); notice(error.message); }
  };
  $('maze-join').onsubmit = event => { event.preventDefault(); const data = { type: 'join', code: event.target.elements.code.value.toUpperCase() }; if (!durable) { client.send(data); return; } ticket = null; persist(); targetCode = data.code; pending = data; client.connected = false; connection(); connect(); };
  $('maze-leave').onclick = () => client.send({ type: 'leave' });
  $('maze-copy').onclick = async () => { try { await navigator.clipboard.writeText($('maze-link').value); notice('招待リンクをコピーしました。'); } catch { $('maze-link').select(); notice('選択された招待リンクをコピーしてください。'); } };
  fetch('/connection-info').then(r => r.json()).then(data => {
    durable = !!data.durable;
    if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && data.lan?.[0]) shareOrigin = data.lan[0]; link();
    if (durable) {
      document.querySelector('a[href="?online=1"]').hidden = true;
      document.querySelector('#net-room small').textContent = '相手にこのリンクまたは部屋コードを伝えてください。別のネットワークからも参加できます。';
      if (!ticket) { client.connected = true; connection(); return; }
    }
    connect();
  }).catch(() => connect());
  return client;
}
