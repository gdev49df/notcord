// earth's network — фронтенд (чистый js)
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colorOf = (name) => `hsl(0 0% ${24 + [...name].reduce((a, c) => a + c.charCodeAt(0), 0) * 7 % 20}%)`;
const A = {}; // username -> avatar_key (собирается из ответов api)
const fileUrl = (k) => '/files/' + String(k).split('/').map(encodeURIComponent).join('/');
function harvest(o) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(harvest); return; }
  if (typeof o.username === 'string' && 'avatar_key' in o) A[o.username] = o.avatar_key;
  for (const k in o) if (o[k] && typeof o[k] === 'object') harvest(o[k]);
}
const avatar = (name, size = 32, online) => {
  const k = A[name];
  const dot = online === undefined ? '' : `<i class="dot ${online ? 'on' : ''}"></i>`;
  return `<div class="avatar ${k && S.config.files ? 'img' : ''}" style="background:${colorOf(name)};width:${size}px;height:${size}px;font-size:${size * 0.45}px">${k && S.config.files ? `<img src="${fileUrl(k)}" alt="" loading="lazy">` : esc(name[0]?.toUpperCase())}${dot}</div>`;
};
const fmtTime = (t) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function linkify(text, tags) {
  let h = esc(text);
  h = h.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  h = h.replace(/(^|[\s(])@([\p{L}\p{N}_.-]{2,24})/gu, (m, a, n) => `${a}<a class="mention" href="#" data-user="${n}">@${n}</a>`);
  if (tags) h = h.replace(/(^|[\s(])#([\p{L}\p{N}_]{2,32})/gu, (m, a, t) => `${a}<a class="tag" href="#" data-tag="${t}">#${t}</a>`);
  return h;
}
const plural = (n, a, b, c) => { const m = n % 100, d = n % 10; return n + ' ' + (m > 10 && m < 15 ? c : d === 1 ? a : d > 1 && d < 5 ? b : c); };
const badge = (n) => (n > 0 ? `<span class="badge">${n > 99 ? '99+' : n}</span>` : '');
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2200);
  setTimeout(() => t.remove(), 2700);
}

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
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  repost: '<path d="M4 11V9a3 3 0 0 1 3-3h11M15 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H6M9 21l-3-3 3-3"/>',
  quote: '<path d="M5 18v-5a5 5 0 0 1 5-5M13 18v-5a5 5 0 0 1 5-5M5 13h5v5H5zM13 13h5v5h-5z"/>',
  share: '<path d="M12 4v11M7 9l5-5 5 5M5 14v5h14v-5"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>',
  flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
  edit: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
  reply: '<path d="M10 7 4 12l6 5M4 12h9a7 7 0 0 1 7 7"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10.5" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
  poll: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8 20h8M12 16v4"/>',
  scissors: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5 20 18M8 15.5 20 6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z"/>',
  film: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9h16M4 15h16M9 4v16M15 4v16"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  star: '<path d="M12 4l2.4 5 5.6.7-4.1 3.9 1 5.6L12 16.5 7.1 19.2l1-5.6L4 9.7 9.6 9z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
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
  config: { files: false, telegram_bot: null },
  unread: {}, srvUnread: {}, notif: 0, msgs: {}, replyTo: null,
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
  harvest(data);
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
  try { S.config = await api('/config'); } catch {}
  initTelegram?.();
  if (!S.token) return showAuth();
  try {
    S.user = (await api('/me')).user;
  } catch { return showAuth(); }
  A[S.user.username] = S.user.avatar_key;
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  renderMe();
  await Promise.all([loadServers(), api('/dms').then((d) => (S.dms = d.dms)).catch(() => {})]);
  startSync?.();
  const q = new URLSearchParams(location.search);
  const inv = q.get('join');
  if (inv) {
    try { const r = await api('/servers/join', { body: { code: inv } }); history.replaceState(null, '', '/'); await loadServers(); return openServer(r.id); } catch {}
  }
  const post = Number(q.get('post'));
  if (post) { history.replaceState(null, '', '/'); await openFeed(); return openThread(post); }
  openFeed();
}
function renderMe() {
  $('#me-name').textContent = S.user.username;
  $('#me-avatar').outerHTML = avatar(S.user.username).replace('<div class="avatar', '<div id="me-avatar" class="avatar');
}

async function loadServers() {
  S.servers = (await api('/servers')).servers;
  renderRail();
}

