// earth's network — лента, посты, профили

function setLayout(withRight) { $('#app').classList.toggle('no-members', !withRight || (S.view.type === 'server' && !!S.prefs.hideMembers)); }

function timeAgo(t) {
  const d = (Date.now() - t) / 1000;
  if (d < 45) return 'Только что';
  if (d < 3600) return Math.round(d / 60) + ' мин';
  if (d < 86400) return Math.round(d / 3600) + ' ч';
  if (d < 7 * 86400) return Math.round(d / 86400) + ' д';
  return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function mediaHtml(p) {
  if (!p.att_key || !S.config.files) return '';
  const u = fileUrl(p.att_key), t = p.att_type || '';
  if (t.startsWith('image/')) return `<img class="post-media" src="${u}" alt="" loading="lazy">`;
  if (t.startsWith('video/')) return `<video class="post-media" src="${u}" controls preload="metadata" playsinline></video>`;
  return `<a class="file" href="${u}" target="_blank" download="${esc(p.att_name)}">${ic('file')} ${esc(p.att_name)}</a>`;
}
function pollHtml(p) {
  const q = p.poll;
  if (!q) return '';
  const voted = q.my_vote != null;
  return `<div class="poll">${q.options.map((o) => {
    const pct = q.total ? Math.round((o.votes * 100) / q.total) : 0;
    return `<button class="opt ${q.my_vote === o.id ? 'mine' : ''}" data-vote="${o.id}"><span class="bar" style="width:${voted ? pct : 0}%"></span><span class="t">${esc(o.text)}</span>${voted ? `<span class="pct">${pct}%</span>` : ''}</button>`;
  }).join('')}<div class="muted small">${plural(q.total, 'голос', 'голоса', 'голосов')}</div></div>`;
}
function quoteHtml(q) {
  if (q.deleted) return '<div class="quote-embed muted">Пост удалён</div>';
  return `<div class="quote-embed" data-open="${q.id}">${avatar(q.username, 20)}<b>${esc(q.username)}</b> <span class="muted">${timeAgo(q.created_at)}</span>
    <div class="post-text">${linkify(q.content, true)}</div>${mediaHtml(q)}</div>`;
}

function postHtml(p, opts = {}) {
  const mine = p.user_id === S.user.id;
  const open = opts.open === false ? '' : 'tabindex="0"';
  if (!p.content && p.quote && !p.att_key) {
    // чистый репост
    return `<article class="post repost" data-post="${p.id}" data-open="${p.quote_id}" ${open}>
      <div class="repost-head">${ic('repost')} <a href="#" data-user="${esc(p.username)}">${esc(p.username)}</a> репостнул${mine ? ' · <a href="#" data-act="del">Убрать</a>' : ''}</div>
      ${quoteHtml(p.quote)}</article>`;
  }
  return `<article class="post ${opts.reply ? 'reply' : ''}" data-post="${p.id}" ${open}>
    <div class="post-av clickable" data-user="${esc(p.username)}">${avatar(p.username, 40)}</div>
    <div class="post-main">
      ${p.pinned ? `<div class="muted small pin-line">${ic('pin')} закреплено</div>` : ''}
      <div class="post-head"><a class="post-name" href="#" data-user="${esc(p.username)}">${esc(p.username)}</a>
        ${p.server_name ? `<span class="chip">${esc(p.server_name)}</span>` : ''}<span class="muted">${timeAgo(p.created_at)}</span>
        <button class="icon-btn post-more" data-act="more" aria-label="Ещё">${ic('more')}</button></div>
      ${p.content ? `<div class="post-text">${linkify(p.content, true)}</div>` : ''}
      ${mediaHtml(p)}${pollHtml(p)}${p.quote ? quoteHtml(p.quote) : ''}
      <div class="post-actions">
        <button class="act" data-act="open" aria-label="Ответы">${ic('comment')}<span>${p.replies || ''}</span></button>
        <button class="act rp ${p.reposted ? 'on' : ''}" data-act="repost" aria-pressed="${!!p.reposted}" aria-label="Репост или цитата" title="Репост или цитата">${ic('repost')}<span>${p.reposts || ''}</span></button>
        <button class="act like ${p.liked ? 'on' : ''}" data-act="like" aria-pressed="${p.liked}" aria-label="Нравится">${ic('heart')}<span>${p.likes || ''}</span></button>
      </div>
    </div></article>`;
}

// ---- композер
function composerHtml(placeholder, btn, o = {}) {
  const mine = S.servers.filter((s) => s.owner_id === S.user.id);
  return `<form class="post-composer ${o.open ? 'open' : ''}" id="pc">${avatar(S.user.username, 40)}
    <div class="pc-body"><textarea id="pc-text" rows="1" maxlength="1000" placeholder="${placeholder}"></textarea>
    <div id="pc-extra"></div>
    <div class="pc-foot"><div class="pc-tools">
      ${o.attach === false ? '' : `<button type="button" class="icon-btn" id="pc-img" title="${S.config.files ? 'Фото или видео' : 'Файлы пока отключены'}" aria-label="Фото или видео" ${S.config.files ? '' : 'disabled'}>${ic('image')}</button>`}
      ${o.poll ? `<button type="button" class="icon-btn" id="pc-poll" title="Опрос" aria-label="Опрос">${ic('poll')}</button>` : ''}
      ${o.poll && mine.length ? `<select id="pc-srv" class="mini-select" title="Публиковать от имени"><option value="">От моего имени</option>${mine.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>` : ''}
    </div><span class="muted" id="pc-count"></span><button type="submit" id="pc-send" disabled>${btn}</button></div>
    <input type="file" id="pc-file" class="hidden" accept="image/*,video/*"></div></form>`;
}

function bindComposer(onSubmit) {
  const ta = $('#pc-text'), btn = $('#pc-send');
  const st = { att: null, poll: false };
  ta.onfocus = () => $('#pc').classList.add('open');
  const sync = () => { btn.disabled = !(ta.value.trim() || st.att || (st.poll && pollValues().length >= 2)); };
  const pollValues = () => [...document.querySelectorAll('.poll-in')].map((i) => i.value.trim()).filter(Boolean);
  const drawExtra = () => {
    $('#pc-extra').innerHTML =
      (st.att ? `<div class="pending-file"><span>${esc(st.att.att_name)}</span><a href="#" id="att-x">Убрать</a></div>` : '') +
      (st.poll ? `<div class="poll-edit">${[1, 2, 3, 4].map((n) => `<input class="poll-in" maxlength="60" placeholder="Вариант ${n}${n > 2 ? ' (необязательно)' : ''}">`).join('')}</div>` : '');
    $('#att-x')?.addEventListener('click', (e) => { e.preventDefault(); st.att = null; drawExtra(); sync(); });
    document.querySelectorAll('.poll-in').forEach((i) => (i.oninput = sync));
  };
  ta.oninput = () => {
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
    $('#pc-count').textContent = ta.value.length > 800 ? `${ta.value.length}/1000` : '';
    sync();
  };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !btn.disabled) $('#pc').requestSubmit(); };
  $('#pc-img')?.addEventListener('click', () => $('#pc-file').click());
  $('#pc-file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('#pc-extra').insertAdjacentHTML('afterbegin', `<div class="pending-file" id="up">Загрузка…</div>`);
    try { st.att = await uploadFile(f); } catch (er) { toast(er.message); }
    e.target.value = ''; drawExtra(); sync();
  };
  $('#pc-poll')?.addEventListener('click', () => { st.poll = !st.poll; drawExtra(); sync(); });
  $('#pc').onsubmit = async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const extra = { ...(st.att || {}) };
    if (st.poll && pollValues().length >= 2) extra.poll = pollValues();
    const srv = $('#pc-srv')?.value;
    if (srv) extra.server_id = Number(srv);
    try {
      await onSubmit(ta.value.trim(), extra);
      ta.value = ''; ta.style.height = 'auto'; st.att = null; st.poll = false; drawExtra();
    } catch (er) { toast(er.message); }
    sync();
  };
}

