-- earth's network: полная схема для чистой базы
-- для уже развёрнутой базы используй migrations/0002_social.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  bio TEXT,
  avatar_key TEXT,
  last_seen INTEGER DEFAULT 0,
  banned_at INTEGER,
  tg_id TEXT,
  pinned_post_id INTEGER,
  banner TEXT,
  status TEXT,
  presence TEXT DEFAULT 'online',
  activity TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tg ON users(tg_id) WHERE tg_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  invite TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  is_public INTEGER DEFAULT 0,
  description TEXT,
  rules TEXT
);
CREATE TABLE IF NOT EXISTS members (
  server_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at INTEGER NOT NULL,
  accepted INTEGER DEFAULT 1,
  PRIMARY KEY (server_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
-- type: text | voice | dm ; server_id NULL для лс
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  topic TEXT,
  slowmode INTEGER DEFAULT 0,
  is_private INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_channels_server ON channels(server_id);
CREATE TABLE IF NOT EXISTS dm_members (
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_user ON dm_members(user_id);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  att_key TEXT,
  att_name TEXT,
  att_type TEXT,
  created_at INTEGER NOT NULL,
  reply_to INTEGER,
  edited_at INTEGER,
  pinned INTEGER DEFAULT 0,
  thread_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, id);
CREATE INDEX IF NOT EXISTS idx_msg_thread ON messages(thread_id, id);
-- status: pending (from -> to) | accepted
CREATE TABLE IF NOT EXISTS friends (
  user_a INTEGER NOT NULL,
  user_b INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_a, user_b)
);
CREATE INDEX IF NOT EXISTS idx_friends_b ON friends(user_b);

-- чат: реакции и прочитанное
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);
CREATE TABLE IF NOT EXISTS channel_reads (
  user_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  last_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, channel_id)
);

-- лента
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  parent_id INTEGER,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  att_key TEXT,
  att_name TEXT,
  att_type TEXT,
  quote_id INTEGER,
  server_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id, id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, id);
CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL,
  followee_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON post_tags(tag, post_id);
CREATE TABLE IF NOT EXISTS poll_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_poll_post ON poll_options(post_id);
CREATE TABLE IF NOT EXISTS poll_votes (
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- уведомления, истории, близкие друзья, жалобы
-- type: like | reply | follow | mention | repost | quote | mention_msg
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  post_id INTEGER,
  channel_id INTEGER,
  created_at INTEGER NOT NULL,
  is_read INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, id);
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  att_key TEXT,
  att_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'all',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stories_time ON stories(created_at);
CREATE TABLE IF NOT EXISTS close_friends (
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
-- target_type: post | message | user ; status: open | done
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER NOT NULL, name TEXT NOT NULL, color TEXT, perms INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_roles_server ON roles(server_id);
CREATE TABLE IF NOT EXISTS member_roles (server_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY (server_id, user_id, role_id));
CREATE INDEX IF NOT EXISTS idx_mr_role ON member_roles(role_id);
CREATE TABLE IF NOT EXISTS channel_roles (channel_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY (channel_id, role_id));
CREATE TABLE IF NOT EXISTS emojis (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER NOT NULL, name TEXT NOT NULL, att_key TEXT NOT NULL, UNIQUE (server_id, name));
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, server_id INTEGER NOT NULL, actor_id INTEGER NOT NULL, action TEXT NOT NULL, target TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_server ON audit_log(server_id, id);
CREATE TABLE IF NOT EXISTS calls (channel_id INTEGER PRIMARY KEY, caller_id INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS link_previews (url TEXT PRIMARY KEY, title TEXT, description TEXT, image TEXT, site TEXT, fetched_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS media (key TEXT PRIMARY KEY, owner_id INTEGER NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_media_owner ON media(owner_id);
-- 0006
ALTER TABLE users ADD COLUMN status_until INTEGER;
ALTER TABLE users ADD COLUMN activity_since INTEGER;
CREATE TABLE IF NOT EXISTS user_games (user_id INTEGER NOT NULL, name TEXT NOT NULL, first_at INTEGER NOT NULL, PRIMARY KEY (user_id, name));
