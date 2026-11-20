// earth's network — телефон: экран списка (серверы и каналы) и экран чата, как в Discord
const isM = () => matchMedia('(max-width:700px)').matches;
function mview(v) {
  const a = $('#app');
  a.classList.toggle('m-main', v === 'main');
  a.classList.remove('show-members', 'show-side');
  renderBnav?.();
}
(() => {
  const wrap = (name, fn) => { const o = globalThis[name]; if (typeof o === 'function') globalThis[name] = fn(o); };
  const toMain = (o) => function (...a) { const r = o.apply(this, a); if (isM()) mview('main'); return r; };

  wrap('openChannel', (o) => function (ch) {
    if (isM() && S.noOpen) { S.noOpen = false; S.channel = null; return; }
    const r = o.call(this, ch); if (isM()) mview('main'); return r;
  });
  wrap('openServer', (o) => async function (id, cid) {
    const m = isM() && cid == null;
    if (m) S.noOpen = true;
    try { await o.call(this, id, cid); } finally { S.noOpen = false; }
    if (m) mview('list');
  });
  wrap('openHome', (o) => async function () { await o.call(this); if (isM()) mview('list'); });
  wrap('openNotifications', (o) => function (silent) { const r = o.call(this, silent); if (isM() && !silent) mview('main'); return r; });
  ['openProfile', 'openFeed', 'openServerFeed', 'openSearch'].forEach((n) => wrap(n, toMain));
  wrap('burgerClick', () => function (e) {
    if (!e.target.closest('[data-burger]')) return;
    if (isM()) mview('list'); else $('#app').classList.toggle('show-side');
  });
  wrap('toggleMembers', (o) => function () {
    if (!isM()) return o.call(this);
    const a = $('#app'); a.classList.toggle('show-members');
  });
  wrap('renderBnav', (o) => function () {
    o.call(this);
    const b = $('#bnav'); if (!b || !S.user) return;
    b.onclick = (ev) => {
      const x = ev.target.closest('[data-b]'); if (!x) return;
      const k = x.dataset.b;
      if (k === 'home') { mview('list'); if (!S.view?.type) openHome(); }
      else if (k === 'search') paletteOpen();
      else if (k === 'notif') openNotifications();
      else openProfile(S.user.username);
    };
  });
})();

// нажатие на пункт списка слева открывает правую часть (друзья, лента сервера и т.п.)
document.addEventListener('click', (e) => {
  if (!isM()) return;
  const a = $('#app');
  if (a.classList.contains('show-members') && e.target === a) return a.classList.remove('show-members');
  const it = e.target.closest('#side-list .item');
  if (it && !e.target.closest('[data-gear],[data-add],.cat button')) setTimeout(() => { if (isM()) mview('main'); }, 30);
});

// свайп от левого края — назад к списку; влево на чате — участники
(() => {
  let sx = 0, sy = 0, t0 = 0;
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; t0 = Date.now(); }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!isM()) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy), a = $('#app');
    if (Date.now() - t0 > 600 || dy > 60 || document.querySelector('#modal:not(.hidden)')) return;
    if (a.classList.contains('show-members')) { if (dx > 70) a.classList.remove('show-members'); return; }
    if (a.classList.contains('m-main') && sx < 28 && dx > 80) mview('list');
  }, { passive: true });
})();
