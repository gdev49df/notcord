// earth's network — социальная часть: лента, профили, уведомления, истории, реакции, жалобы, telegram

const enc = new TextEncoder();
const DAY = 86400000;
const ONLINE_MS = 90000;
const ph = (a) => a.map(() => '?').join(',');
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const TAG_RE = /#([\p{L}\p{N}_]{2,32})/gu;
const MENTION_RE = /@([\p{L}\p{N}_.-]{2,24})/gu;

export const isAdmin = (env, me) =>
  me.id === 1 || (env.ADMIN_USERS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).includes(me.username.toLowerCase());

export const isOnline = (t) => (t || 0) > Date.now() - ONLINE_MS;

// ---- уведомления
export async function notify(env, userId, type, actorId, postId = null, channelId = null) {
  if (!userId || userId === actorId) return;
  if (type === 'like' || type === 'follow') {
    const had = await env.DB.prepare(
      'SELECT 1 x FROM notifications WHERE user_id=? AND type=? AND actor_id=? AND COALESCE(post_id,0)=COALESCE(?,0)'
    ).bind(userId, type, actorId, postId).first();
    if (had) return;
  }
  await env.DB.prepare(
    'INSERT INTO notifications (user_id, type, actor_id, post_id, channel_id, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(userId, type, actorId, postId, channelId, Date.now()).run();
}

// @упоминания: возвращает id найденных пользователей
export async function mentionedUsers(env, text) {
  const names = [...new Set([...(text || '').matchAll(MENTION_RE)].map((x) => x[1].toLowerCase()))].slice(0, 10);
  if (!names.length) return [];
  const { results } = await env.DB.prepare(`SELECT id, username FROM users WHERE lower(username) IN (${ph(names)})`).bind(...names).all();
  return results;
}

// ---- сообщения чата: реакции
export async function enrichMessages(env, msgs) {
  const list = Array.isArray(msgs) ? msgs : [msgs];
  if (!list.length) return msgs;
  const ids = list.map((x) => x.id);
  const { results } = await env.DB.prepare(
    `SELECT message_id, emoji, user_id FROM message_reactions WHERE message_id IN (${ph(ids)}) ORDER BY rowid`
  ).bind(...ids).all();
  const by = {};
  for (const r of results) {
    const g = (by[r.message_id] ||= {});
    (g[r.emoji] ||= []).push(r.user_id);
  }
  for (const x of list) {
    x.reactions = Object.entries(by[x.id] || {}).map(([emoji, users]) => ({ emoji, users }));
  }
  return msgs;
}
async function reactionsOf(env, id) {
  const m = await enrichMessages(env, [{ id }]);
  return m[0].reactions;
}

// ---- посты
const POST_SELECT = `SELECT p.id, p.user_id, u.username, u.avatar_key, p.parent_id, p.content, p.created_at,
  p.att_key, p.att_name, p.att_type, p.quote_id, p.server_id, sv.name AS server_name,
  (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
  (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS replies,
  (SELECT COUNT(*) FROM posts q WHERE q.quote_id = p.id) AS reposts,
  EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked,
  EXISTS(SELECT 1 FROM posts q WHERE q.quote_id = p.id AND q.user_id = ? AND q.content = '') AS reposted,
  EXISTS(SELECT 1 FROM poll_options o WHERE o.post_id = p.id) AS has_poll,
  (u.pinned_post_id = p.id) AS pinned
  FROM posts p JOIN users u ON u.id = p.user_id LEFT JOIN servers sv ON sv.id = p.server_id`;

async function hydrate(env, rows, meId) {
  if (!rows.length) return rows;
  const qids = [...new Set(rows.map((r) => r.quote_id).filter(Boolean))];
  const pollIds = rows.filter((r) => r.has_poll).map((r) => r.id);
  let quotes = {}, opts = {}, mine = {};
  if (qids.length) {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.content, p.att_key, p.att_type, p.created_at, u.username, u.avatar_key
       FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id IN (${ph(qids)})`
    ).bind(...qids).all();
    for (const q of results) quotes[q.id] = q;
  }
  if (pollIds.length) {
    const [o, v] = await Promise.all([
      env.DB.prepare(
        `SELECT o.id, o.post_id, o.text, (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes
         FROM poll_options o WHERE o.post_id IN (${ph(pollIds)}) ORDER BY o.id`
      ).bind(...pollIds).all(),
      env.DB.prepare(`SELECT post_id, option_id FROM poll_votes WHERE user_id=? AND post_id IN (${ph(pollIds)})`).bind(meId, ...pollIds).all(),
    ]);
    for (const x of o.results) (opts[x.post_id] ||= []).push({ id: x.id, text: x.text, votes: x.votes });
    for (const x of v.results) mine[x.post_id] = x.option_id;
  }
  return rows.map((r) => {
    const out = { ...r, liked: !!r.liked, reposted: !!r.reposted, pinned: !!r.pinned };
    delete out.has_poll;
    if (r.quote_id) out.quote = quotes[r.quote_id] || { deleted: true };
    if (opts[r.id]) {
      const options = opts[r.id];
      out.poll = { options, total: options.reduce((s, o) => s + o.votes, 0), my_vote: mine[r.id] || null };
    }
    return out;
  });
}

// запрос постов с видимостью серверных постов
async function queryPosts(env, me, where, binds, tail = 'ORDER BY p.id DESC LIMIT 30') {
  const vis = '(p.server_id IS NULL OR sv.is_public = 1 OR p.server_id IN (SELECT server_id FROM members WHERE user_id = ?))';
  const { results } = await env.DB.prepare(`${POST_SELECT} WHERE ${vis} AND ${where} ${tail}`)
    .bind(me.id, me.id, me.id, ...binds).all();
  return hydrate(env, results, me.id);
}
async function getPost(env, me, id) {
  const r = await queryPosts(env, me, 'p.id = ?', [id], '');
  return r[0] || null;
}

async function indexPost(env, postId, text, me, now, noteType = 'mention', skip = []) {
  const tags = [...new Set([...text.matchAll(TAG_RE)].map((x) => x[1].toLowerCase()))].slice(0, 10);
  if (tags.length) {
    await env.DB.batch(tags.map((t) => env.DB.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag, created_at) VALUES (?,?,?)').bind(postId, t, now)));
  }
  for (const u of await mentionedUsers(env, text)) {
    if (!skip.includes(u.id)) await notify(env, u.id, noteType, me.id, postId);
  }
}

async function deletePostsData(env, ids) {
  if (!ids.length) return;
  const q = ph(ids);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM post_likes WHERE post_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM post_tags WHERE post_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM poll_votes WHERE post_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM poll_options WHERE post_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM notifications WHERE post_id IN (${q}) AND type NOT IN ('mention_msg')`).bind(...ids),
    env.DB.prepare(`UPDATE users SET pinned_post_id = NULL WHERE pinned_post_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM posts WHERE id IN (${q})`).bind(...ids),
  ]);
}
async function deletePostTree(env, id) {
  const { results } = await env.DB.prepare('SELECT id FROM posts WHERE parent_id = ?').bind(id).all();
  const ids = [id, ...results.map((r) => r.id)];
  // репосты/цитаты остаются, но теряют оригинал (quote.deleted)
  await deletePostsData(env, ids);
}