function renderRail() {
  const r = $('#rail');
  const dmUnread = Object.values(S.dmUnread || {}).reduce((a, b) => a + b, 0);
  const on = (c) => (c ? 'on' : '');
  r.innerHTML =
    `<div class="ic ${on(S.view.type === 'feed' && S.view.page !== 'notif')}" data-act="feed" title="лента">${ic('globe')}</div>` +
    `<div class="ic ${on(S.view.page === 'notif')}" data-act="notif" title="уведомления">${ic('bell')}${badge(S.notif)}</div>` +
    `<div class="ic ${on(S.view.type === 'home')}" data-act="home" title="личные сообщения">${ic('chat')}${badge(dmUnread)}</div><div class="sep"></div>` +
    S.servers.map((s) => `<div class="ic ${on(S.view.type === 'server' && S.server?.server.id === s.id)}" data-sid="${s.id}" title="${esc(s.name)}">${esc(s.name.slice(0, 2))}${badge(S.srvUnread[s.id])}</div>`).join('') +
    `<div class="ic add" data-act="add" title="создать или присоединиться">${ic('plus')}</div>` +
    `<div class="ic add" data-act="discover" title="каталог серверов">${ic('compass')}</div>`;
  r.onclick = (e) => {
    const t = e.target.closest('.ic');
    if (!t) return;
    const a = t.dataset.act;
    if (a === 'home') openHome();
    else if (a === 'feed') openFeed();
    else if (a === 'notif') openNotifications();
    else if (a === 'add') addServerModal();
    else if (a === 'discover') discoverModal();
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
    S.dms.map((d) => `<div class="item ${S.channel?.id === d.id ? 'on' : ''}" data-dm="${d.id}" data-name="${esc(d.username)}">${avatar(d.username, 24, d.online)}<span class="grow">${esc(d.username)}</span>${badge(S.unread[d.id])}</div>`).join('');
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
    <div class="row">${avatar(f.username, 36, f.status === 'friend' ? f.online : undefined)}<div class="grow"><b>${esc(f.username)}</b>${f.status === 'outgoing' ? '<div class="muted">запрос отправлен</div>' : ''}</div>
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
  $('#side-head').innerHTML = `<span>${esc(server.name)}</span><span><button class="icon-btn" id="inv" title="пригласить" aria-label="пригласить">${ic('userplus')}</button>${owner ? `<button class="icon-btn" id="srv-set" title="настройки сервера" aria-label="настройки сервера">${ic('settings')}</button>` : ''}<button class="icon-btn" id="leave" title="${owner ? 'удалить сервер' : 'выйти'}" aria-label="меню сервера">${ic('more')}</button></span>`;
  $('#inv').onclick = inviteModal;
  if (owner) $('#srv-set').onclick = serverSettingsModal;
  $('#leave').onclick = async () => {
    if (!confirm(owner ? 'удалить сервер навсегда?' : 'выйти с сервера?')) return;
    await api(`/servers/${server.id}`, { method: 'DELETE' }); await loadServers(); openHome();
  };
  const group = (type, title) => `<div class="cat"><span>${title}</span>${owner ? `<button data-add="1" title="создать канал" aria-label="создать канал">${ic('plus')}</button>` : ''}</div>` +
    channels.filter((c) => c.type === type).map((c) => `<div class="item ${S.channel?.id === c.id ? 'on' : ''}" data-ch="${c.id}">${ic(type === 'text' ? 'hash' : 'speaker')} <span class="grow">${esc(c.name)}</span>${badge(S.unread[c.id])}</div>` +
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
  const online = members.filter((m) => m.online).length;
  $('#members').innerHTML = `<div class="cat">участники — ${members.length}${online ? ` · в сети ${online}` : ''}</div>` + members.map((m) =>
    `<div class="item" data-user="${esc(m.username)}">${avatar(m.username, 24, m.online)}<span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(m.username)}${m.id === server.owner_id ? ' <span class="muted" style="font-size:12px">· владелец</span>' : ''}</span>${owner && m.id !== S.user.id ? `<button class="icon-btn" data-kick="${m.id}" title="исключить" aria-label="исключить">${ic('close')}</button>` : ''}</div>`).join('');
  $('#members').onclick = async (e) => {
    const k = e.target.closest('[data-kick]');
    if (k) { e.stopPropagation(); if (confirm('исключить участника?')) { await api(`/servers/${server.id}/kick/${k.dataset.kick}`, { method: 'POST' }); openServer(server.id, S.channel?.id); } }
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
  S.replyTo = null;
  if (S.unread[ch.id]) { delete S.unread[ch.id]; recountUnread?.(); }
  if (S.view.type === 'server') renderServerSide(); else renderHomeSide();
  renderRail();
  $('#main-head').innerHTML = `${burger()}<span class="muted">${ch.type === 'dm' ? '@' : ic('hash')}</span> <span class="grow">${esc(ch.name)}</span><button class="icon-btn" id="pins" title="закреплённые" aria-label="закреплённые">${ic('pin')}</button>`;
  $('#main-head').onclick = (e) => { burgerClick(e); if (e.target.closest('#pins')) pinsModal(); };
  const v = $('#view');
  v.onclick = null;
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = `<div class="msgs" id="msgs"></div><div class="typing" id="typing"></div><div id="pf"></div><div id="reply-bar"></div>
    <div class="composer"><button class="clip" id="clip" title="${S.config.files ? 'прикрепить файл' : 'файлы пока отключены'}" aria-label="прикрепить файл" ${S.config.files ? '' : 'disabled'}>${ic('plus')}</button>
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
  inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } else if (e.key === 'Escape' && S.replyTo) setReply(null); };
  $('#send').onclick = sendMessage;
  $('#clip').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('#pf').innerHTML = `<div class="pending-file"><span>загрузка: ${esc(f.name)}…</span></div>`;
    try {
      S.pendingFile = await uploadFile(f);
      $('#pf').innerHTML = `<div class="pending-file"><span>${esc(f.name)}</span><a href="#" id="pf-x">убрать</a></div>`;
      $('#pf-x').onclick = (ev) => { ev.preventDefault(); S.pendingFile = null; $('#pf').innerHTML = ''; };
    } catch (er) { $('#pf').innerHTML = `<div class="pending-file error">${esc(er.message)}</div>`; }
    e.target.value = '';
  };
  inp.focus();
}
async function uploadFile(f) {
  return api('/upload', { method: 'POST', body: f, headers: { 'x-filename': encodeURIComponent(f.name || 'file'), 'content-type': (f.type || 'application/octet-stream').split(';')[0] } });
}
function setReply(m) {
  S.replyTo = m ? m.id : null;
  const bar = $('#reply-bar');
  if (!bar) return;
  bar.innerHTML = m ? `<div class="reply-bar">${ic('reply')}<span class="grow">ответ ${esc(m.username)}: ${esc((m.content || 'вложение').slice(0, 80))}</span><button class="icon-btn" id="rb-x" aria-label="отменить">${ic('close')}</button></div>` : '';
  if (m) { $('#rb-x').onclick = () => setReply(null); $('#inp')?.focus(); }
}
async function pinsModal() {
  const d = await api(`/channels/${S.channel.id}/pins`);
  modal(`<h3>закреплённые</h3><div class="pins">${d.messages.length ? d.messages.map((m) => `<div class="pin-row"><b>${esc(m.username)}</b> <span class="muted">${fmtTime(m.created_at)}</span><div>${linkify(m.content)}</div></div>`).join('') : '<div class="muted">пока ничего не закреплено</div>'}</div>
    <div class="modal-actions"><button id="m-ok">закрыть</button></div>`, (c) => { c.querySelector('#m-ok').onclick = closeModal; });
}

async function sendMessage() {
  const inp = $('#inp');
  const content = inp.value;
  if (!content.trim() && !S.pendingFile) return;
  const body = { content, ...(S.pendingFile || {}) };
  if (S.replyTo) body.reply_to = S.replyTo;
  inp.value = ''; inp.style.height = '42px';
  S.pendingFile = null; $('#pf').innerHTML = ''; setReply(null);
  try { await api(`/channels/${S.channel.id}/messages`, { body }); }
  catch (e) { alert(e.message); inp.value = content; }
}

const EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];
function msgHtml(m, prev) {
  S.msgs[m.id] = m;
  let att = '';
  if (m.att_key) {
    const url = fileUrl(m.att_key);
    if ((m.att_type || '').startsWith('image/')) att = `<a href="${url}" target="_blank"><img class="att" src="${url}" alt=""></a>`;
    else if ((m.att_type || '').startsWith('video/')) att = `<video class="att" src="${url}" controls></video>`;
    else if ((m.att_type || '').startsWith('audio/')) att = `<audio src="${url}" controls></audio>`;
    else att = `<a class="file" href="${url}" target="_blank" download="${esc(m.att_name)}">${ic('file')} ${esc(m.att_name)}</a>`;
  }
  const mine = m.user_id === S.user.id;
  const owner = S.server && S.server.server.owner_id === S.user.id;
  const cont = prev && prev.user_id === m.user_id && m.created_at - prev.created_at < 300000 && !m.reply_to;
  const when = fmtTime(m.created_at);
  const gutter = mine ? '' : `<div class="gutter">${cont ? '' : `<span data-user="${esc(m.username)}" class="clickable">${avatar(m.username, 36)}</span>`}</div>`;
  const name = mine || cont ? '' : `<div class="who"><a href="#" data-user="${esc(m.username)}">${esc(m.username)}</a></div>`;
  const quote = m.reply_to ? `<div class="quote" data-jump="${m.reply_to}"><b>${esc(m.reply_name || '?')}</b> ${esc(m.reply_content || 'сообщение удалено')}</div>` : '';
  const reacts = (m.reactions || []).length ? `<div class="reacts">${m.reactions.map((r) => `<button class="react ${r.users.includes(S.user.id) ? 'on' : ''}" data-react="${r.emoji}">${r.emoji} <span>${r.users.length}</span></button>`).join('')}</div>` : '';
  const linked = m.content ? linkify(m.content) : '';
  const tools = `<div class="mtools">
    <button data-tool="react" title="реакция" aria-label="реакция">${ic('smile')}</button>
    <button data-tool="reply" title="ответить" aria-label="ответить">${ic('reply')}</button>
    ${mine ? `<button data-tool="edit" title="изменить" aria-label="изменить">${ic('edit')}</button>` : ''}
    ${!S.server || owner ? `<button data-tool="pin" title="закрепить" aria-label="закрепить">${ic('pin')}</button>` : ''}
    ${!mine ? `<button data-tool="report" title="пожаловаться" aria-label="пожаловаться">${ic('flag')}</button>` : ''}
    ${mine || owner ? `<button data-tool="del" title="удалить" aria-label="удалить">${ic('trash')}</button>` : ''}</div>`;
  return `<div class="msg ${mine ? 'mine' : ''} ${cont ? 'cont' : ''} ${m.pinned ? 'is-pinned' : ''}" data-id="${m.id}" data-uid="${m.user_id}" data-t="${m.created_at}">${gutter}<div class="body">${name}
    ${quote}${linked ? `<div class="bubble" title="${when}">${linked}${m.edited_at ? ' <span class="edited">(изм.)</span>' : ''}${m.pinned ? `<span class="pin-mark">${ic('pin')}</span>` : ''}</div>` : ''}${att}${reacts}</div>${tools}</div>`;
}
function prevInfo(el) {
  const p = el?.previousElementSibling;
  return p?.dataset?.id ? { user_id: Number(p.dataset.uid), created_at: Number(p.dataset.t) } : null;
}
function rerenderMsg(m) {
  const el = document.querySelector(`.msg[data-id="${m.id}"]`);
  if (!el) return;
  el.insertAdjacentHTML('afterend', msgHtml(m, prevInfo(el)));
  const n = el.nextElementSibling; n.style.animation = 'none';
  el.remove();
}

async function loadMessages(cid) {
  const d = await api(`/channels/${cid}/messages`);
  if (S.channel?.id !== cid) return;
  const box = $('#msgs');
  box.innerHTML = d.messages.length ? d.messages.map((m, i) => msgHtml(m, d.messages[i - 1])).join('') : '<div class="empty"><b>здесь пока тихо</b>напиши первое сообщение</div>';
  box.scrollTop = box.scrollHeight;
  api(`/channels/${cid}/read`, { method: 'POST' }).catch(() => {});
  box.onclick = async (e) => {
    const a = e.target.closest('a[href*="?post="]');
    if (a) { e.preventDefault(); const id = Number(new URL(a.href).searchParams.get('post')); if (id) { await openFeed(); openThread(id); } return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) { const t = box.querySelector(`.msg[data-id="${jump.dataset.jump}"]`); t?.scrollIntoView({ block: 'center', behavior: 'smooth' }); t?.classList.add('flash'); setTimeout(() => t?.classList.remove('flash'), 1200); return; }
    const row = e.target.closest('.msg');
    if (!row) return;
    const id = Number(row.dataset.id), m = S.msgs[id];
    const re = e.target.closest('[data-react]');
    if (re) return api(`/messages/${id}/react`, { body: { emoji: re.dataset.react } });
    const t = e.target.closest('[data-tool]');
    if (!t) return;
    const tool = t.dataset.tool;
    if (tool === 'del') await api(`/messages/${id}`, { method: 'DELETE' });
    else if (tool === 'reply') setReply(m);
    else if (tool === 'pin') { const r = await api(`/messages/${id}/pin`, { method: 'POST' }); toast(r.pinned ? 'закреплено' : 'откреплено'); }
    else if (tool === 'report') reportModal('message', id);
    else if (tool === 'edit') editMsg(row, m);
    else if (tool === 'react') {
      document.querySelector('.pop')?.remove();
      const pop = document.createElement('div');
      pop.className = 'pop emoji-pop';
      pop.innerHTML = EMOJIS.map((e2) => `<button data-e="${e2}">${e2}</button>`).join('');
      document.body.appendChild(pop);
      const r = t.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left - 40)) + 'px';
      pop.style.top = Math.max(8, r.top - pop.offsetHeight - 6) + 'px';
      pop.onclick = (ev) => { const b = ev.target.closest('[data-e]'); if (b) { api(`/messages/${id}/react`, { body: { emoji: b.dataset.e } }); pop.remove(); } };
      setTimeout(() => document.addEventListener('click', () => pop.remove(), { once: true }), 0);
    }
  };
}
function editMsg(row, m) {
  const b = row.querySelector('.bubble');
  if (!b) return;
  b.innerHTML = `<textarea class="edit-box" rows="2">${esc(m.content)}</textarea><div class="muted small">enter — сохранить, esc — отмена</div>`;
  const ta = b.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.onkeydown = async (e) => {
    if (e.key === 'Escape') rerenderMsg(m);
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (ta.value.trim() === m.content) return rerenderMsg(m);
      try { await api(`/messages/${m.id}`, { method: 'PATCH', body: { content: ta.value } }); } catch (er) { alert(er.message); rerenderMsg(m); }
    }
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
      box.insertAdjacentHTML('beforeend', msgHtml(d.message, prevInfo({ previousElementSibling: last })));
      if (atBottom || d.message.user_id === S.user.id) box.scrollTop = box.scrollHeight;
      if (d.message.user_id !== S.user.id) api(`/channels/${cid}/read`, { method: 'POST' }).catch(() => {});
    } else if (d.type === 'delete') {
      box.querySelector(`.msg[data-id="${d.id}"]`)?.remove();
      delete S.msgs[d.id];
    } else if (d.type === 'edit') {
      S.msgs[d.message.id] = { ...S.msgs[d.message.id], ...d.message };
      rerenderMsg(S.msgs[d.message.id]);
    } else if (d.type === 'reactions') {
      if (S.msgs[d.id]) { S.msgs[d.id].reactions = d.reactions; rerenderMsg(S.msgs[d.id]); }
    } else if (d.type === 'pin') {
      if (S.msgs[d.id]) { S.msgs[d.id].pinned = d.pinned ? 1 : 0; rerenderMsg(S.msgs[d.id]); }
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
  const canShare = !!navigator.mediaDevices?.getDisplayMedia;
  const tiles = [{ name: S.user.username + ' (ты)', cid: 'me' }, ...Object.entries(S.voice.peers).map(([cid, p]) => ({ name: p.name, cid }))];
  v.innerHTML = `<div class="voice-room"><h3>${esc(ch.name)}</h3><div id="stage" class="stage"></div><div class="tiles">${tiles.map((t) =>
    `<div class="tile" id="tile-${t.cid}">${avatar(t.name, 48)}<div>${esc(t.name)}</div></div>`).join('')}</div>
    <div><button id="vmute" class="ghost btn-ic">${ic(S.voice.muted ? 'micoff' : 'mic')} ${S.voice.muted ? 'включить микрофон' : 'выключить микрофон'}</button> ${canShare ? `<button id="vshare" class="ghost btn-ic">${ic('screen')} ${S.voice.screen ? 'остановить показ' : 'показать экран'}</button>` : ''} <button id="vclip" class="ghost btn-ic ${S.voice.watch ? '' : 'hidden'}" title="сохранить последние ~30 секунд">${ic('scissors')} клип</button> <button id="vleave" class="danger">выйти из канала</button></div>
    <div class="muted small">${canShare ? 'во время показа экрана любой участник может нажать «клип» — последние ~30 секунд сохранятся в ленту.' : 'показ экрана доступен в десктопных браузерах.'}</div></div>`;
  $('#vshare')?.addEventListener('click', () => (S.voice.screen ? stopShare() : startShare()));
  $('#vclip')?.addEventListener('click', makeClip);
  renderStage?.();
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
      document.getElementById('au-' + d.cid)?.remove(); dropRemoteVideo?.(d.cid); renderVoiceView();
    } else if (d.type === 'offer') {
      V.peers[d.from] ||= { name: d.name };
      const pc = V.pcs[d.from] || (await makePc(d.from, false));
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
  if (V.screen) V.screen.getTracks().forEach((t) => pc.addTrack(t, V.screen));
  pc.ontrack = (e) => {
    if (e.track.kind === 'video') return onRemoteVideo?.(cid, e.streams[0], e.track);
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
  stopShare?.(true);
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