// ---- боковые панели
function feedSide() {
  const pg = S.view.type === 'feed' ? S.view.page : '';
  $('#side-head').innerHTML = LOGO;
 
  const items = [['feed', 'Лента', 'globe', ['all', 'following', 'clips'].includes(pg)], ['search', 'Поиск', 'search', pg === 'search'], ['me', 'Моя страница', 'chat', pg === 'me']];
  if (S.user.is_admin) items.push(['admin', 'Жалобы', 'shield', pg === 'admin']);
  items.push(['settings', 'Настройки', 'settings', false]);
  $('#side-list').innerHTML = items.map(([k, n, i, on]) => `<div class="item ${on ? 'on' : ''}" data-feed="${k}" tabindex="0">${ic(i)} <span class="grow">${n}</span></div>`).join('');
  $('#side-list').onclick = (e) => {
    const t = e.target.closest('[data-feed]');
    if (!t) return;
    $('#app').classList.remove('show-side');
    const k = t.dataset.feed;
    if (k === 'me') openProfile(S.user.username);
    else if (k === 'search') openSearch('');
    else if (k === 'admin') openAdmin();
    else if (k === 'settings') settingsModal();
    else openFeed();
  };
  updateVoiceBar();
}

async function renderRightRail() {
  const box = $('#members');
  if (!box) return;
  const [sg, tr] = await Promise.all([api('/suggestions').catch(() => ({ users: [] })), api('/trending').catch(() => ({ tags: [] }))]);
  if (S.view.type !== 'feed') return;
  box.innerHTML = `<div class="cat">В тренде</div>` +
    (tr.tags.length ? tr.tags.map((t) => `<div class="item trend" data-tag="${esc(t.tag)}"><b>#${esc(t.tag)}</b><span class="muted small">${plural(t.n, 'пост', 'поста', 'постов')}</span></div>`).join('') : '<div class="muted small pad">Пока тихо — напиши пост с #тегом</div>') +
    `<div class="cat">Кого читать</div>` +
    (sg.users.length ? sg.users.map((u) => `<div class="item sug" data-user="${esc(u.username)}">${avatar(u.username, 32)}<span class="grow"><b>${esc(u.username)}</b></span><button class="mini" data-follow="${u.id}">Читать</button></div>`).join('') : '<div class="muted small pad">Пока некого рекомендовать</div>');
  box.onclick = async (e) => {
    const f = e.target.closest('[data-follow]');
    if (!f) return;
    e.stopPropagation();
    const r = await api(`/users/${f.dataset.follow}/follow`, { method: 'POST' });
    f.textContent = r.following ? 'Вы читаете' : 'Читать';
    f.classList.toggle('ghost', r.following);
  };
}
function feedLayout() {
  const show = !!S.prefs.rail && !S.prefs.quiet;
  setLayout(show);
  if (show) renderRightRail(); else $('#members').innerHTML = '';
}
// ---- истории
const seen = () => new Set(JSON.parse(localStorage.getItem('nc_seen') || '[]'));
async function renderStories() {
  const box = $('#stories');
  if (!box) return;
  let d;
  try { d = await api('/stories'); } catch { return; }
  const groups = [];
  for (const s of d.stories) {
    let g = groups.find((x) => x.uid === s.user_id);
    if (!g) groups.push((g = { uid: s.user_id, username: s.username, items: [] }));
    g.items.push(s);
  }
  groups.sort((a, b) => (a.uid === S.user.id ? -1 : b.uid === S.user.id ? 1 : 0));
  S.storyGroups = groups;
  const sn = seen();
  const mineG = groups.find((g) => g.uid === S.user.id);
  box.innerHTML = `<button class="story add" data-story-add title="Добавить историю"><span class="ring">${avatar(S.user.username, 52)}<i class="plus">${ic('plus')}</i></span><span>Ваша</span></button>` +
    groups.map((g, i) => {
      const unseen = g.items.some((x) => !sn.has(x.id));
      return `<button class="story" data-story="${i}"><span class="ring ${unseen ? 'new' : ''}">${avatar(g.username, 52)}</span><span>${g.uid === S.user.id ? 'Мои' : esc(g.username)}</span></button>`;
    }).join('');
  box.onclick = (e) => {
    if (e.target.closest('[data-story-add]')) return storyModal();
    const b = e.target.closest('[data-story]');
    if (b) openStory(Number(b.dataset.story));
  };
}
function storyModal() {
  modal(`<h3>Новая история</h3><div class="muted small">Исчезнет через 24 часа</div>
    <textarea id="st-text" rows="3" maxlength="300" placeholder="Что происходит?"></textarea>
    <div id="st-att" class="muted small"></div>
    <select id="st-vis"><option value="all">Видят все, кто на меня подписан</option><option value="close">Только близкие друзья</option></select>
    <div class="error" id="m-err"></div>
    <div class="modal-actions">${S.config.files ? `<button class="ghost" id="st-file">${ic('image')} фото/видео</button>` : ''}<button class="ghost" id="m-cancel">Отмена</button><button id="m-ok">Опубликовать</button></div>
    <input type="file" id="st-in" class="hidden" accept="image/*,video/*">`, (c) => {
    let att = null;
    c.querySelector('#m-cancel').onclick = closeModal;
    c.querySelector('#st-file')?.addEventListener('click', () => c.querySelector('#st-in').click());
    c.querySelector('#st-in').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      c.querySelector('#st-att').textContent = 'Загрузка…';
      try { att = await uploadFile(f); c.querySelector('#st-att').textContent = att.att_name; } catch (er) { c.querySelector('#m-err').textContent = er.message; }
    };
    c.querySelector('#m-ok').onclick = async () => {
      try {
        await api('/stories', { body: { content: c.querySelector('#st-text').value, visibility: c.querySelector('#st-vis').value, ...(att || {}) } });
        closeModal(); renderStories();
      } catch (er) { c.querySelector('#m-err').textContent = er.message; }
    };
  });
}
let storyTimer;
function openStory(gi, ii = 0) {
  const g = S.storyGroups?.[gi];
  if (!g) return closeStory();
  const s = g.items[ii];
  const sn = seen(); sn.add(s.id); localStorage.setItem('nc_seen', JSON.stringify([...sn].slice(-300)));
  let el = $('#story-view');
  if (!el) { el = document.createElement('div'); el.id = 'story-view'; el.className = 'story-view'; document.body.appendChild(el); }
  const media = s.att_key && S.config.files ? ((s.att_type || '').startsWith('video/') ? `<video src="${fileUrl(s.att_key)}" autoplay playsinline muted loop></video>` : `<img src="${fileUrl(s.att_key)}" alt="">`) : '';
  el.innerHTML = `<div class="story-card"><div class="story-bars">${g.items.map((_, k) => `<i class="${k < ii ? 'done' : k === ii ? 'cur' : ''}"></i>`).join('')}</div>
    <div class="story-top">${avatar(g.username, 32)}<b>${esc(g.username)}</b><span class="muted">${timeAgo(s.created_at)}</span>${s.visibility === 'close' ? `<span class="chip">${ic('star')} близкие</span>` : ''}
      ${g.uid === S.user.id ? `<button class="icon-btn" id="sv-del" aria-label="Удалить">${ic('trash')}</button>` : ''}<button class="icon-btn" id="sv-x" aria-label="Закрыть">${ic('close')}</button></div>
    ${media}${s.content ? `<div class="story-text ${media ? 'over' : ''}">${linkify(s.content)}</div>` : ''}
    <div class="story-nav"><span data-nav="-1"></span><span data-nav="1"></span></div></div>`;
  const next = (d) => {
    clearTimeout(storyTimer);
    const ni = ii + d;
    if (ni < 0) return openStory(Math.max(0, gi - 1));
    if (ni >= g.items.length) return gi + 1 < S.storyGroups.length ? openStory(gi + 1) : closeStory();
    openStory(gi, ni);
  };
  el.querySelector('.story-bars .cur').style.animationDuration = '5s';
  clearTimeout(storyTimer); storyTimer = setTimeout(() => next(1), 5000);
  el.onclick = (e) => {
    if (e.target.closest('#sv-x') || e.target === el) return closeStory();
    if (e.target.closest('#sv-del')) { api(`/stories/${s.id}`, { method: 'DELETE' }).then(() => { closeStory(); renderStories(); }); return; }
    if (e.target.closest('[data-user]')) return;
    const n = e.target.closest('[data-nav]');
    if (n) next(Number(n.dataset.nav));
  };
}
function closeStory() { clearTimeout(storyTimer); $('#story-view')?.remove(); renderStories(); }

