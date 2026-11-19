// notcord — фронтенд (чистый js)
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colorOf = (name) => `hsl(0 0% ${24 + [...name].reduce((a, c) => a + c.charCodeAt(0), 0) * 7 % 20}%)`;
const avatar = (name, size = 32) =>
  `<div class="avatar" style="background:${colorOf(name)};width:${size}px;height:${size}px;font-size:${size * 0.45}px">${esc(name[0]?.toUpperCase())}</div>`;
const fmtTime = (t) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const ICONS = {
  hash: '<path d="M5 9h14M4 15h14M10 4 8 20M16 4l-2 16"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  micoff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  userplus: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  friends: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5a3.5 3.5 0 0 1 0 7M18 20a6 6 0 0 0-3-5"/>',
  chat: '<path d="M5 6h14v9h-8l-4 4v-4H5z"/>',
  file: '<path d="M7 3h7l4 4v14H7zM14 3v4h4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  comment: '<path d="M4 5h16v11H11l-5 4v-4H4z"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

const S = {
  token: localStorage.getItem('nc_token'),
  user: null,
  servers: [],
  view: { type: 'home' }, // home | server
  server: null, // {server, channels, members}
  channel: null, // {id,name,type}
  dms: [],
  friends: [],
  homeTab: 'friends',
  ws: null,
  typing: {},
  pendingFile: null,
  voice: null,
  voiceUsers: {},
  feedTab: 'all',
};

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (S.token) headers.authorization = 'Bearer ' + S.token;
  let body = opts.body;
  if (body && !(body instanceof Blob) && typeof body !== 'string') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const r = await fetch('/api' + path, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && path !== '/login') { logout(true); throw new Error('сессия истекла'); }
  if (!r.ok) throw new Error(data.error || 'ошибка');
  return data;
}

// ---------- авторизация
let regMode = false;
function showAuth() {
  $('#app').classList.add('hidden');
  $('#auth').classList.remove('hidden');
}
$('#a-eye').onclick = () => {
  const inp = $('#a-pass'), show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  $('#a-eye').setAttribute('aria-pressed', show);
  $('#a-eye').setAttribute('aria-label', show ? 'скрыть пароль' : 'показать пароль');
  inp.focus();
};
$('#a-toggle').onclick = (e) => {
  $('#a-pass').autocomplete = regMode ? 'current-password' : 'new-password';
  e.preventDefault();
  regMode = !regMode;
  $('#a-submit').textContent = regMode ? 'создать аккаунт' : 'войти';
  $('#a-title').textContent = regMode ? 'создай аккаунт' : 'с возвращением';
  $('#a-toggle').textContent = regMode ? 'уже есть аккаунт? войти' : 'нет аккаунта? зарегистрироваться';
};
$('#auth-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#a-err').textContent = '';
  try {
    const d = await api(regMode ? '/register' : '/login', { body: { username: $('#a-user').value.trim(), password: $('#a-pass').value } });
    S.token = d.token;
    localStorage.setItem('nc_token', d.token);
    await boot();
  } catch (er) { $('#a-err').textContent = er.message; }
};
function logout(silent) {
  if (!silent && S.token) api('/logout', { method: 'POST' }).catch(() => {});
  leaveVoice();
  closeWs();
  localStorage.removeItem('nc_token');
  S.token = null;
  showAuth();
}
$('#logout').onclick = () => logout();

// ---------- запуск
async function boot() {
  if (!S.token) return showAuth();
  try {
    S.user = (await api('/me')).user;
  } catch { return showAuth(); }
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#me-name').textContent = S.user.username;
  $('#me-avatar').outerHTML = avatar(S.user.username).replace('class="avatar"', 'class="avatar" id="me-avatar"');
  await loadServers();
  const inv = new URLSearchParams(location.search).get('join');
  if (inv) {
    try { const r = await api('/servers/join', { body: { code: inv } }); history.replaceState(null, '', '/'); await loadServers(); return openServer(r.id); } catch {}
  }
  openFeed();
}

async function loadServers() {
  S.servers = (await api('/servers')).servers;
  renderRail();
}

function renderRail() {
  const r = $('#rail');
  r.innerHTML =
    `<div class="ic ${S.view.type === 'feed' ? 'on' : ''}" data-act="feed" title="лента">${ic('globe')}</div>` +
    `<div class="ic ${S.view.type === 'home' ? 'on' : ''}" data-act="home" title="личные сообщения">${ic('chat')}</div><div class="sep"></div>` +
    S.servers.map((s) => `<div class="ic ${S.view.type === 'server' && S.server?.server.id === s.id ? 'on' : ''}" data-sid="${s.id}" title="${esc(s.name)}">${esc(s.name.slice(0, 2))}</div>`).join('') +
    `<div class="ic add" data-act="add" title="создать или присоединиться">${ic('plus')}</div>`;
  r.onclick = (e) => {
    const t = e.target.closest('.ic');
    if (!t) return;
    if (t.dataset.act === 'home') openHome();
    else if (t.dataset.act === 'feed') openFeed();
    else if (t.dataset.act === 'add') addServerModal();
    else openServer(Number(t.dataset.sid));
  };
}