// ---- telegram
async function tgVerify(data, token) {
  const { hash, ...rest } = data;
  const check = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join('\n');
  const secret = await crypto.subtle.digest('SHA-256', enc.encode(token));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(check))) === hash;
}

// ---- публичные роуты (без авторизации)
export async function handlePublic(c) {
  const { req, env, p, m, json, err, now, rand, hashPass, newSession } = c;
  if (p === '/config' && m === 'GET') {
    return json({ files: !!env.FILES, telegram_bot: env.TG_BOT_TOKEN && env.TG_BOT_USERNAME ? env.TG_BOT_USERNAME : null });
  }
  if (p === '/auth/telegram' && m === 'POST') {
    if (!env.TG_BOT_TOKEN) return err('вход через telegram не настроен', 501);
    const d = await req.json();
    if (!d?.hash || !(await tgVerify(d, env.TG_BOT_TOKEN))) return err('подпись telegram не прошла', 401);
    if (now / 1000 - Number(d.auth_date) > 86400) return err('данные telegram устарели', 401);
    const tg = String(d.id);
    let u = await env.DB.prepare('SELECT id, username, banned_at FROM users WHERE tg_id = ?').bind(tg).first();
    if (!u) {
      const base = String(d.username || d.first_name || 'tg' + tg).replace(/[^\p{L}\p{N}_.-]/gu, '').slice(0, 20) || 'tg' + tg.slice(-6);
      let name = base;
      for (let i = 0; i < 6; i++) {
        const taken = await env.DB.prepare('SELECT 1 x FROM users WHERE username = ?').bind(name).first();
        if (!taken) break;
        name = base.slice(0, 18) + Math.floor(Math.random() * 900 + 100);
      }
      const salt = rand(16);
      const hash = await hashPass(rand(16), salt);
      const r = await env.DB.prepare('INSERT INTO users (username, pass_hash, pass_salt, created_at, tg_id) VALUES (?,?,?,?,?)')
        .bind(name, hash, salt, now, tg).run();
      u = { id: r.meta.last_row_id, username: name };
    }
    if (u.banned_at) return err('аккаунт заблокирован', 403);
    return json({ token: await newSession(env, u.id), user: { id: u.id, username: u.username } });
  }
  return null;
}

