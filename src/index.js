// notcord — worker: api + websocket (durable objects) + файлы (r2)

import { P, ALL_PERMS, permsOf, audit } from './perms.js';
import { handlePublic, handleSocial, enrichMessages, notify, mentionedUsers, isAdmin, isOnline } from './social.js';

const enc = new TextEncoder();
const MAX_FILE = 25 * 1024 * 1024;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
const err = (msg, status = 400) => json({ error: msg }, status);

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const rand = (n = 16) => hex(crypto.getRandomValues(new Uint8Array(n)));

async function hashPass(pass, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return hex(bits);
}

async function authUser(req, env, url) {
  let token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token && url) token = url.searchParams.get('token');
  if (!token) return null;
  return await env.DB.prepare(
    'SELECT u.id, u.username, u.avatar_key, u.bio, u.banner, u.status FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.banned_at IS NULL'
  ).bind(token).first();
}

async function newSession(env, userId) {
  const token = rand(24);
  await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)')
    .bind(token, userId, Date.now()).run();
  return token;
}

// доступ к каналу: участник сервера или участник лс
async function channelAccess(env, userId, channelId) {
  const ch = await env.DB.prepare('SELECT * FROM channels WHERE id = ?').bind(channelId).first();
  if (!ch) return null;
  if (ch.type === 'dm') {
    const m = await env.DB.prepare('SELECT 1 x FROM dm_members WHERE channel_id=? AND user_id=?')
      .bind(channelId, userId).first();
    return m ? ch : null;
  }
  const m = await env.DB.prepare('SELECT 1 x FROM members WHERE server_id=? AND user_id=?')
    .bind(ch.server_id, userId).first();
  if (!m) return null;
  if (ch.is_private) {
    if ((await permsOf(env, userId, ch.server_id)) & P.CHANNELS) return ch;
    const ok = await env.DB.prepare(
      'SELECT 1 x FROM channel_roles cr JOIN member_roles mr ON mr.role_id = cr.role_id WHERE cr.channel_id=? AND mr.user_id=? AND mr.server_id=?'
    ).bind(channelId, userId, ch.server_id).first();
    return ok ? ch : null;
  }
  return ch;
}

const MSG_SELECT = `SELECT m.id, m.channel_id, m.user_id, u.username, u.avatar_key, m.content,
  m.att_key, m.att_name, m.att_type, m.created_at, m.reply_to, m.edited_at, m.pinned,
  (SELECT substr(r.content, 1, 120) FROM messages r WHERE r.id = m.reply_to) AS reply_content,
  (SELECT ru.username FROM messages r JOIN users ru ON ru.id = r.user_id WHERE r.id = m.reply_to) AS reply_name,
  m.thread_id,
  (SELECT COUNT(*) FROM messages t WHERE t.thread_id = m.id) AS thread_count,
  (SELECT r.color FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.user_id = m.user_id AND r.server_id = (SELECT server_id FROM channels WHERE id = m.channel_id) AND r.color IS NOT NULL ORDER BY r.position, r.id LIMIT 1) AS role_color
  FROM messages m JOIN users u ON u.id = m.user_id`;

async function broadcast(env, room, payload) {
  const stub = env.ROOM.get(env.ROOM.idFromName(room));
  await stub.fetch('https://room/broadcast', { method: 'POST', body: JSON.stringify(payload) });
}


export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p.startsWith('/ws/')) return await handleWs(req, env, url);
      if (p.startsWith('/files/')) return await handleFile(env, p.slice(7));
      if (p.startsWith('/api/')) return await handleApi(req, env, url);
    } catch (e) {
      return err('ошибка сервера: ' + (e?.message || e), 500);
    }
    return env.ASSETS.fetch(req);
  },
};

async function handleFile(env, key) {
  if (!env.FILES) return new Response('files disabled', { status: 404 });
  const obj = await env.FILES.get(decodeURIComponent(key));
  if (!obj) return new Response('not found', { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers: h });
}

async function handleWs(req, env, url) {
  if (req.headers.get('upgrade') !== 'websocket') return err('нужен websocket', 426);
  const user = await authUser(req, env, url);
  if (!user) return err('не авторизован', 401);
  const [, , kind, idStr] = url.pathname.split('/'); // /ws/text/12 или /ws/voice/12
  const channelId = Number(idStr);
  const ch = await channelAccess(env, user.id, channelId);
  if (!ch) return err('нет доступа', 403);
  if (kind === 'voice' && ch.type !== 'voice') return err('это не голосовой канал', 400);
  const room = `${kind}:${channelId}`;
  const stub = env.ROOM.get(env.ROOM.idFromName(room));
  const u = new URL('https://room/ws');
  u.searchParams.set('uid', user.id);
  u.searchParams.set('name', user.username);
  u.searchParams.set('kind', kind);
  return stub.fetch(u.toString(), req);
}

