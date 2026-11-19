-- миграция для базы, где уже есть таблицы из первой версии (users, servers, messages, ...)
-- применить один раз: npm run db:migrate:remote
-- (повторный запуск упадёт на ALTER TABLE — это нормально, значит всё уже применено)

ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_key TEXT;
ALTER TABLE users ADD COLUMN last_seen INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN banned_at INTEGER;
ALTER TABLE users ADD COLUMN tg_id TEXT;
ALTER TABLE users ADD COLUMN pinned_post_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tg ON users(tg_id) WHERE tg_id IS NOT NULL;
ALTER TABLE servers ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE servers ADD COLUMN description TEXT;
ALTER TABLE messages ADD COLUMN reply_to INTEGER;
ALTER TABLE messages ADD COLUMN edited_at INTEGER;
ALTER TABLE messages ADD COLUMN pinned INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS message_reactions (message_id INTEGER NOT NULL, user_id INTEGER NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (message_id, user_id, emoji));
CREATE TABLE IF NOT EXISTS channel_reads (user_id INTEGER NOT NULL, channel_id INTEGER NOT NULL, last_id INTEGER NOT NULL, PRIMARY KEY (user_id, channel_id));

CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, parent_id INTEGER, content TEXT NOT NULL, created_at INTEGER NOT NULL, att_key TEXT, att_name TEXT, att_type TEXT, quote_id INTEGER, server_id INTEGER);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id, id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, id);
CREATE TABLE IF NOT EXISTS post_likes (post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (post_id, user_id));
CREATE TABLE IF NOT EXISTS follows (follower_id INTEGER NOT NULL, followee_id INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (follower_id, followee_id));
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE TABLE IF NOT EXISTS post_tags (post_id INTEGER NOT NULL, tag TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (post_id, tag));
CREATE INDEX IF NOT EXISTS idx_tags_tag ON post_tags(tag, post_id);
CREATE TABLE IF NOT EXISTS poll_options (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, text TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_poll_post ON poll_options(post_id);
CREATE TABLE IF NOT EXISTS poll_votes (post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, option_id INTEGER NOT NULL, PRIMARY KEY (post_id, user_id));

CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, actor_id INTEGER NOT NULL, post_id INTEGER, channel_id INTEGER, created_at INTEGER NOT NULL, is_read INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, id);
CREATE TABLE IF NOT EXISTS stories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, content TEXT NOT NULL, att_key TEXT, att_type TEXT, visibility TEXT NOT NULL DEFAULT 'all', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_stories_time ON stories(created_at);
CREATE TABLE IF NOT EXISTS close_friends (user_id INTEGER NOT NULL, friend_id INTEGER NOT NULL, PRIMARY KEY (user_id, friend_id));
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open');
