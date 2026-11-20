// earth's network — уведомления, поиск, каталог, жалобы, тема, хоткеи, pwa

// ---- синхронизация (непрочитанное, уведомления, онлайн)
let syncTimer, syncFirst = true;
S.dmUnread = {};
function recountUnread() {
  for (const k of Object.keys(S.dmUnread)) if (!S.unread[k]) delete S.dmUnread[k];
  if (S.view.type === 'server' && S.server) {
    S.srvUnread[S.server.server.id] = S.server.channels.reduce((a, c) => a + (S.unread[c.id] || 0), 0);
  }
  renderRail();
  if (S.view.type === 'server' && S.server) renderServerSide();
  else if (S.view.type === 'home') renderHomeSide();
  document.title = (S.notif + Object.values(S.dmUnread).reduce((a, b) => a + b, 0) > 0 ? '• ' : '') + "Earth's Network";
}
async function syncNow() {
  if (!S.token || !S.user) return;
  let d;
  try { d = await api('/sync' + (syncFirst ? '?init=1' : '')); } catch { return; }
  syncFirst = false;
  const prevNotif = S.notif;
  const prevDm = Object.values(S.dmUnread).reduce((a, b) => a + b, 0);
  S.notif = d.notifications;
  S.important = d.important || 0;
  S.unread = d.unread;
  if (S.channel) { delete S.unread[S.channel.id]; }
  S.srvUnread = d.servers || {};
  S.dmUnread = { ...(d.dms || {}) };
  if (S.channel) delete S.dmUnread[S.channel.id];
  if (Object.keys(S.dmUnread).some((id) => !S.dms.find((x) => x.id === Number(id)))) {
    try { S.dms = (await api('/dms')).dms; } catch {}
  }
  recountUnread();
  if (S.view.page === 'notif' && d.notifications > prevNotif) openNotifications(true);
  const dmNow = Object.values(S.dmUnread).reduce((a, b) => a + b, 0);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    if (dmNow > prevDm) new Notification("Earth's Network", { body: 'Новое личное сообщение', tag: 'dm' });
    if (S.notif > prevNotif) {
      try {
        const n = (await api('/notifications')).notifications.find((x) => !x.is_read);
        if (n) new Notification("Earth's Network", { body: `${n.username} ${notifText(n)}`, tag: 'notif' });
      } catch {}
    }
  }
}
function startSync() {
  clearInterval(syncTimer);
  syncFirst = true;
  syncNow();
  syncTimer = setInterval(syncNow, 15000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });

// ---- уведомления
const NOTE = { like: 'Оценил(а) ваш пост', reply: 'Ответил(а) на ваш пост', follow: 'Подписался(ась) на вас', mention: 'Упомянул(а) вас в посте', repost: 'Репостнул(а) ваш пост', quote: 'Процитировал(а) ваш пост', mention_msg: 'Упомянул(а) вас в чате' };
const notifText = (n) => NOTE[n.type] || 'Что-то сделал(а)';
async function openNotifications(silent) {
  if (!silent) { closeWs(); S.channel = null; S.view = { type: 'feed', page: 'notif' }; feedLayout(); renderRail(); feedSide(); }
  $('#app').classList.remove('show-side');
  $('#main-head').innerHTML = `${burger()}<span>Уведомления</span>`;
  $('#main-head').onclick = burgerClick;
  const v = $('#view');
  if (!silent) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
  const d = await api('/notifications');
  if (S.view.page !== 'notif') return;
  const canAsk = 'Notification' in window && Notification.permission === 'default';
  v.innerHTML = `<div class="feed">${canAsk ? `<div class="notice">Показывать уведомления, когда вкладка в фоне? <button id="ask-notif" class="mini">Включить</button></div>` : ''}
    ${d.notifications.length ? d.notifications.map((n) => `<div class="note ${n.is_read ? '' : 'new'}" data-n="${n.id}">${avatar(n.username, 40)}
      <div class="grow"><div><a href="#" data-user="${esc(n.username)}"><b>${esc(n.username)}</b></a> ${notifText(n)}</div>${n.snippet ? `<div class="muted snip">${esc(n.snippet)}</div>` : ''}<div class="muted small">${timeAgo(n.created_at)}</div></div></div>`).join('')
      : '<div class="empty"><b>Пока ничего нового</b>Здесь появятся лайки, ответы, подписки и упоминания</div>'}</div>`;
  $('#ask-notif')?.addEventListener('click', async () => { await Notification.requestPermission(); openNotifications(true); });
  v.onclick = (e) => {
    if (e.target.closest('[data-user]')) return;
    const row = e.target.closest('.note');
    if (!row) return;
    const n = d.notifications.find((x) => x.id === Number(row.dataset.n));
    if (!n) return;
    if (n.type === 'follow') return openProfile(n.username);
    if (n.type === 'mention_msg') {
      if (n.server_id) return openServer(n.server_id, n.channel_id);
      const dm = S.dms.find((x) => x.id === n.channel_id);
      return openHome().then(() => dm && openChannel({ id: dm.id, name: dm.username, type: 'dm' }));
    }
    if (n.post_id) openThread(n.post_id);
  };
  if (S.notif) { await api('/notifications/read', { method: 'POST' }); S.notif = 0; S.important = 0; renderRail(); feedSide(); document.title = "Earth's Network"; }
}