// ---------- модалки
function modal(html, onMount) {
  $('#modal-card').innerHTML = html;
  $('#modal').classList.remove('hidden');
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
  onMount?.($('#modal-card'));
}
function closeModal() { $('#modal').classList.add('hidden'); }

function addServerModal() {
  modal(`<h3>новый сервер</h3>
    <input id="m-name" placeholder="название сервера">
    <button id="m-create">создать</button>
    <div class="muted" style="text-align:center">или</div>
    <input id="m-code" placeholder="код приглашения">
    <button class="ghost" id="m-join">присоединиться</button>
    <div class="error" id="m-err"></div>`, (c) => {
    c.querySelector('#m-create').onclick = async () => {
      try { const r = await api('/servers', { body: { name: c.querySelector('#m-name').value } }); closeModal(); await loadServers(); openServer(r.id); }
      catch (e) { c.querySelector('#m-err').textContent = e.message; }
    };
    c.querySelector('#m-join').onclick = async () => {
      try { const r = await api('/servers/join', { body: { code: c.querySelector('#m-code').value } }); closeModal(); await loadServers(); openServer(r.id); }
      catch (e) { c.querySelector('#m-err').textContent = e.message; }
    };
  });
}

function channelModal() {
  modal(`<h3>новый канал</h3>
    <input id="m-name" placeholder="название">
    <select id="m-type"><option value="text">текстовый</option><option value="voice">голосовой</option></select>
    <div class="error" id="m-err"></div>
    <div class="modal-actions"><button class="ghost" id="m-cancel">отмена</button><button id="m-ok">создать</button></div>`, (c) => {
    c.querySelector('#m-cancel').onclick = closeModal;
    c.querySelector('#m-ok').onclick = async () => {
      try {
        await api(`/servers/${S.server.server.id}/channels`, { body: { name: c.querySelector('#m-name').value, type: c.querySelector('#m-type').value } });
        closeModal(); await openServer(S.server.server.id, S.channel?.id);
      } catch (e) { c.querySelector('#m-err').textContent = e.message; }
    };
  });
}

function inviteModal() {
  const link = `${location.origin}/?join=${S.server.server.invite}`;
  modal(`<h3>пригласить людей</h3>
    <div class="muted">код: <b>${esc(S.server.server.invite)}</b></div>
    <input readonly value="${esc(link)}" onclick="this.select()">
    <div class="modal-actions"><button id="m-ok">готово</button></div>`, (c) => { c.querySelector('#m-ok').onclick = closeModal; });
}

// ---------- главная: друзья и лс
async function openHome() {
  setLayout(false);
  closeWs();
  S.view = { type: 'home' };
  S.server = null;
  S.channel = null;
  renderRail();
  $('#members').innerHTML = '';
  $('#side-head').innerHTML = '<span>личные сообщения</span>';
  await refreshHome();
  showFriends();
}

async function refreshHome() {
  const [f, d] = await Promise.all([api('/friends'), api('/dms')]);
  S.friends = f.friends;
  S.dms = d.dms;
  renderHomeSide();
}

function renderHomeSide() {
  $('#side-list').innerHTML =
    `<div class="item ${!S.channel ? 'on' : ''}" data-act="friends">${ic('friends')} друзья</div><div class="cat">личные сообщения</div>` +
    S.dms.map((d) => `<div class="item ${S.channel?.id === d.id ? 'on' : ''}" data-dm="${d.id}" data-name="${esc(d.username)}">${avatar(d.username, 24)}${esc(d.username)}</div>`).join('');
  $('#side-list').onclick = (e) => {
    const t = e.target.closest('.item');
    if (!t) return;
    if (t.dataset.act === 'friends') { S.channel = null; closeWs(); renderHomeSide(); showFriends(); }
    else openChannel({ id: Number(t.dataset.dm), name: t.dataset.name, type: 'dm' });
  };
  updateVoiceBar();
}