// ---- лента
async function openFeed(tab) {
  closeWs();
  S.feedTab = tab || (['all', 'following', 'clips'].includes(S.feedTab) ? S.feedTab : 'all');
  S.view = { type: 'feed', page: S.feedTab };
  S.channel = null;
  feedLayout();
  renderRail(); feedSide();
  $('#app').classList.remove('show-side');
  $('#main-head').innerHTML = `${burger()}<div class="tabs">${[['all', 'Для вас'], ['following', 'Подписки'], ['clips', 'Клипы']].map(([k, n]) => `<button class="${S.feedTab === k ? 'on' : ''}" data-ftab="${k}">${n}</button>`).join('')}</div>`;
  $('#main-head').onclick = (e) => { const t = e.target.closest('[data-ftab]'); if (t) openFeed(t.dataset.ftab); else burgerClick(e); };
  const v = $('#view');
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  const clips = S.feedTab === 'clips';
  v.innerHTML = `<div class="feed" id="feed">${clips ? '' : '<div class="stories" id="stories"></div>' + composerHtml('Что нового?', 'Опубликовать', { poll: true })}
    ${clips ? '<div class="empty small-empty"><span class="muted">Клипы — последние секунды демонстрации экрана из голосовых каналов</span></div>' : ''}
    <div id="posts"><div class="empty">Загрузка…</div></div></div>`;
  if (!clips) {
    bindComposer(async (content, extra) => {
      const d = await api('/posts', { body: { content, ...extra } });
      const box = $('#posts');
      box.querySelector('.empty')?.remove();
      box.insertAdjacentHTML('afterbegin', postHtml(d.post));
    });
    renderStories();
  }
  bindPostEvents(v, () => openFeed(S.feedTab));
  await loadPosts(`/feed?tab=${S.feedTab}`, $('#posts'), S.feedTab);
}