// ---- поиск
async function openSearch(q) {
  closeWs(); S.channel = null;
  S.view = { type: 'feed', page: 'search' };
  feedLayout(); renderRail(); feedSide();
  $('#app').classList.remove('show-side');
  $('#main-head').innerHTML = `${burger()}<span>Поиск</span>`;
  $('#main-head').onclick = burgerClick;
  const v = $('#view');
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = `<div class="feed"><div class="search-box">${ic('search')}<input id="sq" placeholder="Люди, посты, серверы или #тег" value="${esc(q || '')}" autocomplete="off"></div><div id="sres"></div></div>`;
  const inp = $('#sq');
  let timer;
  const run = async () => {
    const val = inp.value.trim();
    if (!val) { $('#sres').innerHTML = '<div class="empty"><b>Что ищем?</b>Ник, слово из поста, название сервера или #тег</div>'; return; }
    const d = await api('/search?q=' + encodeURIComponent(val));
    if (S.view.page !== 'search' || inp.value.trim() !== val) return;
    $('#sres').innerHTML =
      (d.users.length ? `<div class="cat pad">Люди</div>${d.users.map((u) => `<div class="row" data-user="${esc(u.username)}">${avatar(u.username, 40)}<div class="grow"><b>${esc(u.username)}</b>${u.bio ? `<div class="muted small">${esc(u.bio)}</div>` : ''}</div></div>`).join('')}` : '') +
      (d.servers.length ? `<div class="cat pad">Публичные серверы</div>${d.servers.map((s) => `<div class="row"><div class="grow"><b>${esc(s.name)}</b><div class="muted small">${plural(s.members, 'участник', 'участника', 'участников')}${s.description ? ' · ' + esc(s.description) : ''}</div></div><button data-join="${s.id}">Войти</button></div>`).join('')}` : '') +
      (d.posts.length ? `<div class="cat pad">${d.tag ? '#' + esc(d.tag) : 'Посты'}</div><div id="posts">${d.posts.map((p) => postHtml(p)).join('')}</div>` : '') +
      (!d.users.length && !d.servers.length && !d.posts.length ? '<div class="empty"><b>Ничего не нашлось</b>Попробуй другое слово</div>' : '');
  };
  inp.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 250); };
  bindPostEvents(v, () => run());
  const base = v.onclick;
  v.onclick = async (e) => {
    const j = e.target.closest('[data-join]');
    if (j) { const r = await api(`/servers/${j.dataset.join}/join-public`, { method: 'POST' }); await loadServers(); return openServer(r.id); }
    return base(e);
  };
  inp.focus();
  run();
}