async function handleApi(req, env, url) {
  const p = url.pathname.replace(/^\/api/, '');
  const m = req.method;
  const now = Date.now();

  const pub = await handlePublic({ req, env, url, p, m, now, json, err, rand, hashPass, newSession });
  if (pub) return pub;

  // --- регистрация / вход
  if (p === '/register' && m === 'POST') {
    const { username, password } = await req.json();
    if (!/^[\p{L}\p{N}_.-]{2,24}$/u.test(username || '')) return err('ник: 2–24 символа, буквы/цифры/_ . -');
    if (!password || password.length < 4) return err('пароль минимум 4 символа');
    const salt = rand(16);
    const hash = await hashPass(password, salt);
    try {
      const r = await env.DB.prepare('INSERT INTO users (username, pass_hash, pass_salt, created_at) VALUES (?,?,?,?)')
        .bind(username, hash, salt, now).run();
      const id = r.meta.last_row_id;
      return json({ token: await newSession(env, id), user: { id, username } });
    } catch {
      return err('этот ник уже занят', 409);
    }
  }
  if (p === '/login' && m === 'POST') {
    const { username, password } = await req.json();
    const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username || '').first();
    if (!u || (await hashPass(password || '', u.pass_salt)) !== u.pass_hash) return err('неверный ник или пароль', 401);
    if (u.banned_at) return err('аккаунт заблокирован', 403);
    return json({ token: await newSession(env, u.id), user: { id: u.id, username: u.username, avatar_key: u.avatar_key } });
  }

  const me = await authUser(req, env);
  if (!me) return err('не авторизован', 401);

  if (p === '/me') return json({ user: { ...me, is_admin: isAdmin(env, me) } });
  if (p === '/account/password' && m === 'POST') {
    const { old_password, new_password } = await req.json();
    const u = await env.DB.prepare('SELECT pass_hash, pass_salt FROM users WHERE id=?').bind(me.id).first();
    if ((await hashPass(old_password || '', u.pass_salt)) !== u.pass_hash) return err('текущий пароль неверный', 403);
    if (!new_password || new_password.length < 4) return err('новый пароль — минимум 4 символа');
    const salt = rand(16);
    await env.DB.prepare('UPDATE users SET pass_hash=?, pass_salt=? WHERE id=?').bind(await hashPass(new_password, salt), salt, me.id).run();
    const cur = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token != ?').bind(me.id, cur || '').run();
    return json({ ok: true });
  }
  if (p === '/account/username' && m === 'POST') {
    const { username, password } = await req.json();
    if (!/^[\p{L}\p{N}_.-]{2,24}$/u.test(username || '')) return err('ник: 2–24 символа, буквы/цифры/_ . -');
    const u = await env.DB.prepare('SELECT pass_hash, pass_salt FROM users WHERE id=?').bind(me.id).first();
    if ((await hashPass(password || '', u.pass_salt)) !== u.pass_hash) return err('пароль неверный', 403);
    try { await env.DB.prepare('UPDATE users SET username=? WHERE id=?').bind(username, me.id).run(); }
    catch { return err('этот ник уже занят', 409); }
    return json({ ok: true, username });
  }
  if (p === '/logout' && m === 'POST') {
    const t = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(t).run();
    return json({ ok: true });
  }

  // --- серверы
  if (p === '/servers' && m === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT s.id, s.name, s.owner_id, s.invite, s.is_public, s.description FROM servers s JOIN members mm ON mm.server_id = s.id WHERE mm.user_id = ? ORDER BY mm.joined_at'
    ).bind(me.id).all();
    return json({ servers: results });
  }
  if (p === '/servers' && m === 'POST') {
    const { name } = await req.json();
    const n = (name || '').trim().slice(0, 40);
    if (!n) return err('введи название');
    const r = await env.DB.prepare('INSERT INTO servers (name, owner_id, invite, created_at) VALUES (?,?,?,?)')
      .bind(n, me.id, rand(4), now).run();
    const sid = r.meta.last_row_id;
    await env.DB.batch([
      env.DB.prepare('INSERT INTO members (server_id, user_id, joined_at) VALUES (?,?,?)').bind(sid, me.id, now),
      env.DB.prepare('INSERT INTO channels (server_id, name, type, created_at) VALUES (?,?,?,?)').bind(sid, 'общий', 'text', now),
      env.DB.prepare('INSERT INTO channels (server_id, name, type, created_at) VALUES (?,?,?,?)').bind(sid, 'голосовой', 'voice', now),
    ]);
    return json({ id: sid });
  }
  if (p === '/servers/join' && m === 'POST') {
    const { code } = await req.json();
    const s = await env.DB.prepare('SELECT id FROM servers WHERE invite = ?').bind((code || '').trim().toLowerCase()).first();
    if (!s) return err('приглашение не найдено', 404);
    await env.DB.prepare('INSERT OR IGNORE INTO members (server_id, user_id, joined_at) VALUES (?,?,?)').bind(s.id, me.id, now).run();
    return json({ id: s.id });
  }

  let mt;
  if ((mt = p.match(/^\/servers\/(\d+)$/))) {
    const sid = Number(mt[1]);
    const mem = await env.DB.prepare('SELECT 1 x FROM members WHERE server_id=? AND user_id=?').bind(sid, me.id).first();
    if (!mem) return err('нет доступа', 403);
    const s = await env.DB.prepare('SELECT id, name, owner_id, invite, is_public, description FROM servers WHERE id=?').bind(sid).first();
    if (m === 'GET') {
      const [chs, mems, roles, mroles, myPerms, chRoles, myChan] = await Promise.all([
        env.DB.prepare('SELECT id, name, type, topic, slowmode, is_private FROM channels WHERE server_id=? ORDER BY id').bind(sid).all(),
        env.DB.prepare('SELECT u.id, u.username, u.avatar_key, u.last_seen FROM members mm JOIN users u ON u.id=mm.user_id WHERE mm.server_id=? ORDER BY u.username').bind(sid).all(),
        env.DB.prepare('SELECT id, name, color, perms, position FROM roles WHERE server_id=? ORDER BY position, id').bind(sid).all(),
        env.DB.prepare('SELECT mr.user_id, mr.role_id FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.server_id=? ORDER BY r.position, r.id').bind(sid).all(),
        permsOf(env, me.id, sid),
        env.DB.prepare('SELECT cr.channel_id, cr.role_id FROM channel_roles cr JOIN channels c ON c.id = cr.channel_id WHERE c.server_id=?').bind(sid).all(),
        env.DB.prepare('SELECT cr.channel_id FROM channel_roles cr JOIN member_roles mr ON mr.role_id = cr.role_id WHERE mr.user_id=? AND mr.server_id=?').bind(me.id, sid).all(),
      ]);
      const allowed = new Set(myChan.results.map((x) => x.channel_id));
      const visible = chs.results.filter((c) => !c.is_private || (myPerms & P.CHANNELS) || allowed.has(c.id));
      const crMap = {};
      for (const x of chRoles.results) (crMap[x.channel_id] ||= []).push(x.role_id);
      const byUser = {};
      for (const x of mroles.results) (byUser[x.user_id] ||= []).push(x.role_id);
      return json({ server: s, channels: visible.map((c) => ({ ...c, is_private: !!c.is_private, role_ids: (myPerms & P.CHANNELS) ? (crMap[c.id] || []) : undefined })), roles: roles.results, my_perms: myPerms,
        members: mems.results.map(({ last_seen, ...u }) => ({ ...u, role_ids: byUser[u.id] || [], online: isOnline(last_seen) })) });
    }
    if (m === 'PATCH') {
      if (!((await permsOf(env, me.id, sid)) & P.SERVER)) return err('недостаточно прав', 403);
      const n = ((await req.json()).name || '').trim().slice(0, 40);
      if (!n) return err('введи название');
      await env.DB.prepare('UPDATE servers SET name=? WHERE id=?').bind(n, sid).run();
      await audit(env, sid, me.id, 'server_rename', n, now);
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      if (s.owner_id === me.id) {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id=?))').bind(sid),
          env.DB.prepare('DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id=?)').bind(sid),
          env.DB.prepare('UPDATE posts SET server_id = NULL WHERE server_id=?').bind(sid),
          env.DB.prepare('DELETE FROM channels WHERE server_id=?').bind(sid),
          env.DB.prepare('DELETE FROM members WHERE server_id=?').bind(sid),
          env.DB.prepare('DELETE FROM member_roles WHERE server_id=?').bind(sid),
          env.DB.prepare('DELETE FROM channel_roles WHERE role_id IN (SELECT id FROM roles WHERE server_id=?)').bind(sid),
          env.DB.prepare('DELETE FROM roles WHERE server_id=?').bind(sid),
          env.DB.prepare('DELETE FROM emojis WHERE server_id=?').bind(sid),
          env.DB.prepare('DELETE FROM audit_log WHERE server_id=?').bind(sid),
          env.DB.prepare('DELETE FROM servers WHERE id=?').bind(sid),
        ]);
      } else {
        await env.DB.prepare('DELETE FROM members WHERE server_id=? AND user_id=?').bind(sid, me.id).run();
      }
      return json({ ok: true });
    }
  }
  if ((mt = p.match(/^\/servers\/(\d+)\/channels$/)) && m === 'POST') {
    const sid = Number(mt[1]);
    if (!((await permsOf(env, me.id, sid)) & P.CHANNELS)) return err('недостаточно прав', 403);
    const { name, type, is_private } = await req.json();
    const n = (name || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30);
    if (!n) return err('введи название');
    const t = type === 'voice' ? 'voice' : 'text';
    const r = await env.DB.prepare('INSERT INTO channels (server_id, name, type, created_at, is_private) VALUES (?,?,?,?,?)')
      .bind(sid, n, t, now, is_private ? 1 : 0).run();
    await audit(env, sid, me.id, 'channel_create', (t === 'voice' ? '🔊 ' : '# ') + n, now);
    return json({ id: r.meta.last_row_id });
  }
  // настройки канала: название, тема, медленный режим (только владелец сервера)
  if ((mt = p.match(/^\/channels\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const cid = Number(mt[1]);
    const ch = await env.DB.prepare('SELECT c.id, c.server_id, c.name FROM channels c WHERE c.id=? AND c.server_id IS NOT NULL').bind(cid).first();
    if (!ch || !((await permsOf(env, me.id, ch.server_id)) & P.CHANNELS)) return err('недостаточно прав', 403);
    if (m === 'DELETE') {
      const left = await env.DB.prepare('SELECT COUNT(*) n FROM channels WHERE server_id=?').bind(ch.server_id).first();
      if (left.n <= 1) return err('нельзя удалить последний канал');
      await env.DB.batch([
        env.DB.prepare('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE channel_id=?)').bind(cid),
        env.DB.prepare("DELETE FROM notifications WHERE channel_id=?").bind(cid),
        env.DB.prepare('DELETE FROM channel_reads WHERE channel_id=?').bind(cid),
        env.DB.prepare('DELETE FROM channel_roles WHERE channel_id=?').bind(cid),
        env.DB.prepare('DELETE FROM messages WHERE channel_id=?').bind(cid),
        env.DB.prepare('DELETE FROM channels WHERE id=?').bind(cid),
      ]);
      await audit(env, ch.server_id, me.id, 'channel_delete', ch.name, now);
      return json({ ok: true });
    }
    const b = await req.json();
    const sets = [], binds = [];
    if (typeof b.name === 'string') {
      const n = b.name.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30);
      if (!n) return err('введи название');
      sets.push('name = ?'); binds.push(n);
    }
    if (typeof b.topic === 'string') { sets.push('topic = ?'); binds.push(b.topic.trim().slice(0, 200) || null); }
    if (b.slowmode !== undefined) {
      const v = Math.max(0, Math.min(21600, Number(b.slowmode) || 0));
      sets.push('slowmode = ?'); binds.push(v);
    }
    if (b.is_private !== undefined) { sets.push('is_private = ?'); binds.push(b.is_private ? 1 : 0); }
    const extra = [];
    if (Array.isArray(b.roles)) {
      const { results } = await env.DB.prepare('SELECT id FROM roles WHERE server_id=?').bind(ch.server_id).all();
      const ok = new Set(results.map((r) => r.id));
      extra.push(env.DB.prepare('DELETE FROM channel_roles WHERE channel_id=?').bind(cid));
      for (const id of [...new Set(b.roles.map(Number))]) if (ok.has(id)) extra.push(env.DB.prepare('INSERT INTO channel_roles (channel_id, role_id) VALUES (?,?)').bind(cid, id));
    }
    if (!sets.length && !extra.length) return err('нечего менять');
    if (sets.length) await env.DB.prepare(`UPDATE channels SET ${sets.join(', ')} WHERE id=?`).bind(...binds, cid).run();
    if (extra.length) await env.DB.batch(extra);
    await audit(env, ch.server_id, me.id, 'channel_edit', typeof b.name === 'string' ? b.name.trim() : ch.name, now);
    return json({ ok: true });
  }
  if ((mt = p.match(/^\/servers\/(\d+)\/kick\/(\d+)$/)) && m === 'POST') {
    const sid = Number(mt[1]), uid = Number(mt[2]);
    const s = await env.DB.prepare('SELECT owner_id FROM servers WHERE id=?').bind(sid).first();
    if (!s || uid === me.id || uid === s.owner_id || !((await permsOf(env, me.id, sid)) & P.KICK)) return err('нельзя', 403);
    if (s.owner_id !== me.id && ((await permsOf(env, uid, sid)) & (P.KICK | P.ROLES | P.SERVER))) return err('нельзя исключить модератора', 403);
    const who = await env.DB.prepare('SELECT username FROM users WHERE id=?').bind(uid).first();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM members WHERE server_id=? AND user_id=?').bind(sid, uid),
      env.DB.prepare('DELETE FROM member_roles WHERE server_id=? AND user_id=?').bind(sid, uid),
    ]);
    await audit(env, sid, me.id, 'kick', who?.username, now);
    return json({ ok: true });
  }

  // --- роли
  if ((mt = p.match(/^\/servers\/(\d+)\/roles$/)) && m === 'POST') {
    const sid = Number(mt[1]);
    const mine = await permsOf(env, me.id, sid);
    if (!(mine & P.ROLES)) return err('недостаточно прав', 403);
    const b = await req.json();
    const name = String(b.name || '').trim().slice(0, 30);
    if (!name) return err('введи название роли');
    const perms = (Number(b.perms) || 0) & ALL_PERMS;
    if (perms & ~mine) return err('нельзя выдать права, которых нет у тебя', 403);
    const color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : null;
    const cnt = await env.DB.prepare('SELECT COUNT(*) n FROM roles WHERE server_id=?').bind(sid).first();
    if (cnt.n >= 25) return err('максимум 25 ролей');
    const r = await env.DB.prepare('INSERT INTO roles (server_id, name, color, perms, position) VALUES (?,?,?,?,?)').bind(sid, name, color, perms, cnt.n).run();
    await audit(env, sid, me.id, 'role_create', name, now);
    return json({ id: r.meta.last_row_id });
  }
  if ((mt = p.match(/^\/roles\/(\d+)$/)) && (m === 'PATCH' || m === 'DELETE')) {
    const role = await env.DB.prepare('SELECT * FROM roles WHERE id=?').bind(Number(mt[1])).first();
    if (!role) return err('нет такой роли', 404);
    const mine = await permsOf(env, me.id, role.server_id);
    if (!(mine & P.ROLES)) return err('недостаточно прав', 403);
    if ((role.perms & ~mine)) return err('эта роль сильнее твоих прав', 403);
    if (m === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM member_roles WHERE role_id=?').bind(role.id),
        env.DB.prepare('DELETE FROM channel_roles WHERE role_id=?').bind(role.id),
        env.DB.prepare('DELETE FROM roles WHERE id=?').bind(role.id),
      ]);
      await audit(env, role.server_id, me.id, 'role_delete', role.name, now);
      return json({ ok: true });
    }
    const b = await req.json();
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 30) : role.name;
    if (!name) return err('введи название роли');
    const perms = b.perms === undefined ? role.perms : (Number(b.perms) || 0) & ALL_PERMS;
    if (perms & ~mine) return err('нельзя выдать права, которых нет у тебя', 403);
    const color = b.color === undefined ? role.color : (/^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : null);
    await env.DB.prepare('UPDATE roles SET name=?, color=?, perms=? WHERE id=?').bind(name, color, perms, role.id).run();
    await audit(env, role.server_id, me.id, 'role_edit', name, now);
    return json({ ok: true });
  }
  if ((mt = p.match(/^\/servers\/(\d+)\/members\/(\d+)\/roles$/)) && m === 'PUT') {
    const sid = Number(mt[1]), uid = Number(mt[2]);
    const mine = await permsOf(env, me.id, sid);
    if (!(mine & P.ROLES)) return err('недостаточно прав', 403);
    const mem = await env.DB.prepare('SELECT 1 x FROM members WHERE server_id=? AND user_id=?').bind(sid, uid).first();
    if (!mem) return err('участник не найден', 404);
    const ids = [...new Set(((await req.json()).roles || []).map(Number))].slice(0, 25);
    const { results } = await env.DB.prepare('SELECT id, perms FROM roles WHERE server_id=?').bind(sid).all();
    const valid = results.filter((r) => ids.includes(r.id));
    if (valid.some((r) => r.perms & ~mine)) return err('нельзя выдать роль сильнее твоих прав', 403);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM member_roles WHERE server_id=? AND user_id=?').bind(sid, uid),
      ...valid.map((r) => env.DB.prepare('INSERT INTO member_roles (server_id, user_id, role_id) VALUES (?,?,?)').bind(sid, uid, r.id)),
    ]);
    const who = await env.DB.prepare('SELECT username FROM users WHERE id=?').bind(uid).first();
    await audit(env, sid, me.id, 'roles_set', who?.username, now);
    return json({ ok: true });
  }

  // --- сообщения
  if ((mt = p.match(/^\/channels\/(\d+)\/messages$/))) {
    const cid = Number(mt[1]);
    const ch = await channelAccess(env, me.id, cid);
    if (!ch) return err('нет доступа', 403);
    if (m === 'GET') {
      const before = Number(url.searchParams.get('before')) || 9e15;
      const { results } = await env.DB.prepare(`${MSG_SELECT} WHERE m.channel_id=? AND m.id<? AND m.thread_id IS NULL ORDER BY m.id DESC LIMIT 50`)
        .bind(cid, before).all();
      return json({ messages: await enrichMessages(env, results.reverse()) });
    }
    if (m === 'POST') {
      const b = await req.json();
      const content = (b.content || '').slice(0, 4000);
      if (!content.trim() && !b.att_key) return err('пустое сообщение');
      if (ch.slowmode && ch.type !== 'dm') {
        if (!((await permsOf(env, me.id, ch.server_id)) & P.MESSAGES)) {
          const last = await env.DB.prepare('SELECT created_at FROM messages WHERE channel_id=? AND user_id=? ORDER BY id DESC LIMIT 1').bind(cid, me.id).first();
          const wait = last ? Math.ceil((last.created_at + ch.slowmode * 1000 - now) / 1000) : 0;
          if (wait > 0) return err(`медленный режим: подожди ещё ${wait} с`, 429);
        }
      }
      let threadId = null;
      if (b.thread_id) {
        const root = await env.DB.prepare('SELECT id FROM messages WHERE id=? AND channel_id=? AND thread_id IS NULL').bind(Number(b.thread_id), cid).first();
        if (!root) return err('ветка не найдена', 404);
        threadId = root.id;
      }
      let replyTo = null;
      if (b.reply_to) {
        const rm = await env.DB.prepare('SELECT id FROM messages WHERE id=? AND channel_id=?').bind(Number(b.reply_to), cid).first();
        replyTo = rm?.id || null;
      }
      const r = await env.DB.prepare(
        'INSERT INTO messages (channel_id, user_id, content, att_key, att_name, att_type, created_at, reply_to, thread_id) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(cid, me.id, content, b.att_key || null, b.att_name || null, b.att_type || null, now, replyTo, threadId).run();
      const msg = await env.DB.prepare(`${MSG_SELECT} WHERE m.id=?`).bind(r.meta.last_row_id).first();
      msg.reactions = [];
      for (const u of await mentionedUsers(env, content)) {
        if (u.id !== me.id && (await channelAccess(env, u.id, cid))) await notify(env, u.id, 'mention_msg', me.id, msg.id, cid);
      }
      await broadcast(env, `text:${cid}`, { type: 'message', message: msg });
      return json({ message: msg });
    }
  }
  if ((mt = p.match(/^\/messages\/(\d+)\/thread$/)) && m === 'GET') {
    const root = await env.DB.prepare(`${MSG_SELECT} WHERE m.id=?`).bind(Number(mt[1])).first();
    if (!root || !(await channelAccess(env, me.id, root.channel_id))) return err('нет доступа', 403);
    const { results } = await env.DB.prepare(`${MSG_SELECT} WHERE m.thread_id=? ORDER BY m.id LIMIT 200`).bind(root.id).all();
    return json({ root: (await enrichMessages(env, [root]))[0], messages: await enrichMessages(env, results) });
  }
  if ((mt = p.match(/^\/channels\/(\d+)\/threads$/)) && m === 'GET') {
    const cid = Number(mt[1]);
    if (!(await channelAccess(env, me.id, cid))) return err('нет доступа', 403);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 40);
    const { results } = await env.DB.prepare(
      `SELECT m.id, substr(m.content, 1, 90) AS title, u.username, m.created_at,
         (SELECT COUNT(*) FROM messages t WHERE t.thread_id = m.id) AS replies,
         (SELECT MAX(t.created_at) FROM messages t WHERE t.thread_id = m.id) AS last_at
       FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = ? AND m.thread_id IS NULL AND replies > 0 ${q ? 'AND m.content LIKE ?' : ''}
       ORDER BY last_at DESC LIMIT 50`
    ).bind(...(q ? [cid, `%${q.replace(/[%_]/g, '')}%`] : [cid])).all();
    return json({ threads: results });
  }
  if ((mt = p.match(/^\/messages\/(\d+)$/)) && m === 'DELETE') {
    const msg = await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(Number(mt[1])).first();
    if (!msg) return err('нет такого', 404);
    const ch = await channelAccess(env, me.id, msg.channel_id);
    const canMod = ch?.server_id ? !!((await permsOf(env, me.id, ch.server_id)) & P.MESSAGES) : false;
    if (!ch || (msg.user_id !== me.id && !canMod)) return err('нельзя', 403);
    if (msg.user_id !== me.id) {
      const au = await env.DB.prepare('SELECT username FROM users WHERE id=?').bind(msg.user_id).first();
      await audit(env, ch.server_id, me.id, 'msg_delete', `${au?.username || '?'} в #${ch.name}`, now);
    }
    await env.DB.batch([
      env.DB.prepare('DELETE FROM message_reactions WHERE message_id=? OR message_id IN (SELECT id FROM messages WHERE thread_id=?)').bind(msg.id, msg.id),
      env.DB.prepare("DELETE FROM notifications WHERE type='mention_msg' AND post_id=?").bind(msg.id),
      env.DB.prepare('DELETE FROM messages WHERE thread_id=?').bind(msg.id),
      env.DB.prepare('DELETE FROM messages WHERE id=?').bind(msg.id),
    ]);
    await broadcast(env, `text:${msg.channel_id}`, { type: 'delete', id: msg.id });
    return json({ ok: true });
  }

  // --- файлы
  if (p === '/upload' && m === 'POST') {
    if (!env.FILES) return err('загрузка файлов пока отключена', 501);
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_FILE) return err('файл больше 25 мб', 413);
    const name = decodeURIComponent(req.headers.get('x-filename') || 'file').slice(0, 120);
    const type = req.headers.get('content-type') || 'application/octet-stream';
    const key = `${rand(8)}/${name.replace(/[^\p{L}\p{N}._-]/gu, '_')}`;
    await env.FILES.put(key, req.body, { httpMetadata: { contentType: type } });
    return json({ att_key: key, att_name: name, att_type: type });
  }

  // --- друзья
  if (p === '/friends' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT f.status, f.user_a, f.user_b, ua.username AS name_a, ub.username AS name_b,
        ua.avatar_key AS av_a, ub.avatar_key AS av_b, ua.last_seen AS ls_a, ub.last_seen AS ls_b
       FROM friends f JOIN users ua ON ua.id=f.user_a JOIN users ub ON ub.id=f.user_b
       WHERE f.user_a=? OR f.user_b=?`
    ).bind(me.id, me.id).all();
    const out = results.map((r) => {
      const mine = r.user_a === me.id;
      return {
        id: mine ? r.user_b : r.user_a,
        username: mine ? r.name_b : r.name_a,
        avatar_key: mine ? r.av_b : r.av_a,
        online: isOnline(mine ? r.ls_b : r.ls_a),
        status: r.status === 'accepted' ? 'friend' : mine ? 'outgoing' : 'incoming',
      };
    });
    return json({ friends: out });
  }
  if (p === '/friends' && m === 'POST') {
    const { username } = await req.json();
    const u = await env.DB.prepare('SELECT id FROM users WHERE username=?').bind((username || '').trim()).first();
    if (!u) return err('пользователь не найден', 404);
    if (u.id === me.id) return err('это ты сам');
    const rev = await env.DB.prepare('SELECT status FROM friends WHERE user_a=? AND user_b=?').bind(u.id, me.id).first();
    if (rev) {
      await env.DB.prepare("UPDATE friends SET status='accepted' WHERE user_a=? AND user_b=?").bind(u.id, me.id).run();
    } else {
      await env.DB.prepare('INSERT OR IGNORE INTO friends (user_a, user_b, status, created_at) VALUES (?,?,?,?)')
        .bind(me.id, u.id, 'pending', now).run();
    }
    return json({ ok: true });
  }
  if ((mt = p.match(/^\/friends\/(\d+)\/accept$/)) && m === 'POST') {
    await env.DB.prepare("UPDATE friends SET status='accepted' WHERE user_a=? AND user_b=?").bind(Number(mt[1]), me.id).run();
    return json({ ok: true });
  }
  if ((mt = p.match(/^\/friends\/(\d+)$/)) && m === 'DELETE') {
    const o = Number(mt[1]);
    await env.DB.prepare('DELETE FROM friends WHERE (user_a=? AND user_b=?) OR (user_a=? AND user_b=?)').bind(me.id, o, o, me.id).run();
    return json({ ok: true });
  }

  // --- лс
  if (p === '/dms' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT c.id, u.id AS user_id, u.username, u.avatar_key, u.last_seen FROM dm_members me
       JOIN channels c ON c.id = me.channel_id
       JOIN dm_members o ON o.channel_id = c.id AND o.user_id != me.user_id
       JOIN users u ON u.id = o.user_id
       WHERE me.user_id = ? ORDER BY c.id DESC`
    ).bind(me.id).all();
    return json({ dms: results.map(({ last_seen, ...d }) => ({ ...d, online: isOnline(last_seen) })) });
  }
  if (p === '/dms' && m === 'POST') {
    const { userId } = await req.json();
    const other = await env.DB.prepare('SELECT id, username FROM users WHERE id=?').bind(Number(userId)).first();
    if (!other || other.id === me.id) return err('нельзя');
    const ex = await env.DB.prepare(
      'SELECT a.channel_id FROM dm_members a JOIN dm_members b ON a.channel_id=b.channel_id WHERE a.user_id=? AND b.user_id=?'
    ).bind(me.id, other.id).first();
    if (ex) return json({ id: ex.channel_id, username: other.username });
    const r = await env.DB.prepare('INSERT INTO channels (server_id, name, type, created_at) VALUES (NULL, ?, ?, ?)')
      .bind('dm', 'dm', now).run();
    const cid = r.meta.last_row_id;
    await env.DB.batch([
      env.DB.prepare('INSERT INTO dm_members (channel_id, user_id) VALUES (?,?)').bind(cid, me.id),
      env.DB.prepare('INSERT INTO dm_members (channel_id, user_id) VALUES (?,?)').bind(cid, other.id),
    ]);
    return json({ id: cid, username: other.username });
  }


  const social = await handleSocial({ req, env, url, me, p, m, now, json, err, broadcast, channelAccess, MSG_SELECT });
  if (social) return social;

  return err('не найдено', 404);
}