async function loadPosts(path, box, kind, first = true) {
  const { posts } = await api(path);
  if ((S.view.type !== 'feed' && kind !== 'server') || !box.isConnected) return;
  const html = posts.map((p) => postHtml(p)).join('');
  if (first) {
    box.innerHTML = html || `<div class="empty"><b>${kind === 'following' ? 'В подписках пока пусто' : kind === 'clips' ? 'Клипов пока нет' : 'Здесь пока тихо'}</b>${kind === 'following' ? 'Подпишись на людей, зайдя в их профиль' : kind === 'clips' ? 'Включи показ экрана в голосовом канале и нажми «клип»' : 'Напиши первый пост'}</div>`;
  } else box.insertAdjacentHTML('beforeend', html);
  box.querySelector('.more')?.remove();
  if (posts.length >= 30) {
    const last = posts[posts.length - 1].id;
    box.insertAdjacentHTML('beforeend', `<button class="ghost more">Показать ещё</button>`);
    box.querySelector('.more').onclick = () => loadPosts(path.replace(/&before=\d+/, '') + `&before=${last}`, box, kind, false);
  }
}

function showPop(btn, items) {
  document.querySelector('.pop')?.remove();
  const pop = document.createElement('div');
  pop.className = 'pop menu-pop';
  pop.innerHTML = items.map(([k, label, i]) => `<button data-k="${k}">${ic(i)} ${label}</button>`).join('');
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + 'px';
  pop.style.top = Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px';
  setTimeout(() => document.addEventListener('click', () => pop.remove(), { once: true }), 0);
  return new Promise((res) => { pop.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) res(b.dataset.k); }; });
}