function showFriends() {
  $('#main-head').innerHTML = burger() + `<div class="tabs">${['friends', 'incoming', 'add'].map((t) =>
    `<button class="${S.homeTab === t ? 'on' : ''}" data-tab="${t}">${{ friends: 'друзья', incoming: 'запросы', add: 'добавить' }[t]}</button>`).join('')}</div>`;
  $('#main-head').onclick = (e) => { const t = e.target.closest('[data-tab]'); if (t) { S.homeTab = t.dataset.tab; showFriends(); } else burgerClick(e); };
  const v = $('#view');
  if (S.homeTab === 'add') {
    v.innerHTML = `<div class="home"><h3>добавить друга</h3><div class="muted">введи ник пользователя</div>
      <div class="addfriend"><input id="f-name" placeholder="ник"><button id="f-send">отправить</button></div><div id="f-msg" class="muted"></div></div>`;
    $('#f-send').onclick = async () => {
      try { await api('/friends', { body: { username: $('#f-name').value } }); $('#f-msg').textContent = 'запрос отправлен'; await refreshHome(); }
      catch (e) { $('#f-msg').innerHTML = `<span class="error">${esc(e.message)}</span>`; }
    };
    return;
  }
  const list = S.friends.filter((f) => (S.homeTab === 'friends' ? f.status === 'friend' : f.status !== 'friend'));
  v.innerHTML = `<div class="home">${list.length ? list.map((f) => `
    <div class="row">${avatar(f.username, 36)}<div class="grow"><b>${esc(f.username)}</b>${f.status === 'outgoing' ? '<div class="muted">запрос отправлен</div>' : ''}</div>
    ${f.status === 'friend' ? `<button data-dm="${f.id}">сообщение</button>` : ''}
    ${f.status === 'incoming' ? `<button data-acc="${f.id}">принять</button>` : ''}
    <button class="ghost" data-del="${f.id}" aria-label="удалить">${ic('close')}</button></div>`).join('') : '<div class="empty"><b>здесь пока пусто</b>добавь друзей по нику</div>'}</div>`;
  v.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dm) { const r = await api('/dms', { body: { userId: Number(b.dataset.dm) } }); await refreshHome(); openChannel({ id: r.id, name: r.username, type: 'dm' }); }
    if (b.dataset.acc) { await api(`/friends/${b.dataset.acc}/accept`, { method: 'POST' }); await refreshHome(); showFriends(); }
    if (b.dataset.del) { await api(`/friends/${b.dataset.del}`, { method: 'DELETE' }); await refreshHome(); showFriends(); }
  };
}

// ---------- сервер
async function openServer(id, channelId) {
  setLayout(true);
  closeWs();
  S.view = { type: 'server' };
  S.server = await api(`/servers/${id}`);
  const chs = S.server.channels;
  const target = chs.find((c) => c.id === channelId) || chs.find((c) => c.type === 'text');
  renderRail();
  renderServerSide();
  renderMembers();
  if (target) openChannel(target);
  else { $('#view').innerHTML = '<div class="empty"><b>каналов нет</b>владелец сервера может создать первый</div>'; $('#main-head').innerHTML = burger(); }
}

function renderServerSide() {
  const { server, channels } = S.server;
  const owner = server.owner_id === S.user.id;
  $('#side-head').innerHTML = `<span>${esc(server.name)}</span><span><button class="icon-btn" id="inv" title="пригласить" aria-label="пригласить">${ic('userplus')}</button><button class="icon-btn" id="leave" title="${owner ? 'удалить сервер' : 'выйти'}" aria-label="меню сервера">${ic('more')}</button></span>`;
  $('#inv').onclick = inviteModal;
  $('#leave').onclick = async () => {
    if (!confirm(owner ? 'удалить сервер навсегда?' : 'выйти с сервера?')) return;
    await api(`/servers/${server.id}`, { method: 'DELETE' }); await loadServers(); openHome();
  };
  const group = (type, title) => `<div class="cat"><span>${title}</span>${owner ? `<button data-add="1" title="создать канал" aria-label="создать канал">${ic('plus')}</button>` : ''}</div>` +
    channels.filter((c) => c.type === type).map((c) => `<div class="item ${S.channel?.id === c.id ? 'on' : ''}" data-ch="${c.id}">${ic(type === 'text' ? 'hash' : 'speaker')} ${esc(c.name)}</div>` +
      (type === 'voice' ? `<div class="voice-users" id="vu-${c.id}">${(S.voiceUsers[c.id] || []).map((n) => `<div>• ${esc(n)}</div>`).join('')}</div>` : '')).join('');
  $('#side-list').innerHTML = group('text', 'текстовые каналы') + group('voice', 'голосовые каналы');
  $('#side-list').onclick = (e) => {
    if (e.target.closest('[data-add]')) return channelModal();
    const t = e.target.closest('[data-ch]');
    if (!t) return;
    const ch = channels.find((c) => c.id === Number(t.dataset.ch));
    openChannel(ch);
  };
  updateVoiceBar();
}

