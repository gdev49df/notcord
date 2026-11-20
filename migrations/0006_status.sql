ALTER TABLE users ADD COLUMN status_until INTEGER;
ALTER TABLE users ADD COLUMN activity_since INTEGER;
CREATE TABLE IF NOT EXISTS user_games (user_id INTEGER NOT NULL, name TEXT NOT NULL, first_at INTEGER NOT NULL, PRIMARY KEY (user_id, name));