function bindPostEvents(root, refresh) {
  root.onclick = async (e) => {
    if (e.target.closest('[data-user],[data-tag]')) return;
    const vote = e.target.closest('[data-vote]');
    const art = e.target.closest('.post');
    if (!art) return;
    const id = Number(art.dataset.post);
    if (vote) {
      const r = await api(`/posts/${id}/vote`, { body: { option_id: Number(vote.dataset.vote) } });
      const tmp = document.createElement('div');
      tmp.innerHTML = pollHtml({ poll: r.poll });
      art.querySelector('.poll').replaceWith(tmp.firstElementChild);
      return;
    }
    const btn = e.target.closest('[data-act]');
    const act = btn?.dataset.act;
    if (act === 'like') {
      const on = !btn.classList.contains('on');
      const cnt = btn.querySelector('span');
      btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on);
      cnt.textContent = Math.max(0, (Number(cnt.textContent) || 0) + (on ? 1 : -1)) || '';
      try { const r = await api(`/posts/${id}/like`, { method: 'POST' }); cnt.textContent = r.likes || ''; btn.classList.toggle('on', r.liked); }
      catch { btn.classList.toggle('on', !on); }
      return;
    }
    if (act === 'repost') {
      e.preventDefault();
      const k = await showPop(btn, [['repost', btn.classList.contains('on') ? 'Убрать репост' : 'Репост', 'repost'], ['quote', 'Цитата', 'quote']]);
      if (k === 'quote') return quoteModal(id, refresh);
      const r = await api(`/posts/${id}/repost`, { method: 'POST' });
      btn.classList.toggle('on', r.reposted); btn.querySelector('span').textContent = r.reposts || '';
      toast(r.reposted ? 'Репост опубликован' : 'Репост убран');
      return;
    }
    if (act === 'more') {
      e.preventDefault();
      const post = (S.postCache || {})[id];
      const mine = art.querySelector('.post-name')?.textContent === S.user.username;
      const items = [['share', 'Отправить в чат', 'share'], ['copy', 'Скопировать ссылку', 'share']];
      if (mine && !art.classList.contains('reply')) items.push(['pin', 'Закрепить / открепить', 'pin']);
      if (mine || S.user.is_admin) items.push(['del', 'Удалить', 'trash']);
      if (!mine) items.push(['report', 'Пожаловаться', 'flag']);
      const k = await showPop(btn, items);
      if (k === 'share') return shareModal(id);
      if (k === 'copy') { navigator.clipboard?.writeText(`${location.origin}/?post=${id}`); toast('Ссылка скопирована'); }
      if (k === 'pin') { const r = await api(`/posts/${id}/pin`, { method: 'POST' }); toast(r.pinned ? 'Закреплено в профиле' : 'Откреплено'); }
      if (k === 'report') reportModal('post', id);
      if (k === 'del') await delPost(id, art, root, refresh);
      return;
    }
    if (act === 'del') { e.preventDefault(); return delPost(id, art, root, refresh); }
    if (e.target.closest('a, video, .poll-edit')) return;
    const target = art.dataset.open ? Number(art.dataset.open) : e.target.closest('[data-open]') ? Number(e.target.closest('[data-open]').dataset.open) : id;
    if (!art.classList.contains('reply') || target !== id) openThread(target);
  };
  root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.classList?.contains('post')) openThread(Number(e.target.dataset.open || e.target.dataset.post)); };
}
async function delPost(id, art, root, refresh) {
  if (!confirm('Удалить пост?')) return;
  await api(`/posts/${id}`, { method: 'DELETE' });
  art.classList.add('gone');
  setTimeout(() => { if (art.classList.contains('reply') || root.querySelector('[data-thread]')) refresh(); else art.remove(); }, 250);
}

