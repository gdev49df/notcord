// notcord — worker: api + websocket (durable objects) + файлы (r2)

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
    'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
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
  return m ? ch : null;
}

const MSG_SELECT = `SELECT m.id, m.channel_id, m.user_id, u.username, m.content,
  m.att_key, m.att_name, m.att_type, m.created_at
  FROM messages m JOIN users u ON u.id = m.user_id`;

async function broadcast(env, room, payload) {
  const stub = env.ROOM.get(env.ROOM.idFromName(room));
  await stub.fetch('https://room/broadcast', { method: 'POST', body: JSON.stringify(payload) });
}


// ---- лента
const POST_SELECT = `SELECT p.id, p.user_id, u.username, p.parent_id, p.content, p.created_at,
  (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
  (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS replies,
  EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked
  FROM posts p JOIN users u ON u.id = p.user_id`;

async function getPost(env, id, me) {
  const r = await env.DB.prepare(`${POST_SELECT} WHERE p.id = ?`).bind(me, id).first();
  return r ? { ...r, liked: !!r.liked } : null;
}
const fixPosts = (rows) => rows.map((r) => ({ ...r, liked: !!r.liked }));

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
    return json({ token: await newSession(env, u.id), user: { id: u.id, username: u.username } });
  }

  const me = await authUser(req, env);
  if (!me) return err('не авторизован', 401);

  if (p === '/me') return json({ user: me });
  if (p === '/logout' && m === 'POST') {
    const t = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(t).run();
    return json({ ok: true });
  }

  // --- серверы
  if (p === '/servers' && m === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT s.id, s.name, s.owner_id, s.invite FROM servers s JOIN members mm ON mm.server_id = s.id WHERE mm.user_id = ? ORDER BY mm.joined_at'
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
    const s = await env.DB.prepare('SELECT id, name, owner_id, invite FROM servers WHERE id=?').bind(sid).first();
    if (m === 'GET') {
      const [chs, mems] = await Promise.all([
        env.DB.prepare('SELECT id, name, type FROM channels WHERE server_id=? ORDER BY id').bind(sid).all(),
        env.DB.prepare('SELECT u.id, u.username FROM members mm JOIN users u ON u.id=mm.user_id WHERE mm.server_id=? ORDER BY u.username').bind(sid).all(),
      ]);
      return json({ server: s, channels: chs.results, members: mems.results });
    }
    if (m === 'DELETE') {
      if (s.owner_id === me.id) {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id=?)').bind(sid),
          env.DB.prepare('DELETE FROM channels WHERE server_id=?').bind(sid),
          env.DB.prepare('DELETE FROM members WHERE server_id=?').bind(sid),
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
    const s = await env.DB.prepare('SELECT owner_id FROM servers WHERE id=?').bind(sid).first();
    if (!s || s.owner_id !== me.id) return err('только владелец сервера', 403);
    const { name, type } = await req.json();
    const n = (name || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30);
    if (!n) return err('введи название');
    const t = type === 'voice' ? 'voice' : 'text';
    const r = await env.DB.prepare('INSERT INTO channels (server_id, name, type, created_at) VALUES (?,?,?,?)')
      .bind(sid, n, t, now).run();
    return json({ id: r.meta.last_row_id });
  }
  if ((mt = p.match(/^\/servers\/(\d+)\/kick\/(\d+)$/)) && m === 'POST') {
    const sid = Number(mt[1]), uid = Number(mt[2]);
    const s = await env.DB.prepare('SELECT owner_id FROM servers WHERE id=?').bind(sid).first();
    if (!s || s.owner_id !== me.id || uid === me.id) return err('нельзя', 403);
    await env.DB.prepare('DELETE FROM members WHERE server_id=? AND user_id=?').bind(sid, uid).run();
    return json({ ok: true });
  }

  // --- сообщения
  if ((mt = p.match(/^\/channels\/(\d+)\/messages$/))) {
    const cid = Number(mt[1]);
    const ch = await channelAccess(env, me.id, cid);
    if (!ch) return err('нет доступа', 403);
    if (m === 'GET') {
      const before = Number(url.searchParams.get('before')) || 9e15;
      const { results } = await env.DB.prepare(`${MSG_SELECT} WHERE m.channel_id=? AND m.id<? ORDER BY m.id DESC LIMIT 50`)
        .bind(cid, before).all();
      return json({ messages: results.reverse() });
    }
    if (m === 'POST') {
      const b = await req.json();
      const content = (b.content || '').slice(0, 4000);
      if (!content.trim() && !b.att_key) return err('пустое сообщение');
      const r = await env.DB.prepare(
        'INSERT INTO messages (channel_id, user_id, content, att_key, att_name, att_type, created_at) VALUES (?,?,?,?,?,?,?)'
      ).bind(cid, me.id, content, b.att_key || null, b.att_name || null, b.att_type || null, now).run();
      const msg = await env.DB.prepare(`${MSG_SELECT} WHERE m.id=?`).bind(r.meta.last_row_id).first();
      await broadcast(env, `text:${cid}`, { type: 'message', message: msg });
      return json({ message: msg });
    }
  }
  if ((mt = p.match(/^\/messages\/(\d+)$/)) && m === 'DELETE') {
    const msg = await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(Number(mt[1])).first();
    if (!msg) return err('нет такого', 404);
    const ch = await channelAccess(env, me.id, msg.channel_id);
    const srv = ch?.server_id ? await env.DB.prepare('SELECT owner_id FROM servers WHERE id=?').bind(ch.server_id).first() : null;
    if (!ch || (msg.user_id !== me.id && srv?.owner_id !== me.id)) return err('нельзя', 403);
    await env.DB.prepare('DELETE FROM messages WHERE id=?').bind(msg.id).run();
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
      `SELECT f.status, f.user_a, f.user_b, ua.username AS name_a, ub.username AS name_b
       FROM friends f JOIN users ua ON ua.id=f.user_a JOIN users ub ON ub.id=f.user_b
       WHERE f.user_a=? OR f.user_b=?`
    ).bind(me.id, me.id).all();
    const out = results.map((r) => {
      const mine = r.user_a === me.id;
      return {
        id: mine ? r.user_b : r.user_a,
        username: mine ? r.name_b : r.name_a,
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
      `SELECT c.id, u.id AS user_id, u.username FROM dm_members me
       JOIN channels c ON c.id = me.channel_id
       JOIN dm_members o ON o.channel_id = c.id AND o.user_id != me.user_id
       JOIN users u ON u.id = o.user_id
       WHERE me.user_id = ? ORDER BY c.id DESC`
    ).bind(me.id).all();
    return json({ dms: results });
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


  // --- лента
  if (p === '/feed' && m === 'GET') {
    const before = Number(url.searchParams.get('before')) || 9e15;
    const following = url.searchParams.get('tab') === 'following';
    const where = following
      ? 'p.parent_id IS NULL AND p.id < ? AND (p.user_id = ? OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))'
      : 'p.parent_id IS NULL AND p.id < ?';
    const binds = following ? [me.id, before, me.id, me.id] : [me.id, before];
    const { results } = await env.DB.prepare(`${POST_SELECT} WHERE ${where} ORDER BY p.id DESC LIMIT 30`).bind(...binds).all();
    return json({ posts: fixPosts(results) });
  }
  if (p === '/posts' && m === 'POST') {
    const b = await req.json();
    const content = (b.content || '').trim().slice(0, 1000);
    if (!content) return err('пустой пост');
    let parent = null;
    if (b.parent_id) {
      const pp = await env.DB.prepare('SELECT id, parent_id FROM posts WHERE id=?').bind(Number(b.parent_id)).first();
      if (!pp) return err('пост не найден', 404);
      parent = pp.parent_id || pp.id; // ответы всегда в корневой пост
    }
    const r = await env.DB.prepare('INSERT INTO posts (user_id, parent_id, content, created_at) VALUES (?,?,?,?)')
      .bind(me.id, parent, content, now).run();
    return json({ post: await getPost(env, r.meta.last_row_id, me.id) });
  }
  if ((mt = p.match(/^\/posts\/(\d+)$/))) {
    const id = Number(mt[1]);
    if (m === 'GET') {
      const post = await getPost(env, id, me.id);
      if (!post) return err('пост не найден', 404);
      const { results } = await env.DB.prepare(`${POST_SELECT} WHERE p.parent_id = ? ORDER BY p.id ASC LIMIT 200`).bind(me.id, id).all();
      return json({ post, replies: fixPosts(results) });
    }
    if (m === 'DELETE') {
      const post = await env.DB.prepare('SELECT user_id FROM posts WHERE id=?').bind(id).first();
      if (!post || post.user_id !== me.id) return err('нельзя', 403);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM post_likes WHERE post_id=? OR post_id IN (SELECT id FROM posts WHERE parent_id=?)').bind(id, id),
        env.DB.prepare('DELETE FROM posts WHERE parent_id=?').bind(id),
        env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id),
      ]);
      return json({ ok: true });
    }
  }
  if ((mt = p.match(/^\/posts\/(\d+)\/like$/)) && m === 'POST') {
    const id = Number(mt[1]);
    if (!(await env.DB.prepare('SELECT 1 x FROM posts WHERE id=?').bind(id).first())) return err('пост не найден', 404);
    const had = await env.DB.prepare('SELECT 1 x FROM post_likes WHERE post_id=? AND user_id=?').bind(id, me.id).first();
    if (had) await env.DB.prepare('DELETE FROM post_likes WHERE post_id=? AND user_id=?').bind(id, me.id).run();
    else await env.DB.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?,?)').bind(id, me.id).run();
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM post_likes WHERE post_id=?').bind(id).first();
    return json({ liked: !had, likes: c.n });
  }
  if ((mt = p.match(/^\/users\/([^/]+)$/)) && m === 'GET') {
    const u = await env.DB.prepare('SELECT id, username, created_at FROM users WHERE username = ?').bind(decodeURIComponent(mt[1])).first();
    if (!u) return err('пользователь не найден', 404);
    const [fr, fg, isf, posts] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) n FROM follows WHERE followee_id=?').bind(u.id).first(),
      env.DB.prepare('SELECT COUNT(*) n FROM follows WHERE follower_id=?').bind(u.id).first(),
      env.DB.prepare('SELECT 1 x FROM follows WHERE follower_id=? AND followee_id=?').bind(me.id, u.id).first(),
      env.DB.prepare(`${POST_SELECT} WHERE p.user_id = ? AND p.parent_id IS NULL ORDER BY p.id DESC LIMIT 30`).bind(me.id, u.id).all(),
    ]);
    return json({ user: u, followers: fr.n, following: fg.n, is_following: !!isf, is_me: u.id === me.id, posts: fixPosts(posts.results) });
  }
  if ((mt = p.match(/^\/users\/(\d+)\/follow$/)) && m === 'POST') {
    const id = Number(mt[1]);
    if (id === me.id) return err('нельзя подписаться на себя');
    if (!(await env.DB.prepare('SELECT 1 x FROM users WHERE id=?').bind(id).first())) return err('пользователь не найден', 404);
    const had = await env.DB.prepare('SELECT 1 x FROM follows WHERE follower_id=? AND followee_id=?').bind(me.id, id).first();
    if (had) await env.DB.prepare('DELETE FROM follows WHERE follower_id=? AND followee_id=?').bind(me.id, id).run();
    else await env.DB.prepare('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)').bind(me.id, id, now).run();
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM follows WHERE followee_id=?').bind(id).first();
    return json({ following: !had, followers: c.n });
  }

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