// ---- каталог серверов
async function discoverModal() {
  modal(`<h3>Каталог серверов</h3><div class="share-list" id="dl"><div class="muted">Загрузка…</div></div>
    <div class="modal-actions"><button id="m-ok">Закрыть</button></div>`, async (c) => {
    c.querySelector('#m-ok').onclick = closeModal;
    const d = await api('/discover');
    const list = c.querySelector('#dl');
    list.innerHTML = d.servers.length ? d.servers.map((s) => `<div class="row"><div class="grow"><b>${esc(s.name)}</b><div class="muted small">${plural(s.members, 'участник', 'участника', 'участников')}${s.description ? ' · ' + esc(s.description) : ''}</div></div>
      ${s.joined ? '<span class="muted small">Вы тут</span>' : `<button data-join="${s.id}">Войти</button>`}</div>`).join('') : '<div class="muted">Пока нет публичных серверов. сделай свой публичным в настройках сервера.</div>';
    list.onclick = async (e) => {
      const j = e.target.closest('[data-join]');
      if (!j) return;
      const r = await api(`/servers/${j.dataset.join}/join-public`, { method: 'POST' });
      closeModal(); await loadServers(); openServer(r.id);
    };
  });
}
// ---- жалобы и модерация
function reportModal(type, id) {
  modal(`<h3>Пожаловаться</h3><div class="muted small">Модератор посмотрит жалобу. бан — только за серьёзные нарушения.</div>
    <select id="r-pre"><option>Спам или реклама</option><option>Оскорбления или травля</option><option>Опасный контент</option><option>Другое</option></select>
    <textarea id="r-text" rows="2" maxlength="250" placeholder="Подробности (необязательно)"></textarea>
    <div class="error" id="m-err"></div><div class="modal-actions"><button class="ghost" id="m-cancel">Отмена</button><button id="m-ok">Отправить</button></div>`, (c) => {
    c.querySelector('#m-cancel').onclick = closeModal;
    c.querySelector('#m-ok').onclick = async () => {
      const reason = c.querySelector('#r-pre').value + (c.querySelector('#r-text').value.trim() ? ': ' + c.querySelector('#r-text').value.trim() : '');
      try { await api('/reports', { body: { target_type: type, target_id: id, reason } }); closeModal(); toast('Жалоба отправлена'); }
      catch (er) { c.querySelector('#m-err').textContent = er.message; }
    };
  });
}
async function openAdmin() {
  closeWs(); S.channel = null;
  S.view = { type: 'feed', page: 'admin' };
  feedLayout(); renderRail(); feedSide();
  $('#main-head').innerHTML = `${burger()}<span>Жалобы</span>`;
  $('#main-head').onclick = burgerClick;
  const v = $('#view');
  const d = await api('/admin/reports');
  v.innerHTML = `<div class="feed">${d.reports.length ? d.reports.map((r) => `<div class="note" data-r="${r.id}"><div class="grow">
    <div><b>${r.target_type === 'post' ? 'Пост' : r.target_type === 'message' ? 'Сообщение' : 'Пользователь'} #${r.target_id}</b> · от ${esc(r.reporter)} · <span class="muted">${timeAgo(r.created_at)}</span></div>
    <div class="snip">${esc(r.snippet || '(уже удалено)')}</div><div class="muted small">${esc(r.reason)}</div>
    <div class="admin-btns"><button class="ghost mini" data-a="dismiss">Отклонить</button>${r.target_type !== 'user' ? '<button class="ghost mini" data-a="delete">Удалить контент</button>' : ''}<button class="danger mini" data-a="ban">Удалить и забанить автора</button></div></div></div>`).join('')
    : '<div class="empty"><b>Жалоб нет</b>Всё спокойно</div>'}</div>`;
  v.onclick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'ban' && !confirm('Забанить автора? он не сможет войти.')) return;
    await api(`/admin/reports/${b.closest('[data-r]').dataset.r}`, { body: { action: b.dataset.a } });
    openAdmin();
  };
}