function renderMembers() {
  const { members, server } = S.server;
  const owner = server.owner_id === S.user.id;
  $('#members').innerHTML = `<div class="cat">участники — ${members.length}</div>` + members.map((m) =>
    `<div class="item" data-u="${m.id}">${avatar(m.username, 24)}<span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(m.username)}${m.id === server.owner_id ? ' <span class="muted" style="font-size:12px">· владелец</span>' : ''}</span>${owner && m.id !== S.user.id ? `<button class="icon-btn" data-kick="${m.id}" title="исключить" aria-label="исключить">${ic('close')}</button>` : ''}</div>`).join('');
  $('#members').onclick = async (e) => {
    const k = e.target.closest('[data-kick]');
    if (k && confirm('исключить участника?')) { await api(`/servers/${server.id}/kick/${k.dataset.kick}`, { method: 'POST' }); openServer(server.id, S.channel?.id); }
  };
}

// ---------- каналы
function burger() { return `<button class="icon-btn burger" data-burger="1" aria-label="меню">${ic('menu')}</button>`; }
function burgerClick(e) { if (e.target.closest('[data-burger]')) $('#app').classList.toggle('show-side'); }

function openChannel(ch) {
  $('#app').classList.remove('show-side');
  if (ch.type === 'voice') return openVoice(ch);
  closeWs();
  S.channel = ch;
  S.typing = {};
  if (S.view.type === 'server') renderServerSide(); else renderHomeSide();
  $('#main-head').innerHTML = `${burger()}<span class="muted">${ch.type === 'dm' ? '@' : ic('hash')}</span> ${esc(ch.name)}`;
  $('#main-head').onclick = burgerClick;
  const v = $('#view');
  v.onclick = null;
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = `<div class="msgs" id="msgs"></div><div class="typing" id="typing"></div><div id="pf"></div>
    <div class="composer"><button class="clip" id="clip" title="прикрепить файл" aria-label="прикрепить файл">${ic('plus')}</button>
    <textarea id="inp" rows="1" placeholder="написать в ${ch.type === 'dm' ? '@' : '#'}${esc(ch.name)}"></textarea><button id="send" aria-label="отправить">${ic('send')}</button></div>
    <input type="file" id="file" class="hidden">`;
  S.pendingFile = null;
  loadMessages(ch.id);
  connectWs(ch.id);
  const inp = $('#inp');
  let lastTyping = 0;
  inp.oninput = () => {
    inp.style.height = '42px'; inp.style.height = Math.min(inp.scrollHeight, 160) + 'px';
    if (Date.now() - lastTyping > 2500 && S.ws?.readyState === 1) { lastTyping = Date.now(); S.ws.send(JSON.stringify({ type: 'typing' })); }
  };
  inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  $('#send').onclick = sendMessage;
  $('#clip').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('#pf').innerHTML = `<div class="pending-file"><span>загрузка: ${esc(f.name)}…</span></div>`;
    try {
      S.pendingFile = await api('/upload', { method: 'POST', body: f, headers: { 'x-filename': encodeURIComponent(f.name), 'content-type': f.type || 'application/octet-stream' } });
      $('#pf').innerHTML = `<div class="pending-file"><span>${esc(f.name)}</span><a href="#" id="pf-x">убрать</a></div>`;
      $('#pf-x').onclick = (ev) => { ev.preventDefault(); S.pendingFile = null; $('#pf').innerHTML = ''; };
    } catch (er) { $('#pf').innerHTML = `<div class="pending-file error">${esc(er.message)}</div>`; }
    e.target.value = '';
  };
  inp.focus();
}

async function sendMessage() {
  const inp = $('#inp');
  const content = inp.value;
  if (!content.trim() && !S.pendingFile) return;
  const body = { content, ...(S.pendingFile || {}) };
  inp.value = ''; inp.style.height = '42px';
  S.pendingFile = null; $('#pf').innerHTML = '';
  try { await api(`/channels/${S.channel.id}/messages`, { body }); }
  catch (e) { alert(e.message); inp.value = content; }
}

function msgHtml(m, prev) {
  let att = '';
  if (m.att_key) {
    const url = '/files/' + m.att_key.split('/').map(encodeURIComponent).join('/');
    if ((m.att_type || '').startsWith('image/')) att = `<a href="${url}" target="_blank"><img class="att" src="${url}" alt=""></a>`;
    else if ((m.att_type || '').startsWith('video/')) att = `<video class="att" src="${url}" controls></video>`;
    else if ((m.att_type || '').startsWith('audio/')) att = `<audio src="${url}" controls></audio>`;
    else att = `<a class="file" href="${url}" target="_blank" download="${esc(m.att_name)}">${ic('file')} ${esc(m.att_name)}</a>`;
  }
  const linked = esc(m.content).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  const mine = m.user_id === S.user.id;
  const cont = prev && prev.user_id === m.user_id && m.created_at - prev.created_at < 300000;
  const canDel = mine || (S.server && S.server.server.owner_id === S.user.id);
  const when = fmtTime(m.created_at);
  const gutter = mine ? '' : `<div class="gutter">${cont ? '' : avatar(m.username, 36)}</div>`;
  const name = mine || cont ? '' : `<div class="who" style="color:var(--muted)">${esc(m.username)}</div>`;
  return `<div class="msg ${mine ? 'mine' : ''} ${cont ? 'cont' : ''}" data-id="${m.id}" data-uid="${m.user_id}" data-t="${m.created_at}">${gutter}<div class="body">${name}
    ${linked ? `<div class="bubble" title="${when}">${linked}</div>` : ''}${att}</div>
    ${canDel ? `<button class="del" data-del="1" title="удалить" aria-label="удалить">${ic('close')}</button>` : ''}</div>`;
}

