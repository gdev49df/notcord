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
const badge = (n, hot) => (n > 0 ? `<span class="badge ${hot ? 'hot' : ''}">${n > 99 ? '99+' : n}</span>` : '');
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
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.3c1.9.5 3 2.1 3.3 4.7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  thread: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v4a4 4 0 0 0 4 4h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

const PERM = { MESSAGES: 1, KICK: 2, CHANNELS: 4, ROLES: 8, SERVER: 16 };
const can = (bits) => !!(S.server && (S.server.my_perms & bits));
function normServer() {
  const sv = S.server; if (!sv) return;
  const byId = Object.fromEntries((sv.roles || []).map((r) => [r.id, r]));
  sv.members.forEach((m) => { m.roles = (m.role_ids || []).map((i) => byId[i]).filter(Boolean); m.color = m.roles.find((r) => r.color)?.color || null; });
}
const LOGO = `<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 573 76" role="img" aria-label="Earth's Network" color="currentColor"><circle cx="34" cy="38.0" r="30" fill="none" stroke="currentColor" stroke-width="3.2"/>
<ellipse cx="34" cy="38.0" rx="12.0" ry="30" fill="none" stroke="currentColor" stroke-width="3.2"/>
<path d="M4 38.0H64" stroke="currentColor" stroke-width="3.2"/>
<circle cx="57.4" cy="14.6" r="6.1" fill="currentColor" stroke="var(--bg,#000)" stroke-width="3.8" paint-order="stroke"/><path transform="translate(90.0 56.0)" d="M34.13 -21.6V-14.4H13.97L12.91 -8.06H35.71V0H2.26L4.99 -18L2.26 -36H35.47V-27.94H12.91L13.97 -21.6Z M64.37 0 63.65 -5.57Q61.78 -2.69 58.99 -1.06Q55.92 0.77 52.03 0.77Q48 0.77 44.95 -1.03Q41.9 -2.83 40.18 -6.12Q38.45 -9.41 38.45 -13.68Q38.45 -18.05 40.18 -21.31Q41.9 -24.58 44.95 -26.4Q48 -28.22 52.03 -28.22Q55.92 -28.22 58.99 -26.45Q61.78 -24.77 63.7 -21.94L64.37 -27.41H74.54L72.82 -13.73L74.54 0ZM48.38 -13.68Q48.38 -11.66 49.22 -10.08Q50.06 -8.5 51.55 -7.61Q53.04 -6.72 54.96 -6.72Q56.98 -6.72 58.75 -7.61Q60.53 -8.5 61.87 -10.08Q63.22 -11.66 63.89 -13.68Q63.22 -15.74 61.87 -17.33Q60.53 -18.91 58.75 -19.82Q56.98 -20.74 54.96 -20.74Q53.04 -20.74 51.55 -19.82Q50.06 -18.91 49.22 -17.33Q48.38 -15.74 48.38 -13.68Z M76.75 -27.41H86.74L87.94 -20.11Q88.66 -22.18 89.76 -23.86Q91.06 -25.87 93.02 -27.05Q94.99 -28.22 97.82 -28.22Q98.64 -28.22 99.5 -28.13Q100.37 -28.03 101.23 -27.84V-19.49Q99.79 -19.78 98.52 -19.9Q97.25 -20.02 96.19 -20.02Q94.08 -20.02 92.3 -19.18Q90.53 -18.34 89.45 -16.42Q88.37 -14.5 88.37 -11.28V0H78.58V-18.19Z M100.99 -20.16V-24.43L106.56 -26.69L110.78 -34.8H116.35V-27.41H127.87V-20.16H116.35V-12.1Q116.35 -9.12 117.55 -7.92Q118.75 -6.72 121.92 -6.72Q123.94 -6.72 125.5 -7.08Q127.06 -7.44 128.35 -8.02V-0.62Q126.91 -0.1 124.56 0.34Q122.21 0.77 119.71 0.77Q115.15 0.77 112.25 -0.62Q109.34 -2.02 107.95 -4.63Q106.56 -7.25 106.56 -10.75V-20.16Z M131.14 -36.96H140.98V-23.09Q142.66 -25.39 145.01 -26.69Q147.74 -28.22 151.01 -28.22Q154.99 -28.22 157.75 -26.64Q160.51 -25.06 162 -22.18Q163.49 -19.3 163.49 -15.36V0H153.65V-13.92Q153.65 -16.99 152.09 -18.62Q150.53 -20.26 147.6 -20.26Q145.58 -20.26 144.07 -19.39Q142.56 -18.53 141.77 -16.94Q140.98 -15.36 140.98 -13.2V0H131.14Z M166.37 -36H176.11L174.19 -19.92H168.29Z M211.1 -8.93Q211.1 -5.76 209.18 -3.6Q207.26 -1.44 203.71 -0.34Q200.16 0.77 195.17 0.77Q190.03 0.77 186.17 -0.48Q182.3 -1.73 180.14 -3.98Q177.98 -6.24 177.84 -9.22H187.78Q188.11 -8.11 189.1 -7.32Q190.08 -6.53 191.71 -6.12Q193.34 -5.71 195.6 -5.71Q198.53 -5.71 200.04 -6.29Q201.55 -6.86 201.55 -8.02Q201.55 -8.93 200.4 -9.38Q199.25 -9.84 196.46 -10.08L191.62 -10.46Q186.77 -10.8 183.91 -11.93Q181.06 -13.06 179.81 -14.86Q178.56 -16.66 178.56 -18.96Q178.56 -22.08 180.5 -24.12Q182.45 -26.16 185.93 -27.19Q189.41 -28.22 194.06 -28.22Q198.67 -28.22 202.27 -27.02Q205.87 -25.82 208.03 -23.69Q210.19 -21.55 210.53 -18.67H200.59Q200.35 -19.58 199.54 -20.33Q198.72 -21.07 197.28 -21.55Q195.84 -22.03 193.58 -22.03Q190.94 -22.03 189.58 -21.46Q188.21 -20.88 188.21 -19.82Q188.21 -19.01 189.05 -18.53Q189.89 -18.05 192.19 -17.86L198.58 -17.38Q203.33 -17.09 206.06 -16.01Q208.8 -14.93 209.95 -13.15Q211.1 -11.38 211.1 -8.93Z  M255.7 -11.33V-36H265.34V0H252.82L235.06 -25.3V0H225.41V-36H238.27Z M286.27 0.77Q281.28 0.77 277.37 -1.06Q273.46 -2.88 271.2 -6.17Q268.94 -9.46 268.94 -13.82Q268.94 -18.1 271.1 -21.34Q273.26 -24.58 277.03 -26.4Q280.8 -28.22 285.55 -28.22Q290.5 -28.22 293.98 -26.09Q297.46 -23.95 299.35 -20.06Q301.25 -16.18 301.25 -10.9H279.6Q279.79 -10.51 280.03 -10.18Q281.18 -8.35 283.46 -7.39Q285.74 -6.43 289.06 -6.43Q292.08 -6.43 295.08 -7.22Q298.08 -8.02 300.53 -9.46V-3.22Q297.7 -1.3 294.07 -0.26Q290.45 0.77 286.27 0.77ZM279.17 -16.8H292.13Q291.84 -17.62 291.46 -18.34Q290.59 -19.78 289.18 -20.54Q287.76 -21.31 285.79 -21.31Q283.63 -21.31 282.1 -20.45Q280.56 -19.58 279.7 -18.1Q279.36 -17.47 279.17 -16.8Z M301.82 -20.16V-24.43L307.39 -26.69L311.62 -34.8H317.18V-27.41H328.7V-20.16H317.18V-12.1Q317.18 -9.12 318.38 -7.92Q319.58 -6.72 322.75 -6.72Q324.77 -6.72 326.33 -7.08Q327.89 -7.44 329.18 -8.02V-0.62Q327.74 -0.1 325.39 0.34Q323.04 0.77 320.54 0.77Q315.98 0.77 313.08 -0.62Q310.18 -2.02 308.78 -4.63Q307.39 -7.25 307.39 -10.75V-20.16Z M367.87 -9.79 374.11 -27.41H383.9L373.63 0H363.65L356.69 -18.43L349.63 0H339.65L329.38 -27.41H339.26L345.5 -9.74L352.03 -27.41H361.39Z M401.81 0.77Q396.53 0.77 392.59 -1.03Q388.66 -2.83 386.45 -6.12Q384.24 -9.41 384.24 -13.68Q384.24 -18.05 386.45 -21.31Q388.66 -24.58 392.59 -26.4Q396.53 -28.22 401.81 -28.22Q407.04 -28.22 411 -26.4Q414.96 -24.58 417.17 -21.31Q419.38 -18.05 419.38 -13.68Q419.38 -9.41 417.17 -6.12Q414.96 -2.83 411 -1.03Q407.04 0.77 401.81 0.77ZM401.81 -6.48Q404.21 -6.48 405.91 -7.34Q407.62 -8.21 408.53 -9.84Q409.44 -11.47 409.44 -13.68Q409.44 -15.98 408.53 -17.59Q407.62 -19.2 405.91 -20.06Q404.21 -20.93 401.81 -20.93Q399.41 -20.93 397.68 -20.06Q395.95 -19.2 395.04 -17.59Q394.13 -15.98 394.13 -13.73Q394.13 -11.47 395.04 -9.84Q395.95 -8.21 397.68 -7.34Q399.41 -6.48 401.81 -6.48Z M421.01 -27.41H430.99L432.19 -20.11Q432.91 -22.18 434.02 -23.86Q435.31 -25.87 437.28 -27.05Q439.25 -28.22 442.08 -28.22Q442.9 -28.22 443.76 -28.13Q444.62 -28.03 445.49 -27.84V-19.49Q444.05 -19.78 442.78 -19.9Q441.5 -20.02 440.45 -20.02Q438.34 -20.02 436.56 -19.18Q434.78 -18.34 433.7 -16.42Q432.62 -14.5 432.62 -11.28V0H422.83V-18.19Z M457.49 -12.05 469.97 -27.41H480.29L470.78 -16.51L481.01 0H469.97L464.54 -9.31L456.43 0H447.65V-36.96H457.49Z" fill="currentColor"/></svg>`;
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
  unread: {}, srvUnread: {}, notif: 0, important: 0, msgs: {}, replyTo: null, serverFeed: false,
  prefs: JSON.parse(localStorage.getItem('nc_prefs') || '{}'),
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
  if (r.status === 401 && S.token && path !== '/login') { logout(true); throw new Error('Сессия истекла'); }
  if (!r.ok) throw new Error(data.error || 'Ошибка');
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
  $('#a-eye').setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  inp.focus();
};
$('#a-toggle').onclick = (e) => {
  $('#a-pass').autocomplete = regMode ? 'current-password' : 'new-password';
  e.preventDefault();
  regMode = !regMode;
  $('#a-submit').textContent = regMode ? 'Создать аккаунт' : 'Войти';
  $('#a-title').textContent = regMode ? 'Создай аккаунт' : 'С возвращением';
  $('#a-toggle').textContent = regMode ? 'Уже есть аккаунт? войти' : 'Нет аккаунта? зарегистрироваться';
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
  openHome();
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
  const dmUnread = Object.values(S.dmUnread || {}).reduce((x, y) => x + y, 0);
  const on = (c) => (c ? 'on' : '');
  const bell = S.important ? badge(S.important, true) : S.notif ? '<span class="badge dot"></span>' : '';
  r.innerHTML =
    `<div class="ic ${on(S.view.page === 'notif')}" data-act="notif" data-tip="Уведомления">${ic('bell')}${bell}</div>` +
    `<div class="ic ${on(S.view.type === 'home')}" data-act="home" data-tip="Личные сообщения">${ic('chat')}${badge(dmUnread, true)}</div><div class="sep"></div>` +
    S.servers.map((s) => `<div class="ic ${on(S.view.type === 'server' && S.server?.server.id === s.id)}" data-sid="${s.id}" data-tip="${esc(s.name)}">${esc(s.name.slice(0, 2))}${badge(S.srvUnread[s.id])}</div>`).join('') +
    `<div class="ic add" data-act="add" data-tip="Добавить сервер">${ic('plus')}</div>`;
  r.onclick = (e) => {
    const t = e.target.closest('.ic');
    if (!t) return;
    const a = t.dataset.act;
    if (a === 'home') openHome();
    else if (a === 'notif') openNotifications();
    else if (a === 'add') addServerModal();
    else openServer(Number(t.dataset.sid));
  };
  // сервера для телефона (рейл там скрыт)
  const chips = $('#side-chips');
  if (chips) {
    chips.innerHTML = S.servers.map((s) => `<button class="chip-btn ${on(S.view.type === 'server' && S.server?.server.id === s.id)}" data-sid="${s.id}">${esc(s.name)}${badge(S.srvUnread[s.id])}</button>`).join('');
    chips.onclick = (e) => { const b = e.target.closest('[data-sid]'); if (b) openServer(Number(b.dataset.sid)); };
  }
  renderBnav?.();
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
  modal(`<h3>Новый сервер</h3>
    <input id="m-name" placeholder="Название сервера">
    <button id="m-create">Создать</button>
    <div class="muted" style="text-align:center">Или</div>
    <input id="m-code" placeholder="Код приглашения">
    <button class="ghost" id="m-join">Присоединиться</button>
    <button class="ghost" id="m-disc">${ic('compass')} Каталог открытых серверов</button>
    <div class="error" id="m-err"></div>`, (c) => {
    c.querySelector('#m-disc').onclick = () => { closeModal(); discoverModal(); };
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

function inviteModal() {
  const link = `${location.origin}/?join=${S.server.server.invite}`;
  modal(`<h3>Пригласить людей</h3>
    <div class="muted">Код: <b>${esc(S.server.server.invite)}</b></div>
    <input readonly value="${esc(link)}" onclick="this.select()">
    <div class="modal-actions"><button id="m-ok">Готово</button></div>`, (c) => { c.querySelector('#m-ok').onclick = closeModal; });
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
  $('#side-head').innerHTML = '<span>Личные сообщения</span>';
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
    `<div class="item ${!S.channel ? 'on' : ''}" data-act="friends">${ic('friends')} Друзья</div><div class="cat">Личные сообщения</div>` +
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
  const tabs = [['friends', 'В сети'], ['all', 'Все'], ['pending', 'Ожидание'], ['add', 'Добавить в друзья']];
  if (S.homeTab === 'incoming') S.homeTab = 'pending';
  if (!tabs.some(([k]) => k === S.homeTab)) S.homeTab = 'friends';
  $('#main-head').innerHTML = burger() + `<span class="fr-title">${ic('users')}<b>Друзья</b></span><span class="fr-dot"></span><div class="tabs">${tabs.map(([k, n]) =>
    `<button class="${S.homeTab === k ? 'on' : ''}${k === 'add' ? ' add-tab' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>`;
  $('#main-head').onclick = (e) => { const t = e.target.closest('[data-tab]'); if (t) { S.homeTab = t.dataset.tab; showFriends(); } else burgerClick(e); };
  const v = $('#view');
  renderActiveContacts();
  if (S.homeTab === 'add') {
    v.innerHTML = `<div class="home addpage"><h2>Добавить в друзья</h2><div class="lead">Вы можете добавить друзей по нику.</div>
      <div class="addbox"><div class="addrow"><input id="f-name" placeholder="Введите ник" autocomplete="off"><button id="f-send" disabled>Отправить запрос дружбы</button></div></div>
      <div id="f-msg" class="muted small"></div>
      <div class="sep-line"></div><h2>Где ещё можно завести друзей</h2>
      <div class="lead">Нет знакомых пользователей? Тогда просмотрите каталог открытых серверов, где найдётся всё: от игр до музыки и кулинарии.</div>
      <button class="disc-card" id="f-disc"><span class="disc-ic">${ic('compass')}</span><b class="grow">Исследуйте доступные серверы</b>${ic('chevron')}</button></div>`;
    const inp = $('#f-name'), btn = $('#f-send');
    inp.oninput = () => { btn.disabled = !inp.value.trim(); };
    inp.onkeydown = (e) => { if (e.key === 'Enter' && !btn.disabled) btn.click(); };
    btn.onclick = async () => {
      try { await api('/friends', { body: { username: inp.value.trim() } }); $('#f-msg').innerHTML = `Запрос отправлен пользователю <b>${esc(inp.value.trim())}</b>.`; inp.value = ''; btn.disabled = true; await refreshHome(); }
      catch (e) { $('#f-msg').innerHTML = `<span class="error">${esc(e.message)}</span>`; }
    };
    $('#f-disc').onclick = () => discoverModal();
    inp.focus();
    return;
  }
  const list = S.friends.filter((f) => S.homeTab === 'friends' ? f.status === 'friend' && f.online : S.homeTab === 'all' ? f.status === 'friend' : f.status !== 'friend');
  v.innerHTML = `<div class="home">${list.length ? list.map((f) => `
    <div class="row">${avatar(f.username, 36, f.status === 'friend' ? f.online : undefined)}<div class="grow"><b>${esc(f.username)}</b>${f.status === 'outgoing' ? '<div class="muted">Запрос отправлен</div>' : ''}</div>
    ${f.status === 'friend' ? `<button data-dm="${f.id}">Сообщение</button>` : ''}
    ${f.status === 'incoming' ? `<button data-acc="${f.id}">Принять</button>` : ''}
    <button class="ghost" data-del="${f.id}" aria-label="Удалить">${ic('close')}</button></div>`).join('') : '<div class="empty"><b>Здесь пока пусто</b>Добавь друзей по нику</div>'}</div>`;
  v.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dm) { const r = await api('/dms', { body: { userId: Number(b.dataset.dm) } }); await refreshHome(); openChannel({ id: r.id, name: r.username, type: 'dm' }); }
    if (b.dataset.acc) { await api(`/friends/${b.dataset.acc}/accept`, { method: 'POST' }); await refreshHome(); showFriends(); }
    if (b.dataset.del) { await api(`/friends/${b.dataset.del}`, { method: 'DELETE' }); await refreshHome(); showFriends(); }
  };
}

function renderActiveContacts() {
  setLayout(true);
  const on = S.friends.filter((f) => f.status === 'friend' && f.online);
  $('#members').innerHTML = `<h3 class="ac-title">Активные контакты</h3>` + (on.length
    ? `<div class="ac-list">${on.map((f) => `<div class="ac-row" data-user="${esc(f.username)}">${avatar(f.username, 36, true)}<div class="grow"><b>${esc(f.username)}</b><div class="muted small">${f.activity ? esc(f.activity) : 'В сети'}</div></div><button class="icon-btn" data-dm="${f.id}" title="Написать" aria-label="Написать">${ic('chat')}</button></div>`).join('')}</div>`
    : `<div class="ac-empty"><b>Пока тихо…</b><div class="muted small">Когда кто-то из друзей зайдёт в сеть или во что-то сыграет, он появится здесь.</div></div>`);
  $('#members').onclick = async (e) => {
    const b = e.target.closest('[data-dm]');
    if (!b) return;
    e.stopPropagation();
    const r = await api('/dms', { body: { userId: Number(b.dataset.dm) } }); await refreshHome(); openChannel({ id: r.id, name: r.username, type: 'dm' });
  };
}

// ---------- сервер
async function openServer(id, channelId) {
  setLayout(true);
  closeWs();
  S.view = { type: 'server' };
  S.server = await api(`/servers/${id}`);
  normServer();
  const chs = S.server.channels;
  const target = chs.find((c) => c.id === channelId) || chs.find((c) => c.type === 'text');
  renderRail();
  renderServerSide();
  renderMembers();
  if (target) openChannel(target);
  else { $('#view').innerHTML = '<div class="empty"><b>Каналов нет</b>Владелец сервера может создать первый</div>'; $('#main-head').innerHTML = burger(); }
}

function renderServerSide() {
  const { server, channels } = S.server;
  const owner = server.owner_id === S.user.id;
  const canCh = can(PERM.CHANNELS);
  $('#side-head').innerHTML = `<span>${esc(server.name)}</span><span><button class="icon-btn" id="inv" title="Пригласить" aria-label="Пригласить">${ic('userplus')}</button>${can(PERM.SERVER | PERM.ROLES | PERM.KICK | PERM.CHANNELS) ? `<button class="icon-btn" id="srv-set" title="Настройки сервера" aria-label="Настройки сервера">${ic('settings')}</button>` : ''}<button class="icon-btn" id="leave" title="${owner ? 'Удалить сервер' : 'Выйти'}" aria-label="Меню сервера">${ic('more')}</button></span>`;
  $('#inv').onclick = inviteModal;
  if ($('#srv-set')) $('#srv-set').onclick = serverSettingsModal;
  $('#leave').onclick = async () => {
    if (!confirm(owner ? 'Удалить сервер навсегда?' : 'Выйти с сервера?')) return;
    await api(`/servers/${server.id}`, { method: 'DELETE' }); await loadServers(); openHome();
  };
  const group = (type, title) => `<div class="cat"><span>${title}</span>${canCh ? `<button data-add="${type}" title="Создать канал" aria-label="Создать канал">${ic('plus')}</button>` : ''}</div>` +
    channels.filter((c) => c.type === type).map((c) => `<div class="item ${S.channel?.id === c.id ? 'on' : ''}" data-ch="${c.id}">${ic(c.is_private ? 'lock' : type === 'text' ? 'hash' : 'speaker')} <span class="grow">${esc(c.name)}</span>${canCh ? `<button class="icon-btn ch-gear" data-gear="${c.id}" title="Настройки канала" aria-label="Настройки канала">${ic('settings')}</button>` : ''}${badge(S.unread[c.id])}</div>` +
      (type === 'voice' ? `<div class="voice-users" id="vu-${c.id}">${(S.voiceUsers[c.id] || []).map((n) => `<div>• ${esc(n)}</div>`).join('')}</div>` : '')).join('');
  $('#side-list').innerHTML = group('text', 'Текстовые каналы') + group('voice', 'Голосовые каналы');
  $('#side-list').onclick = (e) => {
    const g = e.target.closest('[data-gear]');
    if (g) { e.stopPropagation(); return channelSettings(channels.find((c) => c.id === Number(g.dataset.gear))); }
    if (e.target.closest('[data-add]')) return channelModal(e.target.closest('[data-add]').dataset.add);
    if (e.target.closest('[data-sfeed]')) { $('#app').classList.remove('show-side'); return openServerFeed(); }
    const t = e.target.closest('[data-ch]');
    if (!t) return;
    const ch = channels.find((c) => c.id === Number(t.dataset.ch));
    openChannel(ch);
  };
  updateVoiceBar();
}

function renderMembers() {
  const { members, server } = S.server;
  const owner = can(PERM.KICK);
  const row = (m) => `<div class="item mem ${m.online ? '' : 'off'}" data-user="${esc(m.username)}">${avatar(m.username, 32, m.online)}<span class="mn"${m.color ? ` style="color:${m.color}"` : ''}>${esc(m.username)}${m.id === server.owner_id ? ' <span class="muted small">· владелец</span>' : ''}</span>${owner && m.id !== S.user.id && m.id !== server.owner_id ? `<button class="icon-btn kick" data-kick="${m.id}" title="Исключить" aria-label="Исключить">${ic('close')}</button>` : ''}</div>`;
  const on = members.filter((m) => m.online), off = members.filter((m) => !m.online);
  $('#members').innerHTML = (on.length ? `<div class="cat">В сети — ${on.length}</div>` + on.map(row).join('') : '') + (off.length ? `<div class="cat">Не в сети — ${off.length}</div>` + off.map(row).join('') : '');
  $('#members').onclick = async (e) => {
    const k = e.target.closest('[data-kick]');
    if (k) { e.stopPropagation(); if (confirm('Исключить участника?')) { await api(`/servers/${server.id}/kick/${k.dataset.kick}`, { method: 'POST' }); openServer(server.id, S.channel?.id); } }
  };
}

// ---------- каналы
function burger() { return `<button class="icon-btn burger" data-burger="1" aria-label="Меню">${ic('menu')}</button>`; }
function burgerClick(e) { if (e.target.closest('[data-burger]')) $('#app').classList.toggle('show-side'); }

function openChannel(ch) {
  $('#app').classList.remove('show-side');
  if (ch.type === 'voice') return openVoice(ch);
  closeWs();
  S.channel = ch;
  if (S.view.type === 'home') { setLayout(false); $('#members').innerHTML = ''; }
  S.serverFeed = false;
  S.typing = {};
  S.replyTo = null;
  if (S.unread[ch.id]) { delete S.unread[ch.id]; recountUnread?.(); }
  if (S.view.type === 'server') renderServerSide(); else renderHomeSide();
  renderRail();
  $('#main-head').innerHTML = `${burger()}<span class="muted">${ch.type === 'dm' ? '@' : ic(ch.is_private ? 'lock' : 'hash')}</span> <span>${esc(ch.name)}</span>${ch.topic ? `<span class="ch-topic grow" title="${esc(ch.topic)}">${esc(ch.topic)}</span>` : '<span class="grow"></span>'}${ch.slowmode ? `<span class="muted small slow-tag" title="Медленный режим">${ic('clock')} ${slowLabel(ch.slowmode)}</span>` : ''}${S.view.type === 'server' && can(PERM.CHANNELS) ? `<button class="icon-btn" id="ch-set" title="Настройки канала" aria-label="Настройки канала">${ic('settings')}</button>` : ''}${S.view.type === 'server' ? `<button class="icon-btn ${S.prefs.hideMembers ? '' : 'on'}" id="mem-tg" title="${S.prefs.hideMembers ? 'Показать участников' : 'Скрыть участников'}" aria-label="Список участников" aria-pressed="${!S.prefs.hideMembers}">${ic('users')}</button>` : ''}<button class="icon-btn" id="threads" title="Ветки" aria-label="Ветки">${ic('thread')}</button><button class="icon-btn" id="pins" title="Закреплённые" aria-label="Закреплённые">${ic('pin')}</button>`;
  $('#main-head').onclick = (e) => { burgerClick(e); if (e.target.closest('#pins')) pinsModal(); if (e.target.closest('#threads')) threadsPopover(); if (e.target.closest('#ch-set')) channelSettings(ch); if (e.target.closest('#mem-tg')) toggleMembers(); };
  const v = $('#view');
  v.onclick = null;
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  v.innerHTML = `<div class="msgs" id="msgs"></div><div class="typing" id="typing"></div><div id="pf"></div><div id="reply-bar"></div>${ch.slowmode && ch.type !== 'dm' && !can(PERM.MESSAGES) ? `<div class="slow-note">${ic('clock')} Медленный режим: ${slowLabel(ch.slowmode)}</div>` : ''}
    <div class="composer"><button class="clip" id="clip" title="${S.config.files ? 'Прикрепить файл' : 'Файлы пока отключены'}" aria-label="Прикрепить файл" ${S.config.files ? '' : 'disabled'}>${ic('plus')}</button>
    <textarea id="inp" rows="1" placeholder="Написать в ${ch.type === 'dm' ? '@' : '#'}${esc(ch.name)}"></textarea>${S.config.files && window.MediaRecorder ? `<button class="clip" id="vnote" title="Голосовое сообщение" aria-label="Голосовое сообщение">${ic('mic')}</button>` : ''}<button id="send" aria-label="Отправить">${ic('send')}</button></div>
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
  $('#vnote')?.addEventListener('click', toggleVoiceNote);
  $('#clip').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('#pf').innerHTML = `<div class="pending-file"><span>Загрузка: ${esc(f.name)}…</span></div>`;
    try {
      S.pendingFile = await uploadFile(f);
      $('#pf').innerHTML = `<div class="pending-file"><span>${esc(f.name)}</span><a href="#" id="pf-x">Убрать</a></div>`;
      $('#pf-x').onclick = (ev) => { ev.preventDefault(); S.pendingFile = null; $('#pf').innerHTML = ''; };
    } catch (er) { $('#pf').innerHTML = `<div class="pending-file error">${esc(er.message)}</div>`; }
    e.target.value = '';
  };
  inp.focus();
}
let rec = null;
async function toggleVoiceNote() {
  const btn = $('#vnote');
  if (rec) { rec.stop(); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('Нет доступа к микрофону'); }
  const chunks = [], t0 = Date.now(), cid = S.channel.id;
  const r = new MediaRecorder(stream);
  rec = r;
  btn.classList.add('recording'); btn.innerHTML = ic('stop');
  $('#pf').innerHTML = '<div class="pending-file"><span>Идёт запись… нажми ещё раз, чтобы отправить</span></div>';
  r.ondataavailable = (e) => chunks.push(e.data);
  r.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    rec = null;
    btn.classList?.remove('recording'); if (btn) btn.innerHTML = ic('mic');
    $('#pf') && ($('#pf').innerHTML = '');
    if (Date.now() - t0 < 700) return;
    try {
      const att = await uploadFile(new File([new Blob(chunks, { type: 'audio/webm' })], `Голосовое-${Date.now()}.webm`, { type: 'audio/webm' }));
      await api(`/channels/${cid}/messages`, { body: { content: '', ...att } });
    } catch (er) { toast(er.message); }
  };
  r.start();
  setTimeout(() => { if (rec === r) r.stop(); }, 120000);
}
async function uploadFile(f) {
  return api('/upload', { method: 'POST', body: f, headers: { 'x-filename': encodeURIComponent(f.name || 'file'), 'content-type': (f.type || 'application/octet-stream').split(';')[0] } });
}
function setReply(m) {
  S.replyTo = m ? m.id : null;
  const bar = $('#reply-bar');
  if (!bar) return;
  bar.innerHTML = m ? `<div class="reply-bar">${ic('reply')}<span class="grow">Ответ ${esc(m.username)}: ${esc((m.content || 'Вложение').slice(0, 80))}</span><button class="icon-btn" id="rb-x" aria-label="Отменить">${ic('close')}</button></div>` : '';
  if (m) { $('#rb-x').onclick = () => setReply(null); $('#inp')?.focus(); }
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

const dayKey = (t) => new Date(t).toDateString();
function dayLabel(t, short) {
  const d = new Date(t), now = new Date(), y = new Date(now.getTime() - 864e5);
  if (d.toDateString() === now.toDateString()) return short ? 'Сегодня, ' : 'Сегодня';
  if (d.toDateString() === y.toDateString()) return short ? 'Вчера, ' : 'Вчера';
  return short ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
const dayDivider = (prevT, t) => (!prevT || dayKey(prevT) !== dayKey(t)) ? `<div class="day-div"><span>${dayLabel(t)}</span></div>` : '';
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
  const owner = !!(S.server && can(PERM.MESSAGES));
  const cont = prev && prev.user_id === m.user_id && m.created_at - prev.created_at < 300000 && !m.reply_to;
  const when = fmtTime(m.created_at);
  const hhmm = new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const gutter = `<div class="gutter">${cont ? `<span class="hover-time">${hhmm}</span>` : `<span data-user="${esc(m.username)}" class="clickable">${avatar(m.username, 40)}</span>`}</div>`;
  const name = cont ? '' : `<div class="who"><a href="#" data-user="${esc(m.username)}"${m.role_color ? ` style="color:${m.role_color}"` : ''}>${esc(m.username)}</a><time title="${when}">${dayLabel(m.created_at, true)}${hhmm}</time></div>`;
  const quote = m.reply_to ? `<div class="quote" data-jump="${m.reply_to}"><b>${esc(m.reply_name || '?')}</b> ${esc(m.reply_content || 'Сообщение удалено')}</div>` : '';
  const reacts = (m.reactions || []).length ? `<div class="reacts">${m.reactions.map((r) => `<button class="react ${r.users.includes(S.user.id) ? 'on' : ''}" data-react="${r.emoji}">${r.emoji} <span>${r.users.length}</span></button>`).join('')}</div>` : '';
  const linked = m.content ? linkify(m.content) : '';
  const tools = `<div class="mtools">
    <button data-tool="react" title="Реакция" aria-label="Реакция">${ic('smile')}</button>
    <button data-tool="reply" title="Ответить" aria-label="Ответить">${ic('reply')}</button>
    ${m.thread_id ? '' : `<button data-tool="thread" title="Ветка" aria-label="Ветка">${ic('thread')}</button>`}
    ${mine ? `<button data-tool="edit" title="Изменить" aria-label="Изменить">${ic('edit')}</button>` : ''}
    ${!S.server || owner ? `<button data-tool="pin" title="Закрепить" aria-label="Закрепить">${ic('pin')}</button>` : ''}
    ${!mine ? `<button data-tool="report" title="Пожаловаться" aria-label="Пожаловаться">${ic('flag')}</button>` : ''}
    ${mine || owner ? `<button data-tool="del" title="Удалить" aria-label="Удалить">${ic('trash')}</button>` : ''}</div>`;
  return `<div class="msg ${mine ? 'own' : ''} ${cont ? 'cont' : ''} ${m.pinned ? 'is-pinned' : ''}" data-id="${m.id}" data-uid="${m.user_id}" data-t="${m.created_at}">${gutter}<div class="body">${name}
    ${quote}${linked ? `<div class="bubble" title="${when}">${linked}${m.edited_at ? ' <span class="edited">(изм.)</span>' : ''}${m.pinned ? `<span class="pin-mark">${ic('pin')}</span>` : ''}</div>` : ''}${att}${reacts}${m.thread_count ? `<button class="thread-link" data-thread="${m.id}">${ic('thread')} ${plural(m.thread_count, 'ответ', 'ответа', 'ответов')} ›</button>` : ''}${tools}</div></div>`;
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
  const seenKey = `nc_seen_${cid}`, seen = Number(localStorage.getItem(seenKey) || 0);
  let newShown = !seen;
  box.innerHTML = d.messages.length ? d.messages.map((m, i) => {
    const prev = d.messages[i - 1];
    let pre = dayDivider(prev?.created_at, m.created_at);
    if (!newShown && m.id > seen && m.user_id !== S.user.id) { newShown = true; pre += '<div class="new-div"><span>Новые сообщения</span></div>'; }
    return pre + msgHtml(m, pre ? null : prev);
  }).join('') : '<div class="empty"><b>Здесь пока тихо</b>Напиши первое сообщение</div>';
  if (d.messages.length) localStorage.setItem(seenKey, String(d.messages[d.messages.length - 1].id));
  const nd = box.querySelector('.new-div');
  if (nd) nd.scrollIntoView({ block: 'center' }); else box.scrollTop = box.scrollHeight;
  api(`/channels/${cid}/read`, { method: 'POST' }).catch(() => {});
  box.onclick = async (e) => {
    const a = e.target.closest('a[href*="?post="]');
    if (a) { e.preventDefault(); const id = Number(new URL(a.href).searchParams.get('post')); if (id) { await openFeed(); openThread(id); } return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) { const t = box.querySelector(`.msg[data-id="${jump.dataset.jump}"]`); t?.scrollIntoView({ block: 'center', behavior: 'smooth' }); t?.classList.add('flash'); setTimeout(() => t?.classList.remove('flash'), 1200); return; }
    const row = e.target.closest('.msg');
    if (!row) return;
    const id = Number(row.dataset.id), m = S.msgs[id];
    if (e.target.closest('[data-thread]')) return openMsgThread(id);
    const re = e.target.closest('[data-react]');
    if (re) return api(`/messages/${id}/react`, { body: { emoji: re.dataset.react } });
    const t = e.target.closest('[data-tool]');
    if (!t) return;
    const tool = t.dataset.tool;
    if (tool === 'del') await api(`/messages/${id}`, { method: 'DELETE' });
    else if (tool === 'reply') setReply(m);
    else if (tool === 'thread') openMsgThread(id);
    else if (tool === 'pin') { const r = await api(`/messages/${id}/pin`, { method: 'POST' }); toast(r.pinned ? 'Закреплено' : 'Откреплено'); }
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
    if (d.type === 'message' && d.message.thread_id) {
      onThreadMessage(d.message);
    } else if (d.type === 'message') {
      const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      if (box.querySelector('.empty')) box.innerHTML = '';
      const last = box.lastElementChild;
      const lastMsg = [...box.querySelectorAll('.msg')].pop();
      const dd = dayDivider(lastMsg ? Number(lastMsg.dataset.t) : 0, d.message.created_at);
      box.insertAdjacentHTML('beforeend', dd + msgHtml(d.message, dd ? null : prevInfo({ previousElementSibling: last })));
      localStorage.setItem(`nc_seen_${cid}`, String(d.message.id));
      if (atBottom || d.message.user_id === S.user.id) box.scrollTop = box.scrollHeight;
      if (d.message.user_id !== S.user.id) api(`/channels/${cid}/read`, { method: 'POST' }).catch(() => {});
    } else if (d.type === 'delete') {
      box.querySelector(`.msg[data-id="${d.id}"]`)?.remove();
      document.querySelector(`#thread-panel .tmsg[data-id="${d.id}"]`)?.remove();
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
    v.innerHTML = `<div class="voice-room"><h3>${esc(ch.name)}</h3><div class="muted">Голосовой канал. нужен доступ к микрофону.</div>
      <div><button id="vjoin">Подключиться</button></div></div>`;
    $('#vjoin').onclick = () => joinVoice(ch);
    return;
  }
  const canShare = !!navigator.mediaDevices?.getDisplayMedia;
  const tiles = [{ name: S.user.username + ' (ты)', cid: 'me' }, ...Object.entries(S.voice.peers).map(([cid, p]) => ({ name: p.name, cid }))];
  v.innerHTML = `<div class="voice-room"><h3>${esc(ch.name)}</h3><div id="stage" class="stage"></div><div class="tiles">${tiles.map((t) =>
    `<div class="tile" id="tile-${t.cid}">${avatar(t.name, 48)}<div>${esc(t.name)}</div></div>`).join('')}</div>
    <div><button id="vmute" class="ghost btn-ic">${ic(S.voice.muted ? 'micoff' : 'mic')} ${S.voice.muted ? 'Включить микрофон' : 'Выключить микрофон'}</button> ${canShare ? `<button id="vshare" class="ghost btn-ic">${ic('screen')} ${S.voice.screen ? 'Остановить показ' : 'Показать экран'}</button>` : ''} <button id="vclip" class="ghost btn-ic ${S.voice.watch ? '' : 'hidden'}" title="Сохранить последние ~30 секунд">${ic('scissors')} клип</button> <button id="vleave" class="danger">Выйти из канала</button></div>
    <div class="muted small">${canShare ? 'Во время показа экрана любой участник может нажать «клип» — последние ~30 секунд сохранятся в ленту.' : 'Показ экрана доступен в десктопных браузерах.'}</div></div>`;
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
  catch { return alert('Нет доступа к микрофону'); }
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
  b.innerHTML = `<div><b>Голос подключён</b><div class="muted">${esc(S.voice.name)}</div></div><div><button class="icon-btn" id="vb-mute">${ic(S.voice.muted ? 'micoff' : 'mic')}</button><button class="icon-btn" id="vb-leave" aria-label="Выйти из канала">${ic('close')}</button></div>`;
  $('#vb-mute').onclick = toggleMute;
  $('#vb-leave').onclick = leaveVoice;
}

function toggleMembers() {
  S.prefs.hideMembers = !S.prefs.hideMembers;
  applyPrefs();
  $('#app').classList.toggle('no-members', !!S.prefs.hideMembers);
  const b = $('#mem-tg');
  if (b) { b.classList.toggle('on', !S.prefs.hideMembers); b.title = S.prefs.hideMembers ? 'Показать участников' : 'Скрыть участников'; b.setAttribute('aria-pressed', String(!S.prefs.hideMembers)); }
}

// ---- подсказки у иконок слева (как в Discord)
(() => {
  let tip;
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('#rail [data-tip]');
    if (!t) { tip?.remove(); tip = null; return; }
    if (tip?._for === t) return;
    tip?.remove();
    tip = document.createElement('div');
    tip.className = 'tip'; tip.textContent = t.dataset.tip; tip._for = t;
    document.body.appendChild(tip);
    const r = t.getBoundingClientRect();
    tip.style.left = r.right + 12 + 'px';
    tip.style.top = r.top + r.height / 2 - tip.offsetHeight / 2 + 'px';
  });
  document.addEventListener('mouseleave', () => { tip?.remove(); tip = null; }, true);
})();