// durable object: одна комната = один текстовый или голосовой канал
export class Room {
  constructor(state, env) {
    this.state = state;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/broadcast') {
      const data = await req.text();
      for (const ws of this.state.getWebSockets()) {
        try { ws.send(data); } catch {}
      }
      return new Response('ok');
    }
    // ws
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const uid = Number(url.searchParams.get('uid'));
    const name = url.searchParams.get('name');
    const kind = url.searchParams.get('kind');
    const cid = crypto.randomUUID().slice(0, 8); // id соединения (для голоса)
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ uid, name, kind, cid });
    if (kind === 'voice') {
      const peers = this.state.getWebSockets()
        .filter((w) => w !== server)
        .map((w) => w.deserializeAttachment())
        .filter(Boolean)
        .map((a) => ({ cid: a.cid, uid: a.uid, name: a.name }));
      server.send(JSON.stringify({ type: 'welcome', cid, peers }));
      this.#send(server, { type: 'peer-join', cid, uid, name }, true);
    } else {
      this.#send(server, { type: 'online', count: this.state.getWebSockets().length }, true);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  #send(from, payload, toOthers) {
    const data = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      if (toOthers && ws === from) continue;
      try { ws.send(data); } catch {}
    }
  }

  webSocketMessage(ws, raw) {
    const me = ws.deserializeAttachment();
    if (!me) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (me.kind === 'voice') {
      // пересылка webrtc сигналов конкретному участнику
      if (msg.to && ['offer', 'answer', 'ice'].includes(msg.type)) {
        for (const w of this.state.getWebSockets()) {
          if (w.deserializeAttachment()?.cid === msg.to) {
            w.send(JSON.stringify({ ...msg, from: me.cid, name: me.name }));
          }
        }
      }
    } else if (msg.type === 'typing') {
      this.#send(ws, { type: 'typing', uid: me.uid, name: me.name }, true);
    }
  }

  webSocketClose(ws) {
    const me = ws.deserializeAttachment();
    if (me?.kind === 'voice') this.#send(ws, { type: 'peer-leave', cid: me.cid }, true);
    try { ws.close(); } catch {}
  }

  webSocketError(ws) {
    this.webSocketClose(ws);
  }
}