async function loadMessages(cid) {
  const d = await api(`/channels/${cid}/messages`);
  if (S.channel?.id !== cid) return;
  const box = $('#msgs');
  box.innerHTML = d.messages.length ? d.messages.map((m, i) => msgHtml(m, d.messages[i - 1])).join('') : '<div class="empty"><b>здесь пока тихо</b>напиши первое сообщение</div>';
  box.scrollTop = box.scrollHeight;
  box.onclick = async (e) => {
    const b = e.target.closest('[data-del]');
    if (b) await api(`/messages/${b.closest('.msg').dataset.id}`, { method: 'DELETE' });
  };
}

// ---------- websocket (текст)
function wsUrl(kind, id) {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${kind}/${id}?token=${encodeURIComponent(S.token)}`;
}
function closeWs() { if (S.ws) { S.ws.onclose = null; S.ws.close(); S.ws = null; } }
function connectWs(cid) {
  const ws = new WebSocket(wsUrl('text', cid));
  S.ws = ws;
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    const box = $('#msgs');
    if (!box || S.channel?.id !== cid) return;
    if (d.type === 'message') {
      const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      if (box.querySelector('.empty')) box.innerHTML = '';
      const last = box.lastElementChild;
      const prev = last?.dataset?.id ? { user_id: Number(last.dataset.uid), created_at: Number(last.dataset.t) } : null;
      box.insertAdjacentHTML('beforeend', msgHtml(d.message, prev));
      if (atBottom || d.message.user_id === S.user.id) box.scrollTop = box.scrollHeight;
    } else if (d.type === 'delete') {
      box.querySelector(`.msg[data-id="${d.id}"]`)?.remove();
    } else if (d.type === 'typing') {
      S.typing[d.name] = Date.now();
      renderTyping();
      setTimeout(renderTyping, 3200);
    }
  };
  ws.onclose = () => { if (S.ws === ws) setTimeout(() => { if (S.ws === ws && S.channel?.id === cid) connectWs(cid); }, 1500); };
}
function renderTyping() {
  const el = $('#typing');
  if (!el) return;
  const names = Object.entries(S.typing).filter(([, t]) => Date.now() - t < 3000).map(([n]) => n);
  el.textContent = names.length ? `${names.join(', ')} печатает…` : '';
}

// ---------- голос (webrtc, mesh)
const ICE = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }] };

function openVoice(ch) {
  S.channel = ch;
  if (S.view.type === 'server') renderServerSide();
  $('#main-head').innerHTML = `${burger()}<span class="muted">${ic('speaker')}</span> ${esc(ch.name)}`;
  $('#main-head').onclick = burgerClick;
  renderVoiceView();
}

function renderVoiceView() {
  const ch = S.channel;
  const v = $('#view');
  const inThis = S.voice && S.voice.channelId === ch.id;
  if (!inThis) {
    v.innerHTML = `<div class="voice-room"><h3>${esc(ch.name)}</h3><div class="muted">голосовой канал. нужен доступ к микрофону.</div>
      <div><button id="vjoin">подключиться</button></div></div>`;
    $('#vjoin').onclick = () => joinVoice(ch);
    return;
  }
  const tiles = [{ name: S.user.username + ' (ты)', cid: 'me' }, ...Object.entries(S.voice.peers).map(([cid, p]) => ({ name: p.name, cid }))];
  v.innerHTML = `<div class="voice-room"><h3>${esc(ch.name)}</h3><div class="tiles">${tiles.map((t) =>
    `<div class="tile" id="tile-${t.cid}">${avatar(t.name, 48)}<div>${esc(t.name)}</div></div>`).join('')}</div>
    <div><button id="vmute" class="ghost btn-ic">${ic(S.voice.muted ? 'micoff' : 'mic')} ${S.voice.muted ? 'включить микрофон' : 'выключить микрофон'}</button> <button id="vleave" class="danger">выйти из канала</button></div></div>`;
  $('#vmute').onclick = toggleMute;
  $('#vleave').onclick = leaveVoice;
}

async function joinVoice(ch) {
  if (S.voice) leaveVoice();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { return alert('нет доступа к микрофону'); }
  const ws = new WebSocket(wsUrl('voice', ch.id));
  S.voice = { channelId: ch.id, name: ch.name, stream, ws, peers: {}, pcs: {}, muted: false };
  const V = S.voice;
  V.ws.onmessage = async (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'welcome') {
      V.cid = d.cid;
      for (const p of d.peers) { V.peers[p.cid] = { name: p.name }; await makePc(p.cid, true); }
      renderVoiceView(); updateVoiceBar();
    } else if (d.type === 'peer-join') {
      V.peers[d.cid] = { name: d.name }; renderVoiceView();
    } else if (d.type === 'peer-leave') {
      V.pcs[d.cid]?.close(); delete V.pcs[d.cid]; delete V.peers[d.cid];
      document.getElementById('au-' + d.cid)?.remove(); renderVoiceView();
    } else if (d.type === 'offer') {
      V.peers[d.from] ||= { name: d.name };
      const pc = await makePc(d.from, false);
      await pc.setRemoteDescription(d.sdp);
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      V.ws.send(JSON.stringify({ type: 'answer', to: d.from, sdp: pc.localDescription }));
      renderVoiceView();
    } else if (d.type === 'answer') {
      await V.pcs[d.from]?.setRemoteDescription(d.sdp);
    } else if (d.type === 'ice') {
      try { await V.pcs[d.from]?.addIceCandidate(d.candidate); } catch {}
    }
  };
  V.ws.onclose = () => { if (S.voice === V) leaveVoice(); };
  renderVoiceView();
}

async function makePc(cid, initiator) {
  const V = S.voice;
  const pc = new RTCPeerConnection(ICE);
  V.pcs[cid] = pc;
  V.stream.getTracks().forEach((t) => pc.addTrack(t, V.stream));
  pc.onicecandidate = (e) => { if (e.candidate) V.ws.send(JSON.stringify({ type: 'ice', to: cid, candidate: e.candidate })); };
  pc.ontrack = (e) => {
    let a = document.getElementById('au-' + cid);
    if (!a) { a = document.createElement('audio'); a.id = 'au-' + cid; a.autoplay = true; $('#audio-sink').appendChild(a); }
    a.srcObject = e.streams[0];
    watchSpeaking(e.streams[0], 'tile-' + cid);
  };
  if (initiator) {
    const off = await pc.createOffer();
    await pc.setLocalDescription(off);
    V.ws.send(JSON.stringify({ type: 'offer', to: cid, sdp: pc.localDescription }));
  }
  return pc;
}

function watchSpeaking(stream, tileId) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser(); an.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (ctx.state === 'closed') return;
      an.getByteFrequencyData(buf);
      const lvl = buf.reduce((a, b) => a + b, 0) / buf.length;
      document.getElementById(tileId)?.classList.toggle('speaking', lvl > 18);
      requestAnimationFrame(tick);
    };
    tick();
    const V = S.voice; (V.ctxs ||= []).push(ctx);
  } catch {}
}

function toggleMute() {
  const V = S.voice;
  if (!V) return;
  V.muted = !V.muted;
  V.stream.getAudioTracks().forEach((t) => (t.enabled = !V.muted));
  renderVoiceView(); updateVoiceBar();
}

function leaveVoice() {
  const V = S.voice;
  if (!V) return;
  S.voice = null;
  try { V.ws.onclose = null; V.ws.close(); } catch {}
  Object.values(V.pcs).forEach((pc) => pc.close());
  V.stream.getTracks().forEach((t) => t.stop());
  V.ctxs?.forEach((c) => c.close());
  $('#audio-sink').innerHTML = '';
  updateVoiceBar();
  if (S.channel?.type === 'voice') renderVoiceView();
}

function updateVoiceBar() {
  const b = $('#voice-bar');
  if (!S.voice) return b.classList.add('hidden');
  b.classList.remove('hidden');
  b.innerHTML = `<div><b>голос подключён</b><div class="muted">${esc(S.voice.name)}</div></div><div><button class="icon-btn" id="vb-mute">${ic(S.voice.muted ? 'micoff' : 'mic')}</button><button class="icon-btn" id="vb-leave" aria-label="выйти из канала">${ic('close')}</button></div>`;
  $('#vb-mute').onclick = toggleMute;
  $('#vb-leave').onclick = leaveVoice;
}


// ---------- лента (как threads)
function setLayout(withMembers) { $('#app').classList.toggle('no-members', !withMembers); }

function timeAgo(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 45) return 'только что';
  if (d < 3600) return Math.round(d / 60) + ' мин';
  if (d < 86400) return Math.round(d / 3600) + ' ч';
  if (d < 7 * 86400) return Math.round(d / 86400) + ' д';
  return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function postHtml(p, opts = {}) {
  const text = esc(p.content).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  const mine = p.user_id === S.user.id;
  return `<article class="post ${opts.reply ? 'reply' : ''}" data-post="${p.id}" ${opts.open === false ? '' : 'tabindex="0"'}>
    <div class="post-av" data-user="${esc(p.username)}">${avatar(p.username, 40)}</div>
    <div class="post-main">
      <div class="post-head"><a class="post-name" href="#" data-user="${esc(p.username)}">${esc(p.username)}</a><span class="muted">${timeAgo(p.created_at)}</span>
        ${mine ? `<button class="icon-btn post-del" data-act="del" title="удалить" aria-label="удалить">${ic('trash')}</button>` : ''}</div>
      <div class="post-text">${text}</div>
      <div class="post-actions">
        <button class="act like ${p.liked ? 'on' : ''}" data-act="like" aria-pressed="${p.liked}" aria-label="нравится">${ic('heart')}<span>${p.likes || ''}</span></button>
        <button class="act" data-act="open" aria-label="ответы">${ic('comment')}<span>${p.replies || ''}</span></button>
      </div>
    </div></article>`;
}

function composerHtml(placeholder, btn) {
  return `<form class="post-composer" id="pc">${avatar(S.user.username, 40)}
    <div class="pc-body"><textarea id="pc-text" rows="1" maxlength="1000" placeholder="${placeholder}"></textarea>
    <div class="pc-foot"><span class="muted" id="pc-count"></span><button type="submit" id="pc-send" disabled>${btn}</button></div></div></form>`;
}

function bindComposer(onSubmit) {
  const ta = $('#pc-text'), btn = $('#pc-send');
  ta.oninput = () => {
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
    btn.disabled = !ta.value.trim();
    $('#pc-count').textContent = ta.value.length > 800 ? `${ta.value.length}/1000` : '';
  };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && ta.value.trim()) $('#pc').requestSubmit(); };
  $('#pc').onsubmit = async (e) => {
    e.preventDefault();
    const content = ta.value.trim();
    if (!content) return;
    btn.disabled = true;
    try { await onSubmit(content); ta.value = ''; ta.style.height = 'auto'; }
    catch (er) { alert(er.message); btn.disabled = false; }
  };
}

function feedSide() {
  const t = S.view.type === 'feed' ? S.view.page : '';
  $('#side-head').innerHTML = '<span>лента</span>';
  $('#side-list').innerHTML = [['all', 'для вас', 'globe'], ['following', 'подписки', 'friends'], ['me', 'моя страница', 'chat']]
    .map(([k, n, i]) => `<div class="item ${t === k ? 'on' : ''}" data-feed="${k}" tabindex="0">${ic(i)} ${n}</div>`).join('');
  $('#side-list').onclick = (e) => {
    const t = e.target.closest('[data-feed]');
    if (!t) return;
    $('#app').classList.remove('show-side');
    if (t.dataset.feed === 'me') openProfile(S.user.username); else openFeed(t.dataset.feed);
  };
  updateVoiceBar();
}

async function openFeed(tab) {
  closeWs();
  setLayout(false);
  S.feedTab = tab || S.feedTab || 'all';
  S.view = { type: 'feed', page: S.feedTab };
  S.channel = null;
  $('#members').innerHTML = '';
  renderRail(); feedSide();
  $('#app').classList.remove('show-side');
  $('#main-head').innerHTML = `${burger()}<span>${S.feedTab === 'following' ? 'подписки' : 'для вас'}</span>`;
  $('#main-head').onclick = burgerClick;
  const v = $('#view');
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = `<div class="feed" id="feed">${composerHtml('что нового?', 'опубликовать')}<div id="posts"><div class="empty">загрузка…</div></div></div>`;
  bindComposer(async (content) => {
    const d = await api('/posts', { body: { content } });
    const box = $('#posts');
    box.querySelector('.empty')?.remove();
    box.insertAdjacentHTML('afterbegin', postHtml(d.post));
  });
  bindPostEvents(v, () => openFeed(S.feedTab));
  const { posts } = await api(`/feed?tab=${S.feedTab}`);
  if (S.view.type !== 'feed') return;
  $('#posts').innerHTML = posts.length ? posts.map((p) => postHtml(p)).join('') :
    `<div class="empty"><b>${S.feedTab === 'following' ? 'в подписках пока пусто' : 'здесь пока тихо'}</b>${S.feedTab === 'following' ? 'подпишись на людей, зайдя в их профиль' : 'напиши первый пост'}</div>`;
}

function bindPostEvents(root, refresh) {
  root.onclick = async (e) => {
    const user = e.target.closest('[data-user]');
    if (user) { e.preventDefault(); return openProfile(user.dataset.user); }
    const art = e.target.closest('.post');
    if (!art) return;
    const id = Number(art.dataset.post);
    const btn = e.target.closest('[data-act]');
    if (btn?.dataset.act === 'like') {
      const on = !btn.classList.contains('on');
      const cnt = btn.querySelector('span');
      btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on);
      cnt.textContent = Math.max(0, (Number(cnt.textContent) || 0) + (on ? 1 : -1)) || '';
      try { const r = await api(`/posts/${id}/like`, { method: 'POST' }); cnt.textContent = r.likes || ''; btn.classList.toggle('on', r.liked); }
      catch { btn.classList.toggle('on', !on); }
      return;
    }
    if (btn?.dataset.act === 'del') {
      if (!confirm('удалить пост?')) return;
      await api(`/posts/${id}`, { method: 'DELETE' });
      art.classList.add('gone');
      setTimeout(() => { if (art.classList.contains('reply') || root.querySelector('[data-thread]')) refresh(); else art.remove(); }, 250);
      return;
    }
    if (e.target.closest('a')) return;
    if (!art.classList.contains('reply')) openThread(id);
  };
  root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.classList?.contains('post')) openThread(Number(e.target.dataset.post)); };
}

async function openThread(id) {
  const v = $('#view');
  S.view = { type: 'feed', page: S.feedTab };
  $('#main-head').innerHTML = `<button class="icon-btn" id="back" aria-label="назад">${ic('back')}</button><span>пост</span>`;
  $('#main-head').onclick = null;
  $('#back').onclick = () => (S.view.profile ? openProfile(S.view.profile) : openFeed(S.feedTab));
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = '<div class="feed"><div class="empty">загрузка…</div></div>';
  let d;
  try { d = await api(`/posts/${id}`); } catch (e) { v.innerHTML = `<div class="empty"><b>${esc(e.message)}</b></div>`; return; }
  v.innerHTML = `<div class="feed" data-thread="${id}">${postHtml(d.post, { open: false }).replace('class="post "', 'class="post big"')}
    ${composerHtml(`ответить ${esc(d.post.username)}`, 'ответить')}
    <div id="replies">${d.replies.map((r) => postHtml(r, { reply: true, open: false })).join('')}</div></div>`;
  bindComposer(async (content) => {
    const r = await api('/posts', { body: { content, parent_id: id } });
    $('#replies').insertAdjacentHTML('beforeend', postHtml(r.post, { reply: true, open: false }));
  });
  bindPostEvents(v, () => openThread(id));
}

async function openProfile(username) {
  closeWs(); setLayout(false);
  S.view = { type: 'feed', page: username === S.user.username ? 'me' : '', profile: username };
  renderRail(); feedSide();
  $('#app').classList.remove('show-side');
  $('#main-head').innerHTML = `${burger()}<span>${esc(username)}</span>`;
  $('#main-head').onclick = burgerClick;
  const v = $('#view');
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = '<div class="feed"><div class="empty">загрузка…</div></div>';
  let d;
  try { d = await api(`/users/${encodeURIComponent(username)}`); } catch (e) { v.innerHTML = `<div class="empty"><b>${esc(e.message)}</b></div>`; return; }
  const u = d.user;
  v.innerHTML = `<div class="feed"><div class="profile">${avatar(u.username, 72)}
    <div class="pr-main"><h2>${esc(u.username)}</h2>
      <div class="muted"><span id="pr-followers">${d.followers}</span> подписчиков · ${d.following} подписок</div>
      <div class="muted">в сети с ${new Date(u.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</div></div>
    ${d.is_me ? '' : `<div class="pr-btns"><button id="pr-follow" class="${d.is_following ? 'ghost' : ''}">${d.is_following ? 'вы подписаны' : 'подписаться'}</button><button class="ghost" id="pr-dm">написать</button></div>`}</div>
    <div id="posts">${d.posts.length ? d.posts.map((p) => postHtml(p)).join('') : '<div class="empty"><b>постов пока нет</b></div>'}</div></div>`;
  bindPostEvents(v, () => openProfile(username));
  $('#pr-follow')?.addEventListener('click', async (e) => {
    const r = await api(`/users/${u.id}/follow`, { method: 'POST' });
    e.target.textContent = r.following ? 'вы подписаны' : 'подписаться';
    e.target.classList.toggle('ghost', r.following);
    $('#pr-followers').textContent = r.followers;
  });
  $('#pr-dm')?.addEventListener('click', async () => {
    const r = await api('/dms', { body: { userId: u.id } });
    await openHome(); await refreshHome(); openChannel({ id: r.id, name: r.username, type: 'dm' });
  });
}

boot();