// ---- тема
function applyTheme() {
  const t = localStorage.getItem('nc_theme') || 'auto';
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = t;
  const light = t === 'light' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', light ? '#f4f4f4' : '#000000');
}
$('#theme').innerHTML = ic('settings');
$('#theme').title = 'Настройки';
$('#theme').onclick = () => settingsModal();
applyTheme();

// ---- настройки и тихий режим
function applyPrefs() {
  document.body.classList.toggle('quiet', !!S.prefs.quiet);
  localStorage.setItem('nc_prefs', JSON.stringify(S.prefs));
}
applyPrefs();
// ---- палитра команд (ctrl/⌘ + k)
function paletteOpen() {
  if ($('#palette')) return;
  const el = document.createElement('div');
  el.id = 'palette'; el.className = 'palette';
  el.innerHTML = `<div class="pal-card"><div class="search-box">${ic('search')}<input id="pal-in" placeholder="Найти человека, сервер или команду" autocomplete="off"></div><div class="pal-list" id="pal-list"></div></div>`;
  document.body.appendChild(el);
  const inp = el.querySelector('#pal-in'), list = el.querySelector('#pal-list');
  let sel = 0, items = [], timer, people = [];
  const cmds = [
['Моя страница', 'chat', () => openProfile(S.user.username)],
    ['Личные сообщения', 'chat', () => openHome()], ['Уведомления', 'bell', () => openNotifications()],
    ['Каталог серверов', 'compass', () => discoverModal()], ['Настройки', 'settings', () => settingsModal()],
    ['Горячие клавиши', 'smile', () => helpModal()],
  ];
  const close = () => { el.remove(); };
  const build = () => {
    const q = inp.value.trim().toLowerCase();
    items = [];
    cmds.filter((c) => !q || c[0].includes(q)).forEach((c) => items.push({ label: c[0], icon: c[1], run: c[2], kind: 'Команда' }));
    S.servers.filter((s) => !q || s.name.toLowerCase().includes(q)).forEach((s) => items.push({ label: s.name, icon: 'hash', run: () => openServer(s.id), kind: 'Сервер' }));
    people.forEach((u) => items.push({ label: u.username, avatar: u.username, run: () => openProfile(u.username), kind: 'Человек' }));
    if (q) items.push({ label: `Искать «${inp.value.trim()}» везде`, icon: 'search', run: () => openSearch(inp.value.trim()), kind: '' });
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.innerHTML = items.map((it, i) => `<div class="pal-item ${i === sel ? 'on' : ''}" data-i="${i}">${it.avatar ? avatar(it.avatar, 24) : ic(it.icon)}<span class="grow">${esc(it.label)}</span><span class="muted small">${it.kind}</span></div>`).join('');
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  inp.oninput = () => {
    sel = 0; build(); clearTimeout(timer);
    const q = inp.value.trim().replace(/^@/, '');
    if (q.length < 2) { people = []; return; }
    timer = setTimeout(async () => { try { people = (await api('/people?q=' + encodeURIComponent(q))).users.slice(0, 5); build(); } catch {} }, 200);
  };
  inp.onkeydown = (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(items.length - 1, sel + 1); build(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); build(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); const it = items[sel]; close(); it?.run(); }
    else if (ev.key === 'Escape') close();
  };
  list.onclick = (ev) => { const i = ev.target.closest('[data-i]'); if (i) { const it = items[Number(i.dataset.i)]; close(); it.run(); } };
  el.onclick = (ev) => { if (ev.target === el) close(); };
  build(); inp.focus();
}