function quoteModal(id, refresh) {
  modal(`<h3>Цитата</h3><textarea id="q-text" rows="3" maxlength="1000" placeholder="Твой комментарий"></textarea>
    <div class="error" id="m-err"></div><div class="modal-actions"><button class="ghost" id="m-cancel">Отмена</button><button id="m-ok">Опубликовать</button></div>`, (c) => {
    c.querySelector('#q-text').focus();
    c.querySelector('#m-cancel').onclick = closeModal;
    c.querySelector('#m-ok').onclick = async () => {
      if (!c.querySelector('#q-text').value.trim()) return;
      try { await api('/posts', { body: { content: c.querySelector('#q-text').value, quote_id: id } }); closeModal(); toast('Опубликовано'); refresh?.(); }
      catch (er) { c.querySelector('#m-err').textContent = er.message; }
    };
  });
}

async function shareModal(id) {
  modal(`<h3>Отправить в чат</h3><input id="sh-note" placeholder="Добавь комментарий (необязательно)"><div class="share-list" id="sh-list"><div class="muted">Загрузка…</div></div>
    <div class="modal-actions"><button class="ghost" id="m-cancel">Закрыть</button></div>`, async (c) => {
    c.querySelector('#m-cancel').onclick = closeModal;
    const details = await Promise.all(S.servers.map((s) => api(`/servers/${s.id}`).catch(() => null)));
    const rows = S.dms.map((d) => ({ id: d.id, label: '@' + d.username })).concat(
      details.filter(Boolean).flatMap((d) => d.channels.filter((x) => x.type === 'text').map((x) => ({ id: x.id, label: `${d.server.name} · #${x.name}` }))));
    const list = c.querySelector('#sh-list');
    list.innerHTML = rows.length ? rows.map((r) => `<button class="ghost share-row" data-cid="${r.id}">${esc(r.label)}</button>`).join('') : '<div class="muted">Нет чатов — создай сервер или начни лс</div>';
    list.onclick = async (e) => {
      const b = e.target.closest('[data-cid]');
      if (!b) return;
      const note = c.querySelector('#sh-note').value.trim();
      await api(`/channels/${b.dataset.cid}/messages`, { body: { content: (note ? note + '\n' : '') + `${location.origin}/?post=${id}` } });
      b.innerHTML = `${ic('check')} отправлено`; b.disabled = true;
    };
  });
}

