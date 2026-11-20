// ---- настройки в стиле Discord: окно на весь экран, меню слева, панель «несохранённые изменения»

function closeShell(force) {
  const el = $('#sx');
  if (!el) return;
  if (el._dirty && !force) {
    const bar = el.querySelector('#sx-bar');
    bar.classList.remove('shake'); void bar.offsetWidth; bar.classList.add('shake');
    return;
  }
  el.classList.add('out');
  setTimeout(() => el.remove(), 240);
}

function shell({ head, tabs, start }) {
  $('#sx')?.remove();
  const el = document.createElement('div');
  el.id = 'sx'; el.className = 'sx';
  el.innerHTML = `<nav class="sx-nav"><div class="sx-nav-in"><div class="sx-head">${head}</div>${tabs.map((t) => t.sep ? '<div class="sx-sep"></div>' :
    `<button class="sx-tab ${t.danger ? 'danger' : ''}" data-t="${t.id}">${t.label}</button>`).join('')}</div></nav>
    <section class="sx-main"><div class="sx-in" id="sx-in"></div>
    <button class="sx-x" id="sx-x" aria-label="Закрыть">${ic('close')}<span>Esc</span></button></section>
    <div class="sx-bar" id="sx-bar"><span class="grow">Осторожно — есть несохранённые изменения</span><button class="ghost" id="sx-reset">Сбросить</button><button id="sx-save">Сохранить</button></div>`;
  document.body.appendChild(el);
  const bar = el.querySelector('#sx-bar');
  let cur = null, saveFn = null, resetFn = null;
  const ctx = {
    el, close: () => closeShell(true),
    dirty(save, reset) { saveFn = save; resetFn = reset; el._dirty = true; bar.classList.add('show'); },
    clean() { saveFn = resetFn = null; el._dirty = false; bar.classList.remove('show'); },
  };
  const go = (id) => {
    const t = tabs.find((x) => x.id === id);
    if (!t) return;
    if (t.action) return t.action(ctx);
    if (id === cur) return;
    if (el._dirty) return closeShell();
    cur = id;
    el.querySelectorAll('.sx-tab').forEach((b) => b.classList.toggle('on', b.dataset.t === id));
    const box = el.querySelector('#sx-in');
    box.classList.remove('enter'); void box.offsetWidth; box.classList.add('enter');
    box.innerHTML = '';
    el.querySelector('.sx-main').scrollTop = 0;
    t.render(box, ctx);
  };
  ctx.go = go;
  el.querySelector('.sx-nav').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) go(b.dataset.t); };
  el.querySelector('#sx-x').onclick = () => closeShell();
  el.querySelector('#sx-reset').onclick = () => { const r = resetFn; ctx.clean(); r?.(); };
  el.querySelector('#sx-save').onclick = async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    try { await saveFn?.(); } finally { b.disabled = false; }
  };
  go(start || tabs.find((t) => t.render).id);
  return ctx;
}

const NEON = ['#39ff14', '#00e5ff', '#ff2bd6', '#fffb00', '#ff3131', '#7c4dff', '#ff9100', '#00ffa3'];
const PASTEL = ['#ffd1dc', '#c7ceea', '#b5ead7', '#fdfd96', '#ffdac1', '#e2f0cb', '#cdb4f6', '#a8d8ea'];
const GRADS = ['g:#ff512f,#dd2476', 'g:#4776e6,#8e54e9', 'g:#00c6ff,#0072ff', 'g:#11998e,#38ef7d', 'g:#f7971e,#ffd200', 'g:#ee0979,#ff6a00', 'g:#232526,#6b6b6b', 'g:#fc00ff,#00dbde'];
const SX_COLORS = ['#000000', '#3a3a3a', '#8a8a8a', '#e8e8e8', '#e5484d', '#f76b15', '#f5c518', '#30a46c', '#0091ff', '#6e56cf', '#e93d82'];
const avHtml = (name, key, size) => `<div class="avatar ${imgOk(key) ? 'img' : ''}" style="background:${colorOf(name)};width:${size}px;height:${size}px;font-size:${size * 0.45}px">${imgOk(key) ? `<img src="${fileUrl(key)}" alt="">` : esc(name[0]?.toUpperCase() || '?')}</div>`;
const field = (label, inner, hint) => `<div class="sx-f"><label class="sx-l">${label}</label>${inner}${hint ? `<div class="muted small">${hint}</div>` : ''}</div>`;
const toggleRow = (id, title, sub, on) => `<label class="set-row"><div class="grow"><b>${title}</b>${sub ? `<div class="muted small">${sub}</div>` : ''}</div><input type="checkbox" id="${id}" ${on ? 'checked' : ''}></label>`;