// ---- глобальные клики по @ник и #тег, горячие клавиши
document.addEventListener('click', (e) => {
  const u = e.target.closest('[data-user]');
  const t = e.target.closest('[data-tag]');
  if (!u && !t) return;
  if (e.target.closest('button[data-follow],[data-kick],.mtools')) return;
  e.preventDefault();
  closeStory?.();
  if (u && u.closest('#msgs, #members, #thread-panel, .search-res')) userCard(u.dataset.user, u);
  else if (u) openProfile(u.dataset.user); else openSearch('#' + t.dataset.tag);
});
function helpModal() {
  const rows = [['Ctrl/⌘ + K', 'Быстрый переход и поиск'], ['Alt + ↑ / ↓', 'Предыдущий / следующий канал'], ['Esc', 'Закрыть окно'], ['Enter', 'Отправить сообщение'], ['Shift + Enter', 'Новая строка'], ['Ctrl + Enter', 'Опубликовать пост'], ['?', 'Эта подсказка']];
  modal(`<h3>Горячие клавиши</h3>${rows.map(([k, n]) => `<div class="row"><kbd>${k}</kbd><span class="grow">${n}</span></div>`).join('')}<div class="modal-actions"><button id="m-ok">Понятно</button></div>`, (c) => { c.querySelector('#m-ok').onclick = closeModal; });
}
document.addEventListener('keydown', (e) => {
  if (!S.user) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); paletteOpen(); return; }
  if (e.key === 'Escape') {
    if ($('#palette')) return $('#palette').remove();
    if ($('#ucard')) return $('#ucard').remove();
    if ($('.hpop')) return closePops();
    if ($('#thread-panel')) return closeThreadPanel();
    if ($('#story-view')) return closeStory();
    if (!$('#modal').classList.contains('hidden')) return closeModal();
    if ($('#sx')) return closeShell();
  }
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const items = [...document.querySelectorAll('#side-list [data-ch], #side-list [data-dm]')];
    if (!items.length) return;
    const cur = items.findIndex((x) => x.classList.contains('on'));
    const n = items[Math.max(0, Math.min(items.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)))];
    e.preventDefault(); n?.click();
    return;
  }
  if (!typing && e.key === '?') helpModal();
});

// ---- вход через telegram (виден только если настроен на сервере)
function initTelegram() {
  const box = $('#tg-login');
  if (!box || !S.config.telegram_bot || box.dataset.ready) return;
  box.dataset.ready = '1';
  const sc = document.createElement('script');
  sc.src = 'https://telegram.org/js/telegram-widget.js?22';
  sc.async = true;
  sc.dataset.telegramLogin = S.config.telegram_bot;
  sc.dataset.size = 'large';
  sc.dataset.radius = '12';
  sc.dataset.onauth = 'onTelegramAuth(user)';
  sc.dataset.requestAccess = 'write';
  box.appendChild(sc);
  box.classList.remove('hidden');
}
async function onTelegramAuth(user) {
  try {
    const d = await api('/auth/telegram', { body: user });
    S.token = d.token; localStorage.setItem('nc_token', d.token);
    await boot();
  } catch (er) { $('#a-err').textContent = er.message; }
}

// ---- pwa
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});


// ---- нижняя навигация (телефон)
function renderBnav() {
  const b = $('#bnav');
  if (!b || !S.user) return;
  const dm = Object.values(S.dmUnread || {}).reduce((x, y) => x + y, 0);
  const p = S.view.page, t = S.view.type;
  const items = [
    ['home', 'chat', 'Чаты', t === 'home' || t === 'server', badge(dm + Object.values(S.srvUnread || {}).reduce((x, y) => x + y, 0), true)],
    ['search', 'search', 'Поиск', false, ''],
    ['notif', 'bell', 'События', p === 'notif', S.important ? badge(S.important, true) : S.notif ? '<span class="badge dot"></span>' : ''],
    ['me', 'friends', 'Я', p === 'me', ''],
  ];
  b.innerHTML = items.map(([k, i, n, on, bd]) => `<button class="${on ? 'on' : ''}" data-b="${k}">${ic(i)}<span>${n}</span>${bd}</button>`).join('');
  b.onclick = (ev) => {
    const x = ev.target.closest('[data-b]');
    if (!x) return;
    $('#app').classList.remove('show-side');
    const k = x.dataset.b;
    if (k === 'feed') openFeed(); else if (k === 'home') openHome(); else if (k === 'search') paletteOpen();
    else if (k === 'notif') openNotifications(); else openProfile(S.user.username);
  };
}