async function openThread(id) {
  const v = $('#view');
  const prev = S.view;
  S.view = { type: 'feed', page: prev.page || S.feedTab, profile: prev.profile };
  feedLayout(); renderRail(); feedSide();
  $('#main-head').innerHTML = `<button class="icon-btn" id="back" aria-label="Назад">${ic('back')}</button><span>Пост</span>`;
  $('#main-head').onclick = null;
  $('#back').onclick = () => (S.view.profile ? openProfile(S.view.profile) : openFeed(S.feedTab));
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = '<div class="feed"><div class="empty">Загрузка…</div></div>';
  let d;
  try { d = await api(`/posts/${id}`); } catch (e) { v.innerHTML = `<div class="empty"><b>${esc(e.message)}</b></div>`; return; }
  v.innerHTML = `<div class="feed" data-thread="${id}">${postHtml(d.post, { open: false }).replace('class="post "', 'class="post big"')}
    ${composerHtml(`Ответить ${esc(d.post.username)}`, 'Ответить')}
    <div id="replies">${d.replies.map((r) => postHtml(r, { reply: true, open: false })).join('')}</div></div>`;
  bindComposer(async (content, extra) => {
    const r = await api('/posts', { body: { content, parent_id: id, ...extra } });
    $('#replies').insertAdjacentHTML('beforeend', postHtml(r.post, { reply: true, open: false }));
  });
  bindPostEvents(v, () => openThread(id));
}

