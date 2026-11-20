// права на сервере: у владельца всё, у остальных — объединение прав их ролей
export const P = { MESSAGES: 1, KICK: 2, CHANNELS: 4, ROLES: 8, SERVER: 16 };
export const ALL_PERMS = 31;

export async function permsOf(env, userId, serverId) {
  const s = await env.DB.prepare('SELECT owner_id FROM servers WHERE id=?').bind(serverId).first();
  if (!s) return 0;
  if (s.owner_id === userId) return ALL_PERMS;
  const mem = await env.DB.prepare('SELECT 1 x FROM members WHERE server_id=? AND user_id=?').bind(serverId, userId).first();
  if (!mem) return 0;
  const { results } = await env.DB.prepare(
    'SELECT r.perms FROM member_roles mr JOIN roles r ON r.id = mr.role_id WHERE mr.server_id=? AND mr.user_id=?'
  ).bind(serverId, userId).all();
  return results.reduce((a, r) => a | (r.perms || 0), 0) & ALL_PERMS;
}

export async function audit(env, serverId, actorId, action, target, now = Date.now()) {
  try {
    await env.DB.prepare('INSERT INTO audit_log (server_id, actor_id, action, target, created_at) VALUES (?,?,?,?,?)')
      .bind(serverId, actorId, action, target ? String(target).slice(0, 120) : null, now).run();
  } catch {}
}
