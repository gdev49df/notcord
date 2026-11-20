// ---- карточка профиля по клику на ник в чате
async function userCard(username, anchor) {
  $('#ucard')?.remove();
  const el = document.createElement('div');
  el.id = 'ucard'; el.className = 'ucard';
  el.innerHTML = '<div class="uc-load muted">Загрузка…</div>';
  document.body.appendChild(el);
  const place = () => {
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    const inRight = !!anchor.closest('#members');
    let x = inRight ? r.left - w - 10 : r.right + 10;
    if (x + w > innerWidth - 8) x = Math.max(8, r.left - w - 10);
    if (x < 8) x = Math.max(8, Math.min(innerWidth - w - 8, r.left));
    let y = Math.min(Math.max(8, r.top - 20), innerHeight - h - 8);
    if (anchor.closest('.me-bar')) { x = r.left; y = Math.max(8, r.top - h - 12); }
    el.style.left = x + 'px'; el.style.top = y + 'px';
  };
  place();
  let d;
  try { d = await api(`/users/${encodeURIComponent(username)}?card=1`); }
  catch (e) { el.innerHTML = `<div class="uc-load">${esc(e.message)}</div>`; return; }
  const u = d.user;
  const member = S.server?.members?.find((m) => m.username === u.username);
  const roles = member?.roles || [];
  const joined = new Date(u.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const row = (id, icon, text, extra = '') => `<button class="uc-row" id="${id}"><span class="uc-ri">${icon ? ic(icon) : ''}</span><span class="grow">${text}</span>${extra}</button>`;
  el.innerHTML = `<div class="uc-banner" style="background:${bannerBg(u.banner, u.username)}"></div>
    <div class="uc-av">${avatar(u.username, 84, ps({ online: d.online, presence: u.presence }))}</div>
    <div class="uc-body">
      <div class="uc-name">${esc(u.username)}${u.pronouns ? ` <span class="pron">${esc(u.pronouns)}</span>` : ''}</div>
      <div class="uc-sub">${{ online: 'В сети', dnd: 'Занят', invisible: 'Невидимка', offline: 'Не в сети' }[d.online || d.is_me ? (u.presence || 'online') : 'offline']}</div>
      ${u.status ? `<div class="uc-status-t">${esc(u.status)}</div>` : ''}
      ${u.activity ? `<div class="uc-act">${ic('gamepad')}<span>Играет в <b>${esc(u.activity)}</b></span></div>` : ''}
      ${u.music ? `<div class="uc-act">${ic('music')}<span>Слушает <b>${esc(u.music)}</b></span></div>` : ''}
      ${badgeRow(d.badges)}
      ${roles.length ? `<div class="uc-roles">${roles.map((r) => `<span class="role-chip"><i style="background:${r.color || 'var(--muted)'}"></i>${esc(r.name)}</span>`).join('')}</div>` : ''}
      ${socialLinks(u) ? `<div class="soc-row">${socialLinks(u)}</div>` : ''}
      <div class="uc-box"><div class="uc-box-t">О себе</div>${u.bio ? `<div class="uc-bio">${linkify(u.bio, true)}</div>` : '<div class="muted small">Пока ничего</div>'}
        <div class="muted small uc-meta"><span id="uc-fol">${d.followers}</span> подписчиков • с нами с ${joined}</div></div>
      <div class="uc-box uc-menu">
        ${d.is_me ? row('uc-edit', 'edit', 'Редактировать профиль') + (S.server ? row('uc-sp', 'edit', 'Профиль на сервере') : '') + row('uc-set', 'settings', 'Настройки') + row('uc-open', 'friends', 'Моя страница')
          : row('uc-dm', 'chat', 'Написать') + row('uc-fl', 'userplus', d.is_following ? 'Вы подписаны' : 'Подписаться') + row('uc-open', 'friends', 'Профиль')}
      </div>
      ${d.is_me ? `<div class="uc-box uc-menu"><button class="uc-row" id="uc-pres"><span class="uc-ri"><i class="pdot ${u.presence || 'online'}"></i></span><span class="grow">${{ online: 'Онлайн', dnd: 'Занят', invisible: 'Невидимка' }[u.presence || 'online']}</span><span class="uc-chev">${ic('chevron')}</span></button></div>` : ''}
      <div class="uc-box uc-menu">${row('uc-id', '', 'Копировать ID пользователя', '<span class="uc-idb">ID</span>')}</div>
    </div>`;
  place();
  const $$ = (s) => el.querySelector(s);
  $$('#uc-open').onclick = () => { el.remove(); openProfile(u.username); };
  $$('#uc-edit')?.addEventListener('click', () => { el.remove(); settingsModal('profile'); });
  $$('#uc-sp')?.addEventListener('click', () => { el.remove(); serverProfileModal(); });
  $$('#uc-set')?.addEventListener('click', () => { el.remove(); settingsModal(); });
  $$('#uc-pres')?.addEventListener('click', (e) => presMenu(e.currentTarget, u.presence || 'online', async (k) => {
    try { await api('/profile', { method: 'PATCH', body: { presence: k } }); S.user.presence = k; renderMe(); el.remove(); userCard(username, anchor); } catch (er) { toast(er.message); }
  }));
  $$('#uc-id').onclick = async () => { try { await navigator.clipboard.writeText(String(u.id)); toast('ID скопирован'); } catch { toast('ID: ' + u.id); } el.remove(); };
  $$('#uc-fl')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const r = await api(`/users/${u.id}/follow`, { method: 'POST' });
    btn.querySelector('.grow').textContent = r.following ? 'Вы подписаны' : 'Подписаться'; $$('#uc-fol').textContent = r.followers;
  });
  $$('#uc-dm')?.addEventListener('click', async () => {
    el.remove();
    const r = await api('/dms', { body: { userId: u.id } });
    await openHome(); await refreshHome(); openChannel({ id: r.id, name: r.username, type: 'dm' });
  });
  const off = (ev) => { if (!el.contains(ev.target)) { el.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
}

// мини-окошко выбора статуса
const PRES = [['online', 'Онлайн', ''], ['dnd', 'Занят', 'Без звуков и уведомлений'], ['invisible', 'Невидимка', 'Другие видят, что тебя нет в сети']];
function presMenu(anchor, cur, onPick) {
  document.getElementById('pmenu')?.remove();
  const el = document.createElement('div');
  el.id = 'pmenu'; el.className = 'ctx pmenu';
  el.innerHTML = PRES.map(([k, n, sub]) => `<button data-p="${k}" class="${k === cur ? 'cur' : ''}"><span class="pm-l"><i class="pdot ${k}"></i><span>${n}${sub ? `<small>${sub}</small>` : ''}</span></span>${k === cur ? '<span class="pm-ck">✓</span>' : ''}</button>`).join('');
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  let x = r.right + 8; if (x + w > innerWidth - 8) x = Math.max(8, r.left - w - 8);
  el.style.left = x + 'px'; el.style.top = Math.max(8, Math.min(r.top, innerHeight - h - 8)) + 'px';
  el.onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { el.remove(); onPick(b.dataset.p); } };
  const off = (ev) => { if (!el.contains(ev.target)) { el.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
}

// ---- значки
const BADGES = (() => {
  const L = [];
  [['Новичок эфира', 10], ['Ведущий', 50], ['Эфирщик', 100], ['Режиссёр', 500], ['Мастер эфира', 1000], ['Легенда эфира', 5000]].forEach(([n, h], i) => L.push({ id: 'share' + h, name: n, desc: `${h.toLocaleString('ru-RU')} ч показа экрана`, icon: 'screen', tier: i + 1, group: 'Показ экрана', stat: 'share_h', goal: h, unit: 'ч' }));
  [['Игрок', 3], ['Коллекционер', 10], ['Геймер', 25], ['Знаток игр', 100], ['Архивариус', 500], ['Вселенная игр', 1000]].forEach(([n, c], i) => L.push({ id: 'games' + c, name: n, desc: c >= 1000 ? '1000+ разных игр' : `${c} разных игр`, icon: 'gamepad', tier: i + 1, group: 'Игры', stat: 'games', goal: c, unit: '' }));
  [['Спикер', 10, 2], ['Оратор', 50, 3], ['Рупор', 100, 5], ['Голос сервера', 500, 6]].forEach(([n, h, t]) => L.push({ id: 'speaker' + h, name: n, desc: `${h} ч в голосовых каналах`, icon: 'mic', tier: t, group: 'Голос', stat: 'voice_h', goal: h, unit: 'ч' }));
  L.push({ id: 'early', name: 'Ранняя пташка', desc: 'Зарегистрирован(а) в первый месяц', icon: 'sun', tier: 0, group: 'Особые' });
  return L;
})();
const bdgEl = (id, big) => { const b = BADGES.find((x) => x.id === id); return b ? `<span class="bdg t${b.tier}${big ? ' big' : ''}" title="${esc(b.name)} — ${esc(b.desc)}">${ic(b.icon)}</span>` : ''; };
const badgeRow = (ids) => (ids && ids.length ? `<div class="bdg-row">${ids.map((i) => bdgEl(i)).join('')}</div>` : '');

// ---- всплывающие окна под шапкой (закреплённые, ветки, уведомления канала)
function closePops() { document.querySelectorAll('.hpop').forEach((x) => x.remove()); }
function hpop(anchor, html, onMount) {
  closePops();
  const el = document.createElement('div');
  el.className = 'hpop';
  el.innerHTML = html;
  document.body.appendChild(el);
  const r = anchor?.getBoundingClientRect();
  el.style.top = (r ? r.bottom + 8 : 60) + 'px';
  el.style.right = '12px';
  const off = (ev) => { if (!el.contains(ev.target) && !anchor?.contains(ev.target)) { el.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
  onMount?.(el);
  return el;
}
const fmtWhen = (t) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function pinsModal() {
  const anchor = $('#pins');
  if ($('.hpop[data-k=pins]')) return closePops();
  const d = await api(`/channels/${S.channel.id}/pins`);
  const el = hpop(anchor, `<div class="hp-head">${ic('pin')}<b>Закреплённые сообщения</b></div>
    <div class="hp-body">${d.messages.length ? d.messages.map((m) => `<div class="pin-row" data-jump="${m.id}"><div><b>${esc(m.username)}</b> <span class="muted small">${fmtWhen(m.created_at)}</span></div><div>${esc((m.content || m.att_name || '').slice(0, 300))}</div></div>`).join('')
      : `<div class="hp-empty">${ic('pin')}<b>В этом канале нет закреплённых сообщений… пока что.</b></div>`}</div>
    <div class="hp-foot"><b>Подсказка:</b> пользователи с правом на управление сообщениями могут закреплять сообщения через значок булавки на сообщении.</div>`);
  el.dataset.k = 'pins';
  el.querySelector('.hp-body').onclick = (e) => {
    const j = e.target.closest('[data-jump]'); if (!j) return;
    const t = document.querySelector(`#msgs .msg[data-id="${j.dataset.jump}"]`);
    if (t) { closePops(); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 1300); }
  };
}

// ---- ветки
async function threadsPopover() {
  const anchor = $('#threads');
  if ($('.hpop[data-k=threads]')) return closePops();
  const cid = S.channel.id;
  const el = hpop(anchor, `<div class="hp-head">${ic('thread')}<b>Ветки</b><div class="search-box hp-search">${ic('search')}<input id="th-q" placeholder="Поиск по названию ветки" autocomplete="off"></div></div><div class="hp-body" id="th-list"></div>`);
  el.dataset.k = 'threads';
  const draw = async (q = '') => {
    const d = await api(`/channels/${cid}/threads?q=${encodeURIComponent(q)}`);
    el.querySelector('#th-list').innerHTML = d.threads.length ? d.threads.map((t) => `<div class="pin-row" data-t="${t.id}"><div><b>${esc(t.username)}</b> <span class="muted small">${plural(t.replies, 'ответ', 'ответа', 'ответов')} · ${fmtWhen(t.last_at)}</span></div><div>${esc(t.title)}</div></div>`).join('')
      : `<div class="hp-empty">${ic('thread')}<b>Нет веток.</b><div class="muted">Не отвлекайся от беседы: наведи на сообщение и нажми значок ветки, чтобы обсудить его отдельно.</div></div>`;
  };
  await draw();
  let tm; el.querySelector('#th-q').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => draw(e.target.value), 200); };
  el.querySelector('#th-list').onclick = (e) => { const t = e.target.closest('[data-t]'); if (t) { closePops(); openMsgThread(Number(t.dataset.t)); } };
}

function closeThreadPanel() { $('#thread-panel')?.remove(); S.thread = null; }
const tmsgHtml = (m) => `<div class="tmsg" data-id="${m.id}">${avatar(m.username, 32)}<div class="grow"><div><a href="#" data-user="${esc(m.username)}"${m.role_color ? ` style="color:${m.role_color}"` : ''}><b>${esc(m.username)}</b></a> <span class="muted small">${fmtWhen(m.created_at)}</span>${m.user_id === S.user.id || can(PERM.MESSAGES) ? `<button class="icon-btn tdel" data-del="${m.id}" aria-label="Удалить">${ic('trash')}</button>` : ''}</div>
  <div class="tbody">${m.content ? linkify(m.content) : ''}${m.att_key && m.att_type?.startsWith('image/') ? `<img class="att" src="${fileUrl(m.att_key)}" alt="">` : ''}</div></div></div>`;

async function openMsgThread(rootId) {
  closePops();
  const d = await api(`/messages/${rootId}/thread`);
  closeThreadPanel();
  S.thread = { id: rootId, channel: d.root.channel_id };
  const el = document.createElement('aside');
  el.id = 'thread-panel'; el.className = 'thread-panel';
  el.innerHTML = `<div class="hp-head">${ic('thread')}<b class="grow">Ветка</b><button class="icon-btn" id="tp-x" aria-label="Закрыть">${ic('close')}</button></div>
    <div class="tp-root">${tmsgHtml(d.root)}</div><div class="tp-count muted small">${d.messages.length ? `${plural(d.messages.length, 'ответ', 'ответа', 'ответов')}` : 'Ответов пока нет'}</div>
    <div class="tp-list" id="tp-list">${d.messages.map(tmsgHtml).join('')}</div>
    <div class="tp-composer"><textarea id="tp-in" rows="1" placeholder="Ответить в ветке"></textarea><button id="tp-send" aria-label="Отправить">${ic('send')}</button></div>`;
  document.body.appendChild(el);
  const list = el.querySelector('#tp-list'); list.scrollTop = list.scrollHeight;
  el.querySelector('#tp-x').onclick = closeThreadPanel;
  const send = async () => {
    const ta = el.querySelector('#tp-in'); const content = ta.value; if (!content.trim()) return;
    ta.value = '';
    try { await api(`/channels/${S.thread.channel}/messages`, { body: { content, thread_id: S.thread.id } }); } catch (er) { toast(er.message); ta.value = content; }
  };
  el.querySelector('#tp-send').onclick = send;
  el.querySelector('#tp-in').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  el.onclick = async (e) => { const x = e.target.closest('[data-del]'); if (x) await api(`/messages/${x.dataset.del}`, { method: 'DELETE' }); };
  el.querySelector('#tp-in').focus();
}
function onThreadMessage(m) {
  const root = S.msgs[m.thread_id];
  if (root) { root.thread_count = (root.thread_count || 0) + 1; rerenderMsg(root); }
  if (S.thread?.id === m.thread_id) {
    const list = $('#tp-list'); if (!list) return;
    list.insertAdjacentHTML('beforeend', tmsgHtml(m)); list.scrollTop = list.scrollHeight;
    const c = $('#thread-panel .tp-count'); if (c) { const n = list.children.length; c.textContent = `${plural(n, 'ответ', 'ответа', 'ответов')}`; }
  }
}

// ---- контекстное меню пользователя (правая кнопка)
function closeCtx() { document.querySelectorAll('.ctx').forEach((x) => x.remove()); }
document.addEventListener('contextmenu', (e) => {
  const t = e.target.closest('[data-user]');
  if (!t || !S.user) return;
  e.preventDefault();
  userCtx(t.dataset.user, t.closest('.msg')?.dataset.uid, e.clientX, e.clientY, t);
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.ctx')) closeCtx(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCtx(); });
window.addEventListener('blur', closeCtx);

function userCtx(username, uidHint, x, y, anchor) {
  closeCtx();
  const m = S.server?.members?.find((u) => u.username === username);
  const id = m?.id || Number(uidHint) || S.friends?.find((f) => f.username === username)?.id || null;
  const self = username === S.user.username;
  const inServer = !!(S.server && m);
  const mine = inServer ? S.server.my_perms : 0;
  const roles = inServer && can(PERM.ROLES) ? S.server.roles.filter((r) => !(r.perms & ~mine)) : [];
  const canKick = inServer && can(PERM.KICK) && !self && m.id !== S.server.server.owner_id;
  const el = document.createElement('div');
  el.className = 'ctx';
  el.innerHTML = `<button data-c="profile">Профиль</button>
    ${S.channel && S.channel.type !== 'voice' ? '<button data-c="mention">Упомянуть</button>' : ''}
    ${!self && id ? '<button data-c="dm">Написать</button>' : ''}
    ${self && inServer ? '<button data-c="sp">Профиль на сервере</button>' : ''}
    ${roles.length ? `<hr><div class="has-sub"><button>Роли ${ic('chevron')}</button><div class="sub">${roles.map((r) => `<button data-role="${r.id}"><span style="display:flex;align-items:center"><i class="dot" style="background:${r.color || 'var(--muted)'}"></i>${esc(r.name)}</span><span class="ck ${m.role_ids.includes(r.id) ? 'on' : ''}">${m.role_ids.includes(r.id) ? '✓' : ''}</span></button>`).join('')}</div></div>` : ''}
    ${canKick ? '<hr><button class="danger" data-c="kick">Исключить</button>' : ''}
    ${id ? '<hr><button data-c="id">Копировать ID пользователя</button>' : ''}`;
  document.body.appendChild(el);
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = Math.min(x, innerWidth - w - 8) + 'px';
  el.style.top = Math.min(y, innerHeight - h - 8) + 'px';
  if (x + w + 220 > innerWidth) el.querySelectorAll('.sub').forEach((s) => { s.style.left = 'auto'; s.style.right = '100%'; s.style.marginLeft = '0'; s.style.marginRight = '4px'; });
  el.onclick = async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    const rid = b.dataset.role;
    if (rid) {
      const ids = m.role_ids.includes(Number(rid)) ? m.role_ids.filter((r) => r !== Number(rid)) : [...m.role_ids, Number(rid)];
      try { await api(`/servers/${S.server.server.id}/members/${m.id}/roles`, { method: 'PUT', body: { roles: ids } }); await reloadServer(); } catch (er) { toast(er.message); }
      return closeCtx();
    }
    const c = b.dataset.c; if (!c) return;
    closeCtx();
    if (c === 'profile') userCard(username, anchor);
    else if (c === 'mention') { const i = $('#inp'); if (i) { i.value += (i.value && !i.value.endsWith(' ') ? ' ' : '') + '@' + username + ' '; i.focus(); } }
    else if (c === 'sp') serverProfileModal();
    else if (c === 'dm') { const r = await api('/dms', { body: { userId: id } }); await refreshHome?.(); openChannel({ id: r.id, name: r.username, type: 'dm' }); }
    else if (c === 'id') { try { await navigator.clipboard.writeText(String(id)); toast('ID скопирован'); } catch { toast('ID: ' + id); } }
    else if (c === 'kick' && confirm('Исключить участника?')) { try { await api(`/servers/${S.server.server.id}/kick/${id}`, { method: 'POST' }); await reloadServer(); } catch (er) { toast(er.message); } }
  };
}

// клик по своему аватару/нику внизу слева — карточка профиля
document.querySelector('.me-bar')?.addEventListener('click', (e) => {
  if (e.target.closest('button') || !S.user) return;
  if (e.target.closest('#me-avatar, #me-name')) { e.stopPropagation(); userCard(S.user.username, e.target.closest('#me-avatar, #me-name')); }
});

// ---- личный профиль на сервере: свой ник
function serverProfileModal() {
  if (!S.server) return;
  const me = S.server.members.find((x) => x.id === S.user.id);
  const sv = S.server.server;
  modal(`<h3>Профиль на сервере</h3><div class="muted">Ник виден только на сервере «${esc(sv.name)}»: в чате, списке участников и упоминаниях. Остальным по-прежнему доступен твой основной ник <b>${esc(S.user.username)}</b>.</div>
    <label class="sx-l">Ник на сервере</label><input id="sp-nick" maxlength="32" placeholder="${esc(S.user.username)}" value="${esc(me?.nick || '')}">
    <div class="error" id="sp-err"></div>
    <div class="row-btns"><button class="ghost" id="sp-reset">Сбросить до общего</button><button id="sp-save">Сохранить</button></div>`, (c) => {
    const save = async (nick) => {
      try {
        await api(`/servers/${sv.id}/me`, { method: 'PATCH', body: { nick } });
        closeModal(); await reloadServer(); if (S.channel && S.channel.type !== 'voice') openChannel(S.channel); toast(nick ? 'Ник сохранён' : 'Ник сброшен');
      } catch (er) { c.querySelector('#sp-err').textContent = er.message; }
    };
    c.querySelector('#sp-save').onclick = () => save(c.querySelector('#sp-nick').value);
    c.querySelector('#sp-reset').onclick = () => save('');
    c.querySelector('#sp-nick').onkeydown = (e) => { if (e.key === 'Enter') save(e.target.value); };
    c.querySelector('#sp-nick').focus();
  });
}