// ---- профиль
async function openProfile(username) {
  closeWs(); feedLayout();
  S.channel = null;
  S.view = { type: 'feed', page: username === S.user.username ? 'me' : '', profile: username };
  renderRail(); feedSide();
  $('#app').classList.remove('show-side');
  $('#main-head').innerHTML = `${burger()}<span>${esc(username)}</span>`;
  $('#main-head').onclick = burgerClick;
  const v = $('#view');
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = '<div class="feed"><div class="empty">Загрузка…</div></div>';
  let d;
  try { d = await api(`/users/${encodeURIComponent(username)}`); } catch (e) { v.innerHTML = `<div class="empty"><b>${esc(e.message)}</b></div>`; return; }
  const u = d.user;
  v.innerHTML = `<div class="feed"><div class="profile"><div class="pr-banner" style="background:${u.banner || colorOf(u.username)}"></div>${avatar(u.username, 80, d.online)}
    <div class="pr-main"><h2>${esc(u.username)}</h2>${u.status ? `<div class="pr-status">${esc(u.status)}</div>` : ''}
      ${u.bio ? `<div class="bio">${linkify(u.bio, true)}</div>` : ''}
      <div class="muted"><span id="pr-followers">${d.followers}</span> подписчиков · ${d.following} подписок${d.online ? ' · в сети' : ''}</div>
      <div class="muted">С нами с ${new Date(u.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</div></div>
    <div class="pr-btns">${d.is_me ? `<button class="ghost" id="pr-edit">${ic('edit')} изменить</button>` :
      `<button id="pr-follow" class="${d.is_following ? 'ghost' : ''}">${d.is_following ? 'Вы подписаны' : 'Подписаться'}</button><button class="ghost" id="pr-dm">Написать</button>
       <button class="ghost ${d.is_close ? 'on' : ''}" id="pr-close" title="Близкие друзья видят твои закрытые истории">${ic('star')}</button><button class="icon-btn" id="pr-report" aria-label="Пожаловаться">${ic('flag')}</button>`}</div></div>
    <div id="posts">${d.pinned ? postHtml(d.pinned) : ''}${d.posts.length || d.pinned ? d.posts.map((p) => postHtml(p)).join('') : '<div class="empty"><b>Постов пока нет</b></div>'}</div></div>`;
  bindPostEvents(v, () => openProfile(username));
  $('#pr-follow')?.addEventListener('click', async (e) => {
    const r = await api(`/users/${u.id}/follow`, { method: 'POST' });
    e.currentTarget.textContent = r.following ? 'Вы подписаны' : 'Подписаться';
    e.currentTarget.classList.toggle('ghost', r.following);
    $('#pr-followers').textContent = r.followers;
    renderRightRail();
  });
  $('#pr-close')?.addEventListener('click', async (e) => {
    const r = await api(`/close-friends/${u.id}`, { method: 'POST' });
    e.currentTarget.classList.toggle('on', r.is_close);
    toast(r.is_close ? 'Добавлен в близкие друзья' : 'Убран из близких друзей');
  });
  $('#pr-report')?.addEventListener('click', () => reportModal('user', u.id));
  $('#pr-dm')?.addEventListener('click', async () => {
    const r = await api('/dms', { body: { userId: u.id } });
    await openHome(); await refreshHome(); openChannel({ id: r.id, name: r.username, type: 'dm' });
  });
  $('#pr-edit')?.addEventListener('click', () => settingsModal('profile'));
}

// ---- лента внутри сервера
async function openServerFeed() {
  if (!S.server) return;
  const { server } = S.server;
  const owner = can(PERM.SERVER);
  closeWs(); S.channel = null; S.serverFeed = true;
  setLayout(true); renderServerSide(); renderRail();
  $('#main-head').innerHTML = `${burger()}<span class="muted">${ic('globe')}</span> <span class="grow">Лента · ${esc(server.name)}</span>`;
  $('#main-head').onclick = burgerClick;
  const v = $('#view');
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = `<div class="feed">${owner ? composerHtml(`Новость от имени «${esc(server.name)}»`, 'Опубликовать', { open: false }) : ''}<div id="posts"><div class="empty">Загрузка…</div></div></div>`;
  if (owner) bindComposer(async (content, extra) => {
    const d = await api('/posts', { body: { content, ...extra, server_id: server.id } });
    const box = $('#posts'); box.querySelector('.empty')?.remove();
    box.insertAdjacentHTML('afterbegin', postHtml(d.post));
  });
  bindPostEvents(v, () => openServerFeed());
  await loadPosts(`/feed?tab=server&server_id=${server.id}`, $('#posts'), 'server');
  const box = $('#posts');
  if (box && box.querySelector('.empty b')) box.querySelector('.empty').innerHTML = `<b>Здесь пока тихо</b>${owner ? 'Опубликуй первую новость сервера' : 'Владелец сервера ещё ничего не публиковал'}`;
}