// ---------- настройки пользователя
async function settingsModal(start) {
  try { S.user = { ...S.user, ...(await api('/me')).user }; } catch {}
  const u = S.user;
  const card = (name, key, banner, status, bio, x = {}) => `<div class="pcard"><div class="pc-banner" style="background:${bannerBg(banner, name)}"></div>
    <div class="pc-av">${avHtml(name, key, 84)}</div>
    <div class="pc-body"><div class="pc-name">${esc(name)}${x.pronouns ? ` <span class="pron">${esc(x.pronouns)}</span>` : ''}</div>${socialLinks(x) ? `<div class="soc-row">${socialLinks(x)}</div>` : ''}${status ? `<div class="pc-status">${esc(status)}</div>` : ''}
    ${bio ? `<div class="pc-sep"></div><div class="pc-h">О себе</div><div class="pc-bio">${esc(bio)}</div>` : ''}</div></div>`;

  shell({
    head: 'Настройки пользователя', start: start || 'account',
    tabs: [
      { id: 'account', label: 'Моя учётная запись', render: (box) => {
        box.innerHTML = `<h2>Моя учётная запись</h2>
          <div class="sx-acc"><div class="pc-banner" style="background:${bannerBg(u.banner, u.username)}"></div>
            <div class="sx-acc-row">${avHtml(u.username, u.avatar_key, 84)}<div class="grow"><div class="pc-name">${esc(u.username)}</div>${u.status ? `<div class="muted">${esc(u.status)}</div>` : ''}</div><button id="go-prof">Изменить профиль</button></div>
            <div class="sx-box">
              <div class="sx-line"><div class="grow"><div class="sx-l">Имя пользователя</div><div>${esc(u.username)}</div></div><button class="ghost" id="ch-name">Изменить</button></div>
              <div class="sx-line"><div class="grow"><div class="sx-l">Пароль</div><div>••••••••</div></div><button class="ghost" id="ch-pass">Изменить</button></div>
            </div></div>
          <div class="sx-div"></div><h3>Сессия</h3><div class="muted small">Выход закроет аккаунт только на этом устройстве.</div>
          <div><button class="danger" id="sx-out">Выйти из аккаунта</button></div>`;
        box.querySelector('#go-prof').onclick = () => box.closest('.sx').querySelector('[data-t=profile]').click();
        box.querySelector('#sx-out').onclick = () => { closeShell(true); logout(); };
        box.querySelector('#ch-name').onclick = () => accountModal('name');
        box.querySelector('#ch-pass').onclick = () => accountModal('pass');
      } },
      { id: 'profile', label: 'Профиль', render: (box, ctx) => {
        const orig = { bio: u.bio || '', status: u.status || '', banner: u.banner || '', key: u.avatar_key || '', presence: u.presence || 'online', activity: u.activity || '', music: u.music || '', ttl: '0', pronouns: u.pronouns || '', link_tg: u.link_tg || '', link_tt: u.link_tt || '', link_ig: u.link_ig || '' };
        const cur = { ...orig };
        const prev = () => card(u.username, cur.key, cur.banner, cur.status, cur.bio, { pronouns: cur.pronouns, link_tg: cur.link_tg, link_tt: cur.link_tt, link_ig: cur.link_ig });
        box.innerHTML = `<h2>Профиль</h2><div class="sx-two"><div class="sx-form">
          ${field('Аватар', `<div class="sx-av-row"><button id="av-pick">Загрузить</button><button class="ghost" id="av-del">Убрать</button></div><div class="muted small">JPG, PNG, GIF или WebP. Анимация — до 1,4 МБ.</div><input type="file" id="av-in" class="hidden" accept="image/jpeg,image/png,image/gif,image/webp">`)}
          ${field('Баннер', `<div class="sx-av-row"><button id="bn-pick">Загрузить картинку</button><button class="ghost" id="bn-del">Убрать</button></div><div class="muted small">JPG, PNG, GIF или WebP, лучше широкая. Без картинки используется цвет ниже.</div><input type="file" id="bn-in" class="hidden" accept="image/jpeg,image/png,image/gif,image/webp">`)}
          ${field('Цвет профиля', `<div id="sw">${[['Обычные', SX_COLORS], ['Неоновые', NEON], ['Пастельные', PASTEL], ['Градиенты', GRADS]].map(([t, list]) => `<div class="sw-group"><div class="muted">${t}</div><div class="sx-sw">${list.map((c) => `<button type="button" class="sw" data-c="${c}" style="background:${bannerBg(c)}" aria-label="${c}"></button>`).join('')}</div></div>`).join('')}
            <div class="sw-group"><div class="muted">Свой цвет</div><div class="sw-grad"><label class="sw custom" title="Цвет"><input type="color" id="sw-in" value="${/^#/.test(cur.banner) ? cur.banner : '#3a3a3a'}">${ic('edit')}</label>${window.EyeDropper ? '<button type="button" class="ghost mini" id="sw-drop">Пипетка</button>' : ''}<span class="muted small">или градиент:</span><input type="color" id="g1" value="#ff4d8d"><input type="color" id="g2" value="#4d6bff"><button type="button" class="ghost mini" id="g-go">Применить</button><button type="button" class="ghost mini" id="sw-reset">По умолчанию</button></div></div></div>`)}
          ${field('Местоимения', '<input id="pf-pron" maxlength="20" placeholder="например, она/её">')}
          ${field('Ссылки', `<div class="soc-edit">${[['link_tg', 'Telegram', '@ник или t.me/…'], ['link_tt', 'TikTok', '@ник или tiktok.com/@…'], ['link_ig', 'Instagram', '@ник или instagram.com/…']].map(([k, n, ph]) => `<div class="st-row"><span class="soc-n">${ic('soc_' + k.slice(5))} ${n}</span><input data-lk="${k}" maxlength="80" placeholder="${ph}"></div>`).join('')}</div>`)}
          ${field('Статус в сети', `<button type="button" class="ghost pres-b" id="pres"></button><div class="muted small">«Занят» отключает звуки и уведомления. «Невидимка» скрывает тебя из сети.</div>`)}
          ${field('Текстовый статус', `<input id="pf-status" maxlength="80" placeholder="Чем сейчас занят?"><div class="st-emoji" id="st-emoji">${['😀', '😴', '🎮', '💻', '📚', '🎧', '🍕', '🔥'].map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div><div class="st-row" style="margin-top:8px"><span class="muted small">Очистить через</span><select id="pf-ttl"><option value="0">Не очищать</option><option value="60">1 час</option><option value="240">4 часа</option><option value="1440">24 часа</option></select></div>`)}
          ${field('Играет в…', '<input id="pf-act" maxlength="40" placeholder="Название игры">', 'Показывается в карточке и в «Активных контактах».')}
          ${field('Музыка сейчас', '<input id="pf-mus" maxlength="80" placeholder="Исполнитель — трек">', 'Показывается в карточке строкой «Слушает». Очисти поле, чтобы убрать.')}
          ${field('Значки', '<div id="bdg-box" class="muted small">Загрузка…</div>', 'Нажми на полученный значок, чтобы закрепить его в карточке (до 5).')}
          ${field('О себе', '<textarea id="pf-bio" rows="4" maxlength="200" placeholder="Расскажи о себе"></textarea><div class="muted small" id="pf-cnt"></div>')}
          <div class="error" id="m-err"></div></div>
          <div class="sx-prev"><div class="sx-l">Предпросмотр</div><div id="pv">${prev()}</div></div></div>`;
        const $$ = (s) => box.querySelector(s);
        $$('#pf-status').value = cur.status; $$('#pf-bio').value = cur.bio; $$('#pf-act').value = cur.activity; $$('#pf-mus').value = cur.music; $$('#pf-pron').value = cur.pronouns; box.querySelectorAll('[data-lk]').forEach((i) => (i.value = cur[i.dataset.lk]));
        const sync = () => {
          $$('#pv').innerHTML = prev();
          $$('#pf-cnt').textContent = `${cur.bio.length} / 200`;
          box.querySelectorAll('.sw[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === (cur.banner || '').toLowerCase()));
          $$('#pres').innerHTML = `<i class="pdot ${cur.presence}"></i> ${{ online: 'Онлайн', dnd: 'Занят', invisible: 'Невидимка' }[cur.presence]} <span class="uc-chev">${ic('chevron')}</span>`;
          const changed = ['bio', 'status', 'banner', 'key', 'presence', 'activity', 'music', 'ttl', 'pronouns', 'link_tg', 'link_tt', 'link_ig'].some((k) => cur[k] !== orig[k]);
          if (changed) ctx.dirty(save, reset); else ctx.clean();
        };
        const reset = () => { Object.assign(cur, orig); $$('#pf-status').value = cur.status; $$('#pf-bio').value = cur.bio; $$('#pf-act').value = cur.activity; $$('#pf-mus').value = cur.music; $$('#pf-ttl').value = cur.ttl; $$('#pf-pron').value = cur.pronouns; box.querySelectorAll('[data-lk]').forEach((i) => (i.value = cur[i.dataset.lk])); sync(); };
        const save = async () => {
          try {
            const body = { bio: cur.bio, banner: cur.banner, presence: cur.presence, activity: cur.activity, music: cur.music, pronouns: cur.pronouns, link_tg: cur.link_tg, link_tt: cur.link_tt, link_ig: cur.link_ig };
            if (cur.status !== orig.status || cur.ttl !== orig.ttl) { body.status = cur.status; body.status_ttl = Number(cur.ttl); }
            if (cur.key !== orig.key) body.avatar_key = cur.key;
            await api('/profile', { method: 'PATCH', body });
            Object.assign(S.user, { bio: cur.bio, status: cur.status, banner: cur.banner || null, avatar_key: cur.key || null, presence: cur.presence, activity: cur.activity || null, music: cur.music || null, pronouns: cur.pronouns || null, link_tg: cur.link_tg || null, link_tt: cur.link_tt || null, link_ig: cur.link_ig || null });
            A[S.user.username] = S.user.avatar_key;
            try { Object.assign(S.user, (await api('/me')).user); } catch {}
            Object.assign(cur, { link_tg: S.user.link_tg || '', link_tt: S.user.link_tt || '', link_ig: S.user.link_ig || '' });
            box.querySelectorAll('[data-lk]').forEach((i) => (i.value = cur[i.dataset.lk]));
            Object.assign(u, S.user); Object.assign(orig, cur);
            renderMe(); ctx.clean(); toast('Профиль сохранён');
            if (S.view.profile === S.user.username) openProfile(S.user.username);
          } catch (er) { $$('#m-err').textContent = er.message; }
        };
        $$('#pf-status').oninput = (e) => { cur.status = e.target.value; sync(); };
        $$('#pf-bio').oninput = (e) => { cur.bio = e.target.value; sync(); };
        $$('#sw').onclick = (e) => { const b = e.target.closest('.sw[data-c]'); if (b) { cur.banner = b.dataset.c; sync(); } };
        $$('#sw-in').oninput = (e) => { cur.banner = e.target.value; sync(); };
        $$('#sw-reset').onclick = () => { cur.banner = ''; sync(); };
        $$('#av-pick')?.addEventListener('click', () => $$('#av-in').click());
        $$('#av-del')?.addEventListener('click', () => { cur.key = ''; sync(); });
        $$('#av-in').onchange = async (e) => {
          const f = e.target.files[0]; if (!f) return;
          $$('#m-err').textContent = '';
          try { cur.key = (await uploadMedia(f, 'avatar')).att_key; sync(); } catch (er) { $$('#m-err').textContent = er.message; }
          e.target.value = '';
        };
        $$('#pres').onclick = (e) => presMenu(e.currentTarget, cur.presence, (k) => { cur.presence = k; sync(); });
        $$('#pf-ttl').onchange = (e) => { cur.ttl = e.target.value; sync(); };
        $$('#pf-act').oninput = (e) => { cur.activity = e.target.value; sync(); };
        $$('#pf-mus').oninput = (e) => { cur.music = e.target.value; sync(); };
        (async () => {
          const bx = $$('#bdg-box'); let d;
          try { d = await api('/badges'); } catch { bx.textContent = 'Не удалось загрузить'; return; }
          const draw = () => {
            bx.innerHTML = ['Показ экрана', 'Игры', 'Голос', 'Особые'].map((g) => `<div class="bdg-g"><div class="muted">${g}</div><div class="bdg-grid">${BADGES.filter((b) => b.group === g).map((b) => {
              const has = d.earned.includes(b.id), pin = d.pinned.includes(b.id), v = b.stat ? d.stats[b.stat] : 0;
              return `<button type="button" class="bdg-c ${has ? '' : 'lock'} ${pin ? 'pin' : ''}" data-b="${b.id}" ${has ? '' : 'disabled'}>${bdgEl(b.id, true)}<span class="bdg-n">${esc(b.name)}</span><span class="bdg-d">${has ? (pin ? 'Закреплён' : esc(b.desc)) : b.stat ? `${Math.min(Math.floor(v), b.goal)} / ${b.goal.toLocaleString('ru-RU')}${b.unit ? ' ' + b.unit : ''}` : esc(b.desc)}</span></button>`; }).join('')}</div></div>`).join('');
          };
          draw();
          bx.onclick = async (e) => {
            const c = e.target.closest('[data-b]'); if (!c || c.disabled) return;
            const id = c.dataset.b, list = d.pinned.includes(id) ? d.pinned.filter((x) => x !== id) : [...d.pinned, id];
            if (list.length > 5) return toast('Можно закрепить не больше 5 значков');
            try { await api('/profile', { method: 'PATCH', body: { pinned_badges: list } }); d.pinned = list; draw(); } catch (er) { toast(er.message); }
          };
        })();
        $$('#st-emoji').onclick = (e) => { const b = e.target.closest('[data-e]'); if (!b) return; const i = $$('#pf-status'); i.value = (b.dataset.e + ' ' + i.value.replace(/^\p{Extended_Pictographic}\s*/u, '')).slice(0, 80); cur.status = i.value; sync(); };
        $$('#pf-pron').oninput = (e) => { cur.pronouns = e.target.value; sync(); };
        box.querySelectorAll('[data-lk]').forEach((i) => (i.oninput = () => { cur[i.dataset.lk] = i.value; sync(); }));
        $$('#g-go').onclick = () => { cur.banner = `g:${$$('#g1').value},${$$('#g2').value}`; sync(); };
        $$('#sw-drop')?.addEventListener('click', async () => { try { const r = await new EyeDropper().open(); cur.banner = r.sRGBHex; sync(); } catch {} });
        $$('#bn-pick').onclick = () => $$('#bn-in').click();
        $$('#bn-del').onclick = () => { if (/^m_/.test(cur.banner)) cur.banner = ''; sync(); };
        $$('#bn-in').onchange = async (e) => {
          const f = e.target.files[0]; if (!f) return;
          $$('#m-err').textContent = '';
          try { cur.banner = (await uploadMedia(f, 'banner')).att_key; sync(); } catch (er) { $$('#m-err').textContent = er.message; }
          e.target.value = '';
        };
        sync(); ctx.clean();
      } },
      { sep: true },
      { id: 'look', label: 'Внешний вид', render: (box) => {
        const theme = localStorage.getItem('nc_theme') || 'auto';
        box.innerHTML = `<h2>Внешний вид</h2><div class="sx-l">Тема</div>
          <div class="sx-themes" id="th">${[['auto', 'Как в системе'], ['dark', 'Тёмная'], ['light', 'Светлая']].map(([k, n]) => `<button class="th ${theme === k ? 'on' : ''}" data-t="${k}"><span class="th-prev ${k}"><i></i><i></i></span><span>${n}</span></button>`).join('')}</div>
          <div class="sx-div"></div><h3>Лента</h3>
          ${toggleRow('st-quiet', 'Тихий режим', 'Без счётчиков лайков и ответов, без подсказок справа', S.prefs.quiet)}
          ${toggleRow('st-rail', 'Подсказки справа', '«В тренде» и «Кого читать» рядом с лентой', S.prefs.rail)}`;
        box.querySelector('#th').onclick = (ev) => {
          const b = ev.target.closest('[data-t]'); if (!b) return;
          localStorage.setItem('nc_theme', b.dataset.t); applyTheme();
          box.querySelectorAll('.th').forEach((x) => x.classList.toggle('on', x === b));
        };
        box.querySelector('#st-quiet').onchange = (ev) => { S.prefs.quiet = ev.target.checked; applyPrefs(); if (S.view.type === 'feed') openFeed(); };
        box.querySelector('#st-rail').onchange = (ev) => { S.prefs.rail = ev.target.checked; applyPrefs(); if (S.view.type === 'feed') feedLayout(); };
      } },
      { id: 'notif', label: 'Уведомления', render: (box) => {
        const n = 'Notification' in window ? Notification.permission : 'denied';
        box.innerHTML = `<h2>Уведомления</h2>
          <div class="set-row"><div class="grow"><b>Уведомления в браузере</b><div class="muted small">Придут, когда вкладка в фоне: упоминания, ответы, личные сообщения</div></div>
          ${n === 'granted' ? '<span class="muted">Включены</span>' : n === 'denied' ? '<span class="muted">Запрещены в браузере</span>' : '<button id="st-notif">Включить</button>'}</div>
          <div class="muted small" style="margin-top:10px">Если запретил уведомления, разрешить их снова можно в настройках сайта в браузере.</div>`;
        box.querySelector('#st-notif')?.addEventListener('click', async () => { await Notification.requestPermission(); settingsModal('notif'); });
      } },
      { id: 'keys', label: 'Горячие клавиши', render: (box) => {
        const rows = [['Ctrl/⌘ + K', 'Быстрый переход и поиск'], ['Alt + ↑ / ↓', 'Предыдущий / следующий канал'], ['Esc', 'Закрыть окно'], ['Enter', 'Отправить сообщение'], ['Shift + Enter', 'Новая строка'], ['Ctrl + Enter', 'Опубликовать пост'], ['?', 'Показать подсказку']];
        box.innerHTML = `<h2>Горячие клавиши</h2>${rows.map(([k, t]) => `<div class="row"><kbd>${k}</kbd><span class="grow">${t}</span></div>`).join('')}`;
      } },
      { sep: true },
      { id: 'out', label: 'Выйти', danger: true, action: () => { if (confirm('Выйти из аккаунта?')) { closeShell(true); logout(); } } },
    ],
  });
}

function accountModal(kind) {
  const name = kind === 'name';
  modal(`<h3>${name ? 'Изменить имя пользователя' : 'Изменить пароль'}</h3>
    <div class="muted small">${name ? 'Введи новый ник и текущий пароль.' : 'Все остальные устройства будут разлогинены.'}</div>
    ${name ? '<input id="a1" placeholder="Новый ник" autocomplete="username" maxlength="24">' : '<input id="a0" type="password" placeholder="Текущий пароль" autocomplete="current-password"><input id="a1" type="password" placeholder="Новый пароль" autocomplete="new-password"><input id="a2" type="password" placeholder="Повтори новый пароль" autocomplete="new-password">'}
    ${name ? '<input id="a0" type="password" placeholder="Текущий пароль" autocomplete="current-password">' : ''}
    <div class="error" id="m-err"></div>
    <div class="modal-actions"><button class="ghost" id="m-cancel">Отмена</button><button id="m-ok">Сохранить</button></div>`, (c) => {
    c.querySelector('#m-cancel').onclick = closeModal;
    c.querySelector('#m-ok').onclick = async () => {
      const v = (s) => c.querySelector(s)?.value || '';
      try {
        if (name) {
          const r = await api('/account/username', { body: { username: v('#a1').trim(), password: v('#a0') } });
          A[r.username] = A[S.user.username]; S.user.username = r.username; renderMe();
        } else {
          if (v('#a1') !== v('#a2')) throw new Error('Пароли не совпадают');
          await api('/account/password', { body: { old_password: v('#a0'), new_password: v('#a1') } });
        }
        closeModal(); toast(name ? 'Ник изменён' : 'Пароль изменён');
        if (name) settingsModal('account');
      } catch (er) { c.querySelector('#m-err').textContent = er.message; }
    };
  });
}

// ---------- новый канал
function channelModal(type = 'text') {
  const opt = (t, icon, title, sub) => `<label class="radio-card"><input type="radio" name="ct" value="${t}" ${type === t ? 'checked' : ''}><span class="rc-i">${ic(icon)}</span><span class="grow"><b>${title}</b><div class="muted small">${sub}</div></span><span class="rc-dot"></span></label>`;
  modal(`<h3>Создать канал</h3>
    <div class="sx-l">Тип канала</div>
    ${opt('text', 'hash', 'Текстовый', 'Сообщения, картинки, файлы, реакции')}
    ${opt('voice', 'speaker', 'Голосовой', 'Голос и демонстрация экрана')}
    <div class="sx-l">Название канала</div>
    <div class="prefix-in"><span id="ct-pre">${ic(type === 'voice' ? 'speaker' : 'hash')}</span><input id="m-name" placeholder="Новый-канал" maxlength="30"></div>
    <label class="set-row"><div class="grow"><b>Приватный канал</b><div class="muted small">Видят только выбранные роли и модераторы</div></div><input type="checkbox" id="ct-priv"></label>
    <div class="error" id="m-err"></div>
    <div class="modal-actions"><button class="ghost" id="m-cancel">Отмена</button><button id="m-ok">Создать канал</button></div>`, (c) => {
    c.querySelector('#m-cancel').onclick = closeModal;
    c.querySelectorAll('[name=ct]').forEach((r) => r.onchange = () => { c.querySelector('#ct-pre').innerHTML = ic(r.value === 'voice' ? 'speaker' : 'hash'); });
    const go = async () => {
      try {
        const t = c.querySelector('[name=ct]:checked').value;
        const r = await api(`/servers/${S.server.server.id}/channels`, { body: { name: c.querySelector('#m-name').value, type: t, is_private: c.querySelector('#ct-priv').checked } });
        closeModal(); await openServer(S.server.server.id, t === 'text' ? r.id : S.channel?.id);
      } catch (e) { c.querySelector('#m-err').textContent = e.message; }
    };
    c.querySelector('#m-ok').onclick = go;
    c.querySelector('#m-name').onkeydown = (e) => { if (e.key === 'Enter') go(); };
    c.querySelector('#m-name').focus();
  });
}

// ---------- настройки канала
const SLOW = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600];
const slowLabel = (s) => (s === 0 ? 'Выкл.' : s < 60 ? `${s} с` : s < 3600 ? `${s / 60} мин` : `${s / 3600} ч`);

function channelSettings(ch) {
  const sid = S.server.server.id;
  const voice = ch.type === 'voice';
  shell({
    head: `<span class="muted">${ic(voice ? 'speaker' : 'hash')}</span> ${esc(ch.name)}<div class="muted small">${voice ? 'Голосовой канал' : 'Текстовый канал'}</div>`,
    tabs: [
      { id: 'over', label: 'Обзор', render: (box, ctx) => {
        const orig = { name: ch.name, topic: ch.topic || '', slow: SLOW.indexOf(ch.slowmode || 0) < 0 ? 0 : SLOW.indexOf(ch.slowmode || 0) };
        const cur = { ...orig };
        box.innerHTML = `<h2>Обзор</h2>
          ${field('Название канала', `<div class="prefix-in"><span>${ic(voice ? 'speaker' : 'hash')}</span><input id="cs-name" maxlength="30"></div>`)}
          ${voice ? '' : `${field('Тема канала', '<textarea id="cs-topic" rows="3" maxlength="200" placeholder="О чём этот канал?"></textarea><div class="muted small" id="cs-cnt"></div>')}
          <div class="sx-div"></div>
          ${field('Медленный режим', `<input type="range" id="cs-slow" min="0" max="${SLOW.length - 1}" step="1"><div class="sx-ticks"><span>Выкл.</span><b id="cs-slow-l"></b><span>6 ч</span></div>`, 'Участники смогут отправлять одно сообщение в выбранный интервал. На владельца сервера это не действует.')}`}
          <div class="error" id="m-err"></div>`;
        const $$ = (s) => box.querySelector(s);
        $$('#cs-name').value = cur.name;
        if (!voice) { $$('#cs-topic').value = cur.topic; $$('#cs-slow').value = cur.slow; }
        const sync = () => {
          if (!voice) { $$('#cs-cnt').textContent = `${cur.topic.length} / 200`; $$('#cs-slow-l').textContent = slowLabel(SLOW[cur.slow]); $$('#cs-slow').style.setProperty('--p', (cur.slow / (SLOW.length - 1)) * 100 + '%'); }
          const ch2 = cur.name !== orig.name || cur.topic !== orig.topic || cur.slow !== orig.slow;
          if (ch2) ctx.dirty(save, reset); else ctx.clean();
        };
        const reset = () => { Object.assign(cur, orig); $$('#cs-name').value = cur.name; if (!voice) { $$('#cs-topic').value = cur.topic; $$('#cs-slow').value = cur.slow; } sync(); };
        const save = async () => {
          try {
            const body = { name: cur.name };
            if (!voice) { body.topic = cur.topic; body.slowmode = SLOW[cur.slow]; }
            await api(`/channels/${ch.id}`, { method: 'PATCH', body });
            ctx.clean(); toast('Канал сохранён'); closeShell(true);
            await openServer(sid, ch.id);
          } catch (er) { $$('#m-err').textContent = er.message; }
        };
        $$('#cs-name').oninput = (e) => { cur.name = e.target.value; sync(); };
        if (!voice) {
          $$('#cs-topic').oninput = (e) => { cur.topic = e.target.value; sync(); };
          $$('#cs-slow').oninput = (e) => { cur.slow = Number(e.target.value); sync(); };
        }
        sync(); ctx.clean();
      } },
      { id: 'access', label: 'Права доступа', render: (box, ctx) => {
        const orig = { priv: !!ch.is_private, roles: [...(ch.role_ids || [])].sort() };
        const cur = { priv: orig.priv, roles: [...orig.roles] };
        const roles = S.server.roles;
        const draw = () => {
          box.innerHTML = `<h2>Права доступа</h2>
            <label class="set-row"><div class="grow"><b>Приватный канал</b><div class="muted small">Видят только владелец, модераторы с управлением каналами и выбранные роли</div></div><input type="checkbox" id="ac-priv" ${cur.priv ? 'checked' : ''}></label>
            ${cur.priv ? `<div class="sx-l">Роли с доступом</div>${roles.length ? `<div class="role-pick" style="padding:0">${roles.map((r) => `<button class="rp ${cur.roles.includes(r.id) ? 'on' : ''}" data-rp="${r.id}"><i style="background:${r.color || 'var(--muted)'}"></i>${esc(r.name)}</button>`).join('')}</div>` : '<div class="muted small">Сначала создай роли в настройках сервера — доступ выдаётся ролям.</div>'}` : ''}
            <div class="error" id="m-err"></div>`;
          box.querySelector('#ac-priv').onchange = (e) => { cur.priv = e.target.checked; draw(); sync(); };
          box.querySelectorAll('[data-rp]').forEach((b) => b.onclick = () => { const id = Number(b.dataset.rp); cur.roles = cur.roles.includes(id) ? cur.roles.filter((x) => x !== id) : [...cur.roles, id]; draw(); sync(); });
        };
        const sync = () => { if (cur.priv !== orig.priv || JSON.stringify([...cur.roles].sort()) !== JSON.stringify(orig.roles)) ctx.dirty(save, () => { Object.assign(cur, { priv: orig.priv, roles: [...orig.roles] }); draw(); ctx.clean(); }); else ctx.clean(); };
        const save = async () => {
          try { await api(`/channels/${ch.id}`, { method: 'PATCH', body: { is_private: cur.priv, roles: cur.roles } }); ctx.clean(); toast('Доступ сохранён'); closeShell(true); await openServer(sid, ch.id); }
          catch (er) { box.querySelector('#m-err').textContent = er.message; }
        };
        draw(); ctx.clean();
      } },
      { sep: true },
      { id: 'del', label: 'Удалить канал', danger: true, action: (ctx) => {
        modal(`<h3>Удалить канал</h3><div>Канал <b>${voice ? '' : '#'}${esc(ch.name)}</b> и все его сообщения исчезнут навсегда. Это нельзя отменить.</div><div class="error" id="m-err"></div>
          <div class="modal-actions"><button class="ghost" id="m-cancel">Отмена</button><button class="danger" id="m-ok">Удалить канал</button></div>`, (c) => {
          c.querySelector('#m-cancel').onclick = closeModal;
          c.querySelector('#m-ok').onclick = async () => {
            try {
              await api(`/channels/${ch.id}`, { method: 'DELETE' });
              closeModal(); ctx.close();
              if (S.channel?.id === ch.id) S.channel = null;
              await openServer(sid);
            } catch (er) { c.querySelector('#m-err').textContent = er.message; }
          };
        });
      } },
    ],
  });
}

// ---------- настройки сервера
const PERM_INFO = [
  [PERM.MESSAGES, 'Управлять сообщениями', 'Удалять чужие сообщения и закреплять их'],
  [PERM.KICK, 'Исключать участников', 'Кроме владельца и других модераторов'],
  [PERM.CHANNELS, 'Управлять каналами', 'Создавать, менять и удалять каналы'],
  [PERM.ROLES, 'Управлять ролями', 'Создавать роли и выдавать их участникам'],
  [PERM.SERVER, 'Управлять сервером', 'Название, описание, каталог, правила, журнал'],
];
async function reloadServer() {
  const id = S.server.server.id;
  S.server = await api(`/servers/${id}`);
  normServer(); renderServerSide(); renderMembers();
}
function serverSettingsModal() {
  const s = S.server.server;
  const owner = s.owner_id === S.user.id;
  const tabs = [];
  if (can(PERM.SERVER)) tabs.push({ id: 'over', label: 'Обзор', render: tabServerOverview });
  if (can(PERM.ROLES)) tabs.push({ id: 'roles', label: 'Роли', render: tabRoles });
  if (can(PERM.KICK | PERM.ROLES)) tabs.push({ id: 'mem', label: 'Участники', render: tabMembers });
  tabs.push({ id: 'inv', label: 'Приглашения', render: tabInvites });
  if (typeof tabAudit === 'function' && can(PERM.SERVER)) tabs.push({ id: 'log', label: 'Журнал действий', render: tabAudit });
  if (typeof tabRules === 'function' && can(PERM.SERVER)) tabs.splice(1, 0, { id: 'rules', label: 'Правила', render: tabRules });
  if (typeof tabEmojis === 'function' && can(PERM.SERVER) && S.config.files) tabs.splice(1, 0, { id: 'emoji', label: 'Эмодзи', render: tabEmojis });
  if (owner) {
    tabs.push({ sep: true });
    tabs.push({ id: 'del', label: 'Удалить сервер', danger: true, action: (ctx) => {
      modal(`<h3>Удалить сервер</h3><div>Сервер <b>${esc(s.name)}</b>, все каналы и сообщения исчезнут навсегда.</div>
        <div class="modal-actions"><button class="ghost" id="m-cancel">Отмена</button><button class="danger" id="m-ok">Удалить сервер</button></div>`, (c) => {
        c.querySelector('#m-cancel').onclick = closeModal;
        c.querySelector('#m-ok').onclick = async () => { await api(`/servers/${s.id}`, { method: 'DELETE' }); closeModal(); ctx.close(); await loadServers(); openHome(); };
      });
    } });
  }
  shell({ head: `${esc(s.name)}<div class="muted small">Настройки сервера</div>`, tabs });
}

function tabServerOverview(box, ctx) {
  const s = S.server.server;
  const orig = { name: s.name, desc: s.description || '', pub: !!s.is_public };
  const cur = { ...orig };
  box.innerHTML = `<h2>Обзор</h2>
    ${field('Название сервера', '<input id="ss-name" maxlength="40">')}
    ${field('Описание', '<textarea id="ss-desc" rows="3" maxlength="200" placeholder="Коротко о сервере"></textarea><div class="muted small" id="ss-cnt"></div>')}
    ${toggleRow('ss-pub', 'Показывать в каталоге серверов', 'Посты сервера увидят все, а присоединиться сможет любой', cur.pub)}
    <div class="error" id="m-err"></div>`;
  const $$ = (x) => box.querySelector(x);
  $$('#ss-name').value = cur.name; $$('#ss-desc').value = cur.desc;
  const sync = () => {
    $$('#ss-cnt').textContent = `${cur.desc.length} / 200`;
    if (cur.name !== orig.name || cur.desc !== orig.desc || cur.pub !== orig.pub) ctx.dirty(save, reset); else ctx.clean();
  };
  const reset = () => { Object.assign(cur, orig); $$('#ss-name').value = cur.name; $$('#ss-desc').value = cur.desc; $$('#ss-pub').checked = cur.pub; sync(); };
  const save = async () => {
    try {
      if (cur.name !== orig.name) await api(`/servers/${s.id}`, { method: 'PATCH', body: { name: cur.name } });
      await api(`/servers/${s.id}/public`, { body: { is_public: cur.pub, description: cur.desc } });
      ctx.clean(); toast('Сервер сохранён'); closeShell(true);
      await loadServers(); openServer(s.id, S.channel?.id);
    } catch (er) { $$('#m-err').textContent = er.message; }
  };
  $$('#ss-name').oninput = (e) => { cur.name = e.target.value; sync(); };
  $$('#ss-desc').oninput = (e) => { cur.desc = e.target.value; sync(); };
  $$('#ss-pub').onchange = (e) => { cur.pub = e.target.checked; sync(); };
  sync(); ctx.clean();
}

function tabInvites(box) {
  const s = S.server.server;
  const link = `${location.origin}/?join=${s.invite}`;
  box.innerHTML = `<h2>Приглашения</h2>${field('Ссылка-приглашение', `<div class="sx-copy"><input readonly value="${esc(link)}"><button id="cp">Копировать</button></div>`, `Код: <b>${esc(s.invite)}</b>`)}`;
  box.querySelector('#cp').onclick = async (e) => { try { await navigator.clipboard.writeText(link); } catch { box.querySelector('input').select(); } e.currentTarget.textContent = 'Скопировано'; };
}

function tabMembers(box) {
  const s = S.server.server;
  const mine = S.server.my_perms;
  let open = null;
  const draw = () => {
    const roles = S.server.roles.filter((r) => !(r.perms & ~mine));
    box.innerHTML = `<h2>Участники — ${S.server.members.length}</h2>${S.server.members.map((m) => `<div class="mrow"><div class="row">${avatar(m.username, 32, ps(m))}
      <div class="grow"><b style="${m.color ? 'color:' + m.color : ''}">${esc(m.username)}</b>${m.id === s.owner_id ? ' <span class="muted small">Владелец</span>' : ''}
      <div class="uc-roles">${m.roles.map((r) => `<span class="role-chip"><i style="background:${r.color || 'var(--muted)'}"></i>${esc(r.name)}</span>`).join('')}</div></div>
      ${can(PERM.ROLES) && S.server.roles.length ? `<button class="ghost mini" data-roles="${m.id}">Роли</button>` : ''}
      ${can(PERM.KICK) && m.id !== s.owner_id && m.id !== S.user.id ? `<button class="ghost mini" data-kick="${m.id}">Исключить</button>` : ''}</div>
      ${open === m.id ? `<div class="role-pick">${roles.length ? roles.map((r) => `<button class="rp ${m.role_ids.includes(r.id) ? 'on' : ''}" data-rp="${r.id}"><i style="background:${r.color || 'var(--muted)'}"></i>${esc(r.name)}</button>`).join('') : '<span class="muted small">Нет ролей, которые ты можешь выдать</span>'}</div>` : ''}</div>`).join('')}`;
  };
  draw();
  box.onclick = async (e) => {
    const rb = e.target.closest('[data-roles]');
    if (rb) { open = open === Number(rb.dataset.roles) ? null : Number(rb.dataset.roles); return draw(); }
    const rp = e.target.closest('[data-rp]');
    if (rp) {
      const m = S.server.members.find((x) => x.id === open);
      const id = Number(rp.dataset.rp);
      const ids = m.role_ids.includes(id) ? m.role_ids.filter((x) => x !== id) : [...m.role_ids, id];
      try { await api(`/servers/${s.id}/members/${m.id}/roles`, { method: 'PUT', body: { roles: ids } }); await reloadServer(); draw(); } catch (er) { toast(er.message); }
      return;
    }
    const k = e.target.closest('[data-kick]');
    if (k && confirm('Исключить участника?')) {
      try { await api(`/servers/${s.id}/kick/${k.dataset.kick}`, { method: 'POST' }); await reloadServer(); draw(); } catch (er) { toast(er.message); }
    }
  };
}

function tabRoles(box, ctx) {
  const sid = S.server.server.id;
  const mine = S.server.my_perms;
  let sel = S.server.roles[0]?.id ?? null;
  const draw = () => {
    const roles = S.server.roles;
    const role = roles.find((r) => r.id === sel);
    box.innerHTML = `<h2>Роли</h2><div class="muted small">Роль даёт права и цвет ника. Модератору обычно хватает «Управлять сообщениями» и «Исключать участников».</div>
      <div class="roles-ui"><div class="roles-list">${roles.map((r) => `<button class="rl ${r.id === sel ? 'on' : ''}" data-r="${r.id}"><i style="background:${r.color || 'var(--muted)'}"></i><span class="grow">${esc(r.name)}</span></button>`).join('')}
        <button class="ghost mini" id="r-new">+ Создать роль</button><button class="ghost mini" id="r-mod">+ Модератор</button></div>
      <div class="role-edit" id="re">${role ? '' : '<div class="muted">Создай первую роль слева.</div>'}</div></div>`;
    if (role) editor(role);
  };
  const editor = (role) => {
    const re = box.querySelector('#re');
    const locked = !!(role.perms & ~mine);
    const cur = { name: role.name, color: role.color || '', perms: role.perms };
    re.innerHTML = `${field('Название роли', '<input id="r-name" maxlength="30">')}
      ${field('Цвет ника', `<div class="sx-sw" id="r-sw">${SX_COLORS.slice(2).map((c) => `<button type="button" class="sw" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}<label class="sw custom" title="Свой цвет"><input type="color" id="r-in" value="${cur.color || '#8a8a8a'}">${ic('edit')}</label><button type="button" class="ghost mini" id="r-nc">Без цвета</button></div>`)}
      <div class="sx-l">Права</div>${PERM_INFO.map(([bit, t, d]) => `<label class="set-row"><div class="grow"><b>${t}</b><div class="muted small">${d}</div></div><input type="checkbox" data-bit="${bit}" ${cur.perms & bit ? 'checked' : ''} ${!(mine & bit) || locked ? 'disabled' : ''}></label>`).join('')}
      <div class="error" id="m-err"></div>
      <div class="admin-btns"><button id="r-save" ${locked ? 'disabled' : ''}>Сохранить роль</button><button class="danger" id="r-del" ${locked ? 'disabled' : ''}>Удалить</button></div>`;
    const $$ = (x) => re.querySelector(x);
    $$('#r-name').value = cur.name;
    const mark = () => re.querySelectorAll('.sw[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === cur.color.toLowerCase()));
    mark();
    $$('#r-name').oninput = (e) => { cur.name = e.target.value; };
    $$('#r-sw').onclick = (e) => { const b = e.target.closest('.sw[data-c]'); if (b) { cur.color = b.dataset.c; mark(); } };
    $$('#r-in').oninput = (e) => { cur.color = e.target.value; mark(); };
    $$('#r-nc').onclick = () => { cur.color = ''; mark(); };
    re.querySelectorAll('[data-bit]').forEach((c) => c.onchange = () => { const b = Number(c.dataset.bit); cur.perms = c.checked ? cur.perms | b : cur.perms & ~b; });
    $$('#r-save').onclick = async () => {
      try { await api(`/roles/${role.id}`, { method: 'PATCH', body: { name: cur.name, color: cur.color, perms: cur.perms } }); await reloadServer(); toast('Роль сохранена'); draw(); }
      catch (er) { $$('#m-err').textContent = er.message; }
    };
    $$('#r-del').onclick = async () => {
      if (!confirm(`Удалить роль «${role.name}»?`)) return;
      try { await api(`/roles/${role.id}`, { method: 'DELETE' }); await reloadServer(); sel = S.server.roles[0]?.id ?? null; draw(); }
      catch (er) { $$('#m-err').textContent = er.message; }
    };
  };
  const create = async (body) => {
    try { const r = await api(`/servers/${sid}/roles`, { body }); await reloadServer(); sel = r.id; draw(); } catch (er) { toast(er.message); }
  };
  draw();
  box.onclick = (e) => {
    const r = e.target.closest('[data-r]');
    if (r) { sel = Number(r.dataset.r); draw(); return; }
    if (e.target.closest('#r-new')) create({ name: 'Новая роль', perms: 0 });
    if (e.target.closest('#r-mod')) create({ name: 'Модератор', color: '#30a46c', perms: (PERM.MESSAGES | PERM.KICK) & mine });
  };
}