// ---- роуты с авторизацией. возвращает Response или null
export async function handleSocial(c) {
  const { req, env, url, me, p, m, now, json, err, broadcast, channelAccess } = c;
  let mt;
  const body = async () => { try { return await req.json(); } catch { return {}; } };
  const admin = isAdmin(env, me);

  // --- профиль
  if (p === '/profile' && m === 'PATCH') {
    const b = await body();
    const sets = [], binds = [];
    if (typeof b.bio === 'string') { sets.push('bio = ?'); binds.push(b.bio.trim().slice(0, 200) || null); }
    if (typeof b.avatar_key === 'string') { sets.push('avatar_key = ?'); binds.push(b.avatar_key || null); }
    if (!sets.length) return err('нечего менять');
    await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, me.id).run();
    return json({ ok: true });
  }

  // --- лента
  if (p === '/feed' && m === 'GET') {
    const q = url.searchParams;
    const before = Number(q.get('before')) || 9e15;
    const tab = q.get('tab') || 'all';
    let where = 'p.parent_id IS NULL AND p.id < ?';
    const binds = [before];
    if (tab === 'following') {
      where += ' AND (p.user_id = ? OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))';
      binds.push(me.id, me.id);
    } else if (tab === 'clips') {
      where += " AND p.att_type LIKE 'video/%'";
    } else if (tab === 'server') {
      where += ' AND p.server_id = ?';
      binds.push(Number(q.get('server_id')) || 0);
    }
    const tag = (q.get('tag') || '').replace(/^#/, '').toLowerCase();
    if (tag) { where += ' AND p.id IN (SELECT post_id FROM post_tags WHERE tag = ?)'; binds.push(tag); }
    return json({ posts: await queryPosts(env, me, where, binds) });
  }
  if (p === '/posts' && m === 'POST') {
    const b = await body();
    const content = (b.content || '').trim().slice(0, 1000);
    const pollOpts = Array.isArray(b.poll) ? b.poll.map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 4) : [];
    if (pollOpts.length === 1) return err('в опросе нужно минимум 2 варианта');
    if (!content && !b.att_key && !b.quote_id) return err('пустой пост');
    if (b.att_key && !env.FILES) return err('файлы пока отключены', 501);
    let parent = null, quote = null, serverId = null;
    if (b.parent_id) {
      const pp = await env.DB.prepare('SELECT id, parent_id, user_id FROM posts WHERE id=?').bind(Number(b.parent_id)).first();
      if (!pp) return err('пост не найден', 404);
      parent = pp.parent_id || pp.id; // ответы всегда в корневой пост
      b._replyTo = pp.user_id;
    }
    if (b.quote_id) {
      quote = await env.DB.prepare('SELECT id, user_id FROM posts WHERE id=?').bind(Number(b.quote_id)).first();
      if (!quote) return err('пост не найден', 404);
      if (!content) {
        const dup = await env.DB.prepare("SELECT 1 x FROM posts WHERE quote_id=? AND user_id=? AND content=''").bind(quote.id, me.id).first();
        if (dup) return err('ты уже репостнул это');
      }
    }
    if (b.server_id) {
      const s = await env.DB.prepare('SELECT owner_id FROM servers WHERE id=?').bind(Number(b.server_id)).first();
      if (!s || s.owner_id !== me.id) return err('постить от имени сервера может только владелец', 403);
      serverId = Number(b.server_id);
    }
    const r = await env.DB.prepare(
      'INSERT INTO posts (user_id, parent_id, content, created_at, att_key, att_name, att_type, quote_id, server_id) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(me.id, parent, content, now, b.att_key || null, b.att_name || null, b.att_type || null, quote?.id || null, serverId).run();
    const id = r.meta.last_row_id;
    if (pollOpts.length >= 2) {
      await env.DB.batch(pollOpts.map((t) => env.DB.prepare('INSERT INTO poll_options (post_id, text) VALUES (?,?)').bind(id, t)));
    }
    const skip = [];
    if (b._replyTo) { await notify(env, b._replyTo, 'reply', me.id, id); skip.push(b._replyTo); }
    if (quote) { await notify(env, quote.user_id, content ? 'quote' : 'repost', me.id, id); skip.push(quote.user_id); }
    if (content) await indexPost(env, id, content, me, now, 'mention', skip);
    return json({ post: await getPost(env, me, id) });
  }
  if ((mt = p.match(/^\/posts\/(\d+)$/))) {
    const id = Number(mt[1]);
    if (m === 'GET') {
      const post = await getPost(env, me, id);
      if (!post) return err('пост не найден', 404);
      const replies = await queryPosts(env, me, 'p.parent_id = ?', [id], 'ORDER BY p.id ASC LIMIT 200');
      return json({ post, replies });
    }
    if (m === 'DELETE') {
      const post = await env.DB.prepare('SELECT user_id FROM posts WHERE id=?').bind(id).first();
      if (!post) return err('пост не найден', 404);
      if (post.user_id !== me.id && !admin) return err('нельзя', 403);
      await deletePostTree(env, id);
      return json({ ok: true });
    }
  }
  if ((mt = p.match(/^\/posts\/(\d+)\/like$/)) && m === 'POST') {
    const id = Number(mt[1]);
    const post = await env.DB.prepare('SELECT user_id FROM posts WHERE id=?').bind(id).first();
    if (!post) return err('пост не найден', 404);
    const had = await env.DB.prepare('SELECT 1 x FROM post_likes WHERE post_id=? AND user_id=?').bind(id, me.id).first();
    if (had) await env.DB.prepare('DELETE FROM post_likes WHERE post_id=? AND user_id=?').bind(id, me.id).run();
    else {
      await env.DB.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?,?)').bind(id, me.id).run();
      await notify(env, post.user_id, 'like', me.id, id);
    }
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM post_likes WHERE post_id=?').bind(id).first();
    return json({ liked: !had, likes: n.n });
  }
  if ((mt = p.match(/^\/posts\/(\d+)\/repost$/)) && m === 'POST') {
    const id = Number(mt[1]);
    const post = await env.DB.prepare('SELECT user_id FROM posts WHERE id=?').bind(id).first();
    if (!post) return err('пост не найден', 404);
    const mine = await env.DB.prepare("SELECT id FROM posts WHERE quote_id=? AND user_id=? AND content=''").bind(id, me.id).first();
    if (mine) await deletePostsData(env, [mine.id]);
    else {
      const r = await env.DB.prepare("INSERT INTO posts (user_id, content, created_at, quote_id) VALUES (?, '', ?, ?)").bind(me.id, now, id).run();
      await notify(env, post.user_id, 'repost', me.id, r.meta.last_row_id);
    }
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM posts WHERE quote_id=?').bind(id).first();
    return json({ reposted: !mine, reposts: n.n });
  }
  if ((mt = p.match(/^\/posts\/(\d+)\/vote$/)) && m === 'POST') {
    const id = Number(mt[1]);
    const { option_id } = await body();
    const opt = await env.DB.prepare('SELECT id FROM poll_options WHERE id=? AND post_id=?').bind(Number(option_id), id).first();
    if (!opt) return err('нет такого варианта', 404);
    await env.DB.prepare('INSERT OR REPLACE INTO poll_votes (post_id, user_id, option_id) VALUES (?,?,?)').bind(id, me.id, opt.id).run();
    const post = await getPost(env, me, id);
    return json({ poll: post.poll });
  }
  if ((mt = p.match(/^\/posts\/(\d+)\/pin$/)) && m === 'POST') {
    const id = Number(mt[1]);
    const post = await env.DB.prepare('SELECT user_id, parent_id FROM posts WHERE id=?').bind(id).first();
    if (!post || post.user_id !== me.id || post.parent_id) return err('закрепить можно только свой пост', 403);
    const cur = await env.DB.prepare('SELECT pinned_post_id FROM users WHERE id=?').bind(me.id).first();
    const pinned = cur?.pinned_post_id !== id;
    await env.DB.prepare('UPDATE users SET pinned_post_id = ? WHERE id = ?').bind(pinned ? id : null, me.id).run();
    return json({ pinned });
  }

  // --- люди
  if ((mt = p.match(/^\/users\/([^/]+)$/)) && m === 'GET') {
    const u = await env.DB.prepare(
      'SELECT id, username, created_at, bio, avatar_key, last_seen, pinned_post_id FROM users WHERE username = ? AND banned_at IS NULL'
    ).bind(decodeURIComponent(mt[1])).first();
    if (!u) return err('пользователь не найден', 404);
    const [fr, fg, isf, close] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) n FROM follows WHERE followee_id=?').bind(u.id).first(),
      env.DB.prepare('SELECT COUNT(*) n FROM follows WHERE follower_id=?').bind(u.id).first(),
      env.DB.prepare('SELECT 1 x FROM follows WHERE follower_id=? AND followee_id=?').bind(me.id, u.id).first(),
      env.DB.prepare('SELECT 1 x FROM close_friends WHERE user_id=? AND friend_id=?').bind(me.id, u.id).first(),
    ]);
    const pinned = u.pinned_post_id ? await getPost(env, me, u.pinned_post_id) : null;
    const posts = await queryPosts(env, me, 'p.user_id = ? AND p.parent_id IS NULL AND p.id != ?', [u.id, u.pinned_post_id || 0]);
    const { pinned_post_id, last_seen, ...user } = u;
    return json({
      user, followers: fr.n, following: fg.n, is_following: !!isf, is_me: u.id === me.id,
      is_close: !!close, online: isOnline(last_seen), pinned, posts,
    });
  }
  if ((mt = p.match(/^\/users\/(\d+)\/follow$/)) && m === 'POST') {
    const id = Number(mt[1]);
    if (id === me.id) return err('нельзя подписаться на себя');
    if (!(await env.DB.prepare('SELECT 1 x FROM users WHERE id=?').bind(id).first())) return err('пользователь не найден', 404);
    const had = await env.DB.prepare('SELECT 1 x FROM follows WHERE follower_id=? AND followee_id=?').bind(me.id, id).first();
    if (had) await env.DB.prepare('DELETE FROM follows WHERE follower_id=? AND followee_id=?').bind(me.id, id).run();
    else {
      await env.DB.prepare('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)').bind(me.id, id, now).run();
      await notify(env, id, 'follow', me.id);
    }
    const n = await env.DB.prepare('SELECT COUNT(*) n FROM follows WHERE followee_id=?').bind(id).first();
    return json({ following: !had, followers: n.n });
  }
  if (p === '/people' && m === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().replace(/[%_]/g, '');
    if (!q) return json({ users: [] });
    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.avatar_key, u.bio,
        EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = u.id) AS is_following
       FROM users u WHERE u.username LIKE ? AND u.banned_at IS NULL ORDER BY u.username LIMIT 20`
    ).bind(me.id, `%${q}%`).all();
    return json({ users: results.map((r) => ({ ...r, is_following: !!r.is_following })) });
  }
  if (p === '/suggestions' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.avatar_key, u.bio,
        (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers
       FROM users u
       WHERE u.id != ? AND u.banned_at IS NULL
         AND u.id NOT IN (SELECT followee_id FROM follows WHERE follower_id = ?)
       ORDER BY followers DESC, u.id DESC LIMIT 5`
    ).bind(me.id, me.id).all();
    return json({ users: results });
  }
  if (p === '/trending' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT tag, COUNT(*) AS n FROM post_tags WHERE created_at > ? GROUP BY tag ORDER BY n DESC, MAX(post_id) DESC LIMIT 8`
    ).bind(now - 7 * DAY).all();
    return json({ tags: results });
  }
  if (p === '/search' && m === 'GET') {
    let q = (url.searchParams.get('q') || '').trim().replace(/[%_]/g, '');
    if (!q) return json({ users: [], posts: [], servers: [], tag: null });
    if (q.startsWith('#')) {
      const tag = q.slice(1).toLowerCase();
      const posts = tag ? await queryPosts(env, me, 'p.parent_id IS NULL AND p.id IN (SELECT post_id FROM post_tags WHERE tag = ?)', [tag]) : [];
      return json({ users: [], posts, servers: [], tag });
    }
    const like = `%${q}%`;
    const [users, posts, servers] = await Promise.all([
      env.DB.prepare('SELECT id, username, avatar_key, bio FROM users WHERE username LIKE ? AND banned_at IS NULL ORDER BY username LIMIT 8').bind(like).all(),
      queryPosts(env, me, 'p.content LIKE ? AND p.parent_id IS NULL', [like], 'ORDER BY p.id DESC LIMIT 20'),
      env.DB.prepare(
        `SELECT s.id, s.name, s.description, (SELECT COUNT(*) FROM members mm WHERE mm.server_id = s.id) AS members
         FROM servers s WHERE s.is_public = 1 AND s.name LIKE ? LIMIT 8`
      ).bind(like).all(),
    ]);
    return json({ users: users.results, posts, servers: servers.results, tag: null });
  }

  // --- уведомления и синхронизация
  if (p === '/notifications' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT n.id, n.type, n.post_id, n.channel_id, n.created_at, n.is_read, u.username, u.avatar_key,
        CASE WHEN n.type = 'mention_msg'
          THEN (SELECT substr(content, 1, 90) FROM messages WHERE id = n.post_id)
          ELSE (SELECT substr(content, 1, 90) FROM posts WHERE id = n.post_id) END AS snippet,
        (SELECT s.id FROM channels c JOIN servers s ON s.id = c.server_id WHERE c.id = n.channel_id) AS server_id
       FROM notifications n JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 50`
    ).bind(me.id).all();
    return json({ notifications: results });
  }
  if (p === '/notifications/read' && m === 'POST') {
    await env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').bind(me.id).run();
    return json({ ok: true });
  }
  if (p === '/sync' && m === 'GET') {
    await env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now, me.id).run();
    if (url.searchParams.get('init')) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO channel_reads (user_id, channel_id, last_id)
         SELECT ?, c.id, COALESCE((SELECT MAX(id) FROM messages WHERE channel_id = c.id), 0)
         FROM channels c WHERE c.server_id IN (SELECT server_id FROM members WHERE user_id = ?)`
      ).bind(me.id, me.id).run();
    }
    const [notif, unread] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(type IN ('reply','mention','mention_msg','quote')),0) imp FROM notifications WHERE user_id = ? AND is_read = 0").bind(me.id).first(),
      env.DB.prepare(
        `SELECT c.id, c.server_id, COUNT(m.id) AS n FROM channels c
         LEFT JOIN channel_reads r ON r.channel_id = c.id AND r.user_id = ?
         JOIN messages m ON m.channel_id = c.id AND m.id > COALESCE(r.last_id, 0) AND m.user_id != ?
         WHERE c.server_id IN (SELECT server_id FROM members WHERE user_id = ?)
            OR c.id IN (SELECT channel_id FROM dm_members WHERE user_id = ?)
         GROUP BY c.id`
      ).bind(me.id, me.id, me.id, me.id).all(),
    ]);
    const map = {}, srv = {}, dms = {};
    for (const r of unread.results) {
      map[r.id] = r.n;
      if (r.server_id) srv[r.server_id] = (srv[r.server_id] || 0) + r.n;
      else dms[r.id] = r.n;
    }
    return json({ notifications: notif.n, important: notif.imp, unread: map, servers: srv, dms });
  }
  if ((mt = p.match(/^\/channels\/(\d+)\/read$/)) && m === 'POST') {
    const cid = Number(mt[1]);
    if (!(await channelAccess(env, me.id, cid))) return err('нет доступа', 403);
    const mx = await env.DB.prepare('SELECT COALESCE(MAX(id),0) n FROM messages WHERE channel_id=?').bind(cid).first();
    await env.DB.prepare('INSERT OR REPLACE INTO channel_reads (user_id, channel_id, last_id) VALUES (?,?,?)').bind(me.id, cid, mx.n).run();
    return json({ ok: true });
  }

  // --- чат: реакции, правка, закрепы
  if ((mt = p.match(/^\/messages\/(\d+)\/react$/)) && m === 'POST') {
    const msg = await env.DB.prepare('SELECT id, channel_id FROM messages WHERE id=?').bind(Number(mt[1])).first();
    if (!msg || !(await channelAccess(env, me.id, msg.channel_id))) return err('нет доступа', 403);
    const { emoji } = await body();
    const e = String(emoji || '').slice(0, 16);
    if (!e) return err('нет эмодзи');
    const had = await env.DB.prepare('SELECT 1 x FROM message_reactions WHERE message_id=? AND user_id=? AND emoji=?').bind(msg.id, me.id, e).first();
    if (had) await env.DB.prepare('DELETE FROM message_reactions WHERE message_id=? AND user_id=? AND emoji=?').bind(msg.id, me.id, e).run();
    else await env.DB.prepare('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?,?,?)').bind(msg.id, me.id, e).run();
    const reactions = await reactionsOf(env, msg.id);
    await broadcast(env, `text:${msg.channel_id}`, { type: 'reactions', id: msg.id, reactions });
    return json({ reactions });
  }
  if ((mt = p.match(/^\/messages\/(\d+)$/)) && m === 'PATCH') {
    const msg = await env.DB.prepare('SELECT * FROM messages WHERE id=?').bind(Number(mt[1])).first();
    if (!msg || msg.user_id !== me.id) return err('редактировать можно только свои', 403);
    const content = String((await body()).content || '').slice(0, 4000);
    if (!content.trim()) return err('пустое сообщение');
    await env.DB.prepare('UPDATE messages SET content=?, edited_at=? WHERE id=?').bind(content, now, msg.id).run();
    const full = await env.DB.prepare(`${c.MSG_SELECT} WHERE m.id=?`).bind(msg.id).first();
    await enrichMessages(env, full);
    await broadcast(env, `text:${msg.channel_id}`, { type: 'edit', message: full });
    return json({ message: full });
  }
  if ((mt = p.match(/^\/messages\/(\d+)\/pin$/)) && m === 'POST') {
    const msg = await env.DB.prepare('SELECT id, channel_id, pinned FROM messages WHERE id=?').bind(Number(mt[1])).first();
    const ch = msg && (await channelAccess(env, me.id, msg.channel_id));
    if (!ch) return err('нет доступа', 403);
    if (ch.server_id) {
      const s = await env.DB.prepare('SELECT owner_id FROM servers WHERE id=?').bind(ch.server_id).first();
      if (s.owner_id !== me.id) return err('закреплять может владелец сервера', 403);
    }
    const pinned = msg.pinned ? 0 : 1;
    await env.DB.prepare('UPDATE messages SET pinned=? WHERE id=?').bind(pinned, msg.id).run();
    await broadcast(env, `text:${msg.channel_id}`, { type: 'pin', id: msg.id, pinned: !!pinned });
    return json({ pinned: !!pinned });
  }
  if ((mt = p.match(/^\/channels\/(\d+)\/pins$/)) && m === 'GET') {
    const cid = Number(mt[1]);
    if (!(await channelAccess(env, me.id, cid))) return err('нет доступа', 403);
    const { results } = await env.DB.prepare(`${c.MSG_SELECT} WHERE m.channel_id=? AND m.pinned=1 ORDER BY m.id DESC LIMIT 50`).bind(cid).all();
    return json({ messages: await enrichMessages(env, results) });
  }

  // --- публичные серверы
  if (p === '/discover' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT s.id, s.name, s.description,
        (SELECT COUNT(*) FROM members mm WHERE mm.server_id = s.id) AS members,
        EXISTS(SELECT 1 FROM members mm WHERE mm.server_id = s.id AND mm.user_id = ?) AS joined
       FROM servers s WHERE s.is_public = 1 ORDER BY members DESC, s.id DESC LIMIT 50`
    ).bind(me.id).all();
    return json({ servers: results.map((r) => ({ ...r, joined: !!r.joined })) });
  }
  if ((mt = p.match(/^\/servers\/(\d+)\/public$/)) && m === 'POST') {
    const s = await env.DB.prepare('SELECT owner_id FROM servers WHERE id=?').bind(Number(mt[1])).first();
    if (!s || s.owner_id !== me.id) return err('только владелец сервера', 403);
    const b = await body();
    await env.DB.prepare('UPDATE servers SET is_public=?, description=? WHERE id=?')
      .bind(b.is_public ? 1 : 0, String(b.description || '').trim().slice(0, 200) || null, Number(mt[1])).run();
    return json({ ok: true });
  }
  if ((mt = p.match(/^\/servers\/(\d+)\/join-public$/)) && m === 'POST') {
    const sid = Number(mt[1]);
    const s = await env.DB.prepare('SELECT id FROM servers WHERE id=? AND is_public=1').bind(sid).first();
    if (!s) return err('сервер не найден или закрыт', 404);
    await env.DB.prepare('INSERT OR IGNORE INTO members (server_id, user_id, joined_at) VALUES (?,?,?)').bind(sid, me.id, now).run();
    return json({ id: sid });
  }

  // --- истории и близкие друзья
  if (p === '/stories' && m === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT s.id, s.user_id, u.username, u.avatar_key, s.content, s.att_key, s.att_type, s.visibility, s.created_at
       FROM stories s JOIN users u ON u.id = s.user_id
       WHERE s.created_at > ? AND u.banned_at IS NULL
         AND (s.user_id = ? OR s.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?))
         AND (s.user_id = ? OR s.visibility = 'all'
              OR (s.visibility = 'close' AND EXISTS(SELECT 1 FROM close_friends c WHERE c.user_id = s.user_id AND c.friend_id = ?)))
       ORDER BY s.id`
    ).bind(now - DAY, me.id, me.id, me.id, me.id).all();
    return json({ stories: results });
  }
  if (p === '/stories' && m === 'POST') {
    const b = await body();
    const content = String(b.content || '').trim().slice(0, 300);
    if (!content && !b.att_key) return err('пустая история');
    if (b.att_key && !env.FILES) return err('файлы пока отключены', 501);
    const vis = b.visibility === 'close' ? 'close' : 'all';
    const r = await env.DB.prepare(
      'INSERT INTO stories (user_id, content, att_key, att_type, visibility, created_at) VALUES (?,?,?,?,?,?)'
    ).bind(me.id, content, b.att_key || null, b.att_type || null, vis, now).run();
    return json({ id: r.meta.last_row_id });
  }
  if ((mt = p.match(/^\/stories\/(\d+)$/)) && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM stories WHERE id=? AND user_id=?').bind(Number(mt[1]), me.id).run();
    return json({ ok: true });
  }
  if (p === '/close-friends' && m === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT u.id, u.username, u.avatar_key FROM close_friends c JOIN users u ON u.id = c.friend_id WHERE c.user_id = ? ORDER BY u.username'
    ).bind(me.id).all();
    return json({ users: results });
  }
  if ((mt = p.match(/^\/close-friends\/(\d+)$/)) && m === 'POST') {
    const id = Number(mt[1]);
    if (id === me.id) return err('нельзя');
    const had = await env.DB.prepare('SELECT 1 x FROM close_friends WHERE user_id=? AND friend_id=?').bind(me.id, id).first();
    if (had) await env.DB.prepare('DELETE FROM close_friends WHERE user_id=? AND friend_id=?').bind(me.id, id).run();
    else await env.DB.prepare('INSERT INTO close_friends (user_id, friend_id) VALUES (?,?)').bind(me.id, id).run();
    return json({ is_close: !had });
  }

  // --- жалобы и модерация
  if (p === '/reports' && m === 'POST') {
    const b = await body();
    const type = ['post', 'message', 'user'].includes(b.target_type) ? b.target_type : null;
    const reason = String(b.reason || '').trim().slice(0, 300);
    if (!type || !b.target_id || !reason) return err('укажи, на что и почему жалоба');
    await env.DB.prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason, created_at) VALUES (?,?,?,?,?)')
      .bind(me.id, type, Number(b.target_id), reason, now).run();
    return json({ ok: true });
  }
  if (p.startsWith('/admin/')) {
    if (!admin) return err('нет доступа', 403);
    if (p === '/admin/reports' && m === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT r.id, r.target_type, r.target_id, r.reason, r.created_at, u.username AS reporter,
          CASE r.target_type
            WHEN 'post' THEN (SELECT substr(content,1,160) FROM posts WHERE id = r.target_id)
            WHEN 'message' THEN (SELECT substr(content,1,160) FROM messages WHERE id = r.target_id)
            ELSE (SELECT username FROM users WHERE id = r.target_id) END AS snippet
         FROM reports r JOIN users u ON u.id = r.reporter_id WHERE r.status = 'open' ORDER BY r.id DESC LIMIT 100`
      ).all();
      return json({ reports: results });
    }
    if ((mt = p.match(/^\/admin\/reports\/(\d+)$/)) && m === 'POST') {
      const rep = await env.DB.prepare('SELECT * FROM reports WHERE id=?').bind(Number(mt[1])).first();
      if (!rep) return err('нет такой жалобы', 404);
      const { action } = await body();
      let authorId = null;
      if (rep.target_type === 'post') {
        authorId = (await env.DB.prepare('SELECT user_id FROM posts WHERE id=?').bind(rep.target_id).first())?.user_id;
      } else if (rep.target_type === 'message') {
        authorId = (await env.DB.prepare('SELECT user_id FROM messages WHERE id=?').bind(rep.target_id).first())?.user_id;
      } else authorId = rep.target_id;
      if (action === 'delete' || action === 'ban') {
        if (rep.target_type === 'post') await deletePostTree(env, rep.target_id);
        if (rep.target_type === 'message') {
          const msg = await env.DB.prepare('SELECT channel_id FROM messages WHERE id=?').bind(rep.target_id).first();
          await env.DB.batch([
            env.DB.prepare('DELETE FROM message_reactions WHERE message_id=?').bind(rep.target_id),
            env.DB.prepare('DELETE FROM messages WHERE id=?').bind(rep.target_id),
          ]);
          if (msg) await broadcast(env, `text:${msg.channel_id}`, { type: 'delete', id: rep.target_id });
        }
      }
      if (action === 'ban' && authorId && authorId !== me.id) {
        await env.DB.batch([
          env.DB.prepare('UPDATE users SET banned_at=? WHERE id=?').bind(now, authorId),
          env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(authorId),
        ]);
      }
      await env.DB.prepare("UPDATE reports SET status='done' WHERE id=?").bind(rep.id).run();
      return json({ ok: true });
    }
  }

  return null;
}
