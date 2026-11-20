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
    el.style.left = x + 'px'; el.style.top = y + 'px';
  };
  place();
  let d;
  try { d = await api(`/users/${encodeURIComponent(username)}?card=1`); }
  catch (e) { el.innerHTML = `<div class="uc-load">${esc(e.message)}</div>`; return; }
  const u = d.user;
  const member = S.server?.members?.find((m) => m.username === u.username);
  const roles = member?.roles || [];
  el.innerHTML = `<div class="uc-banner" style="background:${u.banner || colorOf(u.username)}"></div>
    <div class="uc-av">${avatar(u.username, 80, d.online)}</div>
    <div class="uc-body">
      <div class="uc-name">${esc(u.username)}</div>
      ${u.status ? `<div class="uc-status">${esc(u.status)}</div>` : ''}
      ${u.activity ? `<div class="uc-status">Играет в ${esc(u.activity)}</div>` : ''}
      ${roles.length ? `<div class="uc-roles">${roles.map((r) => `<span class="role-chip"><i style="background:${r.color || 'var(--muted)'}"></i>${esc(r.name)}</span>`).join('')}</div>` : ''}
      ${u.bio ? `<div class="uc-sep"></div><div class="sx-l">О себе</div><div class="uc-bio">${linkify(u.bio, true)}</div>` : ''}
      <div class="uc-sep"></div>
      <div class="muted small"><span id="uc-fol">${d.followers}</span> подписчиков · с нами с ${new Date(u.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</div>
      <div class="uc-btns">${d.is_me ? '<button id="uc-edit">Изменить профиль</button>' : `<button id="uc-dm">Написать</button><button class="ghost" id="uc-fl">${d.is_following ? 'Вы подписаны' : 'Подписаться'}</button>`}<button class="ghost" id="uc-open">Профиль</button></div>
    </div>`;
  place();
  const $$ = (s) => el.querySelector(s);
  $$('#uc-open').onclick = () => { el.remove(); openProfile(u.username); };
  $$('#uc-edit')?.addEventListener('click', () => { el.remove(); settingsModal('profile'); });
  $$('#uc-fl')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const r = await api(`/users/${u.id}/follow`, { method: 'POST' });
    btn.textContent = r.following ? 'Вы подписаны' : 'Подписаться'; $$('#uc-fol').textContent = r.followers;
  });
  $$('#uc-dm')?.addEventListener('click', async () => {
    el.remove();
    const r = await api('/dms', { body: { userId: u.id } });
    await openHome(); await refreshHome(); openChannel({ id: r.id, name: r.username, type: 'dm' });
  });
  const off = (ev) => { if (!el.contains(ev.target)) { el.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
}
