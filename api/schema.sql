-- ═══════════════════════════════════════════════════════════════
--  ZEnode — Fresh database setup
--  Run this once in Supabase SQL Editor → Run without RLS
--  on a completely empty database
-- ═══════════════════════════════════════════════════════════════

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE ze_users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE,
  password_hash TEXT,
  display_name  TEXT,
  avatar_color  TEXT        NOT NULL DEFAULT '#458588',
  avatar_url    TEXT,
  bio           TEXT                 DEFAULT '',
  public_key    TEXT,
  refresh_token TEXT,
  theme         TEXT                 DEFAULT 'dark',
  created_at    TIMESTAMPTZ          DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ          DEFAULT NOW()
);

-- ── Friendships ───────────────────────────────────────────────
CREATE TABLE ze_friendships (
  id         SERIAL PRIMARY KEY,
  requester  INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  addressee  INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester, addressee)
);

-- ── Communities ───────────────────────────────────────────────
CREATE TABLE ze_communities (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT        DEFAULT '',
  icon_color  TEXT        DEFAULT '#458588',
  icon_emoji  TEXT        DEFAULT '⬡',
  owner_id    INTEGER REFERENCES ze_users(id) ON DELETE SET NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ze_community_members (
  community_id INTEGER REFERENCES ze_communities(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES ze_users(id)       ON DELETE CASCADE,
  role         TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- ── Groups (standalone OR inside a community) ─────────────────
CREATE TABLE ze_groups (
  id           SERIAL PRIMARY KEY,
  community_id INTEGER REFERENCES ze_communities(id) ON DELETE CASCADE,
  owner_id     INTEGER REFERENCES ze_users(id)       ON DELETE SET NULL,
  name         TEXT NOT NULL,
  description  TEXT    DEFAULT '',
  icon_emoji   TEXT    DEFAULT '📁',
  is_private   BOOLEAN DEFAULT FALSE,
  invite_code  TEXT UNIQUE,
  position     INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ze_group_members (
  group_id  INTEGER REFERENCES ze_groups(id) ON DELETE CASCADE,
  user_id   INTEGER REFERENCES ze_users(id)  ON DELETE CASCADE,
  role      TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- ── Channels ──────────────────────────────────────────────────
CREATE TABLE ze_channels (
  id           SERIAL PRIMARY KEY,
  group_id     INTEGER REFERENCES ze_groups(id)      ON DELETE CASCADE,
  community_id INTEGER REFERENCES ze_communities(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT    DEFAULT '',
  type         TEXT    DEFAULT 'text' CHECK (type IN ('text','announcement','voice')),
  position     INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Messages ──────────────────────────────────────────────────
CREATE TABLE ze_messages (
  id           SERIAL PRIMARY KEY,
  channel_id   INTEGER REFERENCES ze_channels(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES ze_users(id)    ON DELETE CASCADE,
  content      TEXT NOT NULL,
  reply_to     INTEGER REFERENCES ze_messages(id) ON DELETE SET NULL,
  edited       BOOLEAN DEFAULT FALSE,
  pinned       BOOLEAN DEFAULT FALSE,
  deleted      BOOLEAN DEFAULT FALSE,
  attachments  JSONB   DEFAULT '[]',
  link_preview JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Message reactions ─────────────────────────────────────────
CREATE TABLE ze_reactions (
  message_id INTEGER REFERENCES ze_messages(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES ze_users(id)    ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- ── Message bookmarks ─────────────────────────────────────────
CREATE TABLE ze_bookmarks (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES ze_users(id)    ON DELETE CASCADE,
  message_id INTEGER REFERENCES ze_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, message_id)
);

-- ── Thread replies ────────────────────────────────────────────
CREATE TABLE ze_threads (
  id         SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES ze_messages(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES ze_users(id)    ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Direct messages (E2E encrypted, friends only) ─────────────
CREATE TABLE ze_dms (
  id                SERIAL PRIMARY KEY,
  sender_id         INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  recipient_id      INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  iv                TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Posts (social feed) ───────────────────────────────────────
CREATE TABLE ze_posts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public'
             CHECK (visibility IN ('public','friends','chosen')),
  edited     BOOLEAN DEFAULT FALSE,
  deleted    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ze_post_visibility (
  post_id INTEGER REFERENCES ze_posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE ze_post_likes (
  post_id INTEGER REFERENCES ze_posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

-- ── Read receipts ─────────────────────────────────────────────
CREATE TABLE ze_channel_reads (
  channel_id   INTEGER REFERENCES ze_channels(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES ze_users(id)    ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE ze_dm_reads (
  user_id      INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  other_id     INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, other_id)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_msg_channel      ON ze_messages(channel_id, id DESC);
CREATE INDEX idx_msg_pinned       ON ze_messages(channel_id) WHERE pinned = TRUE AND deleted = FALSE;
CREATE INDEX idx_dms_pair         ON ze_dms(LEAST(sender_id,recipient_id), GREATEST(sender_id,recipient_id), id DESC);
CREATE INDEX idx_reactions_msg    ON ze_reactions(message_id);
CREATE INDEX idx_channels_comm    ON ze_channels(community_id);
CREATE INDEX idx_channels_group   ON ze_channels(group_id);
CREATE INDEX idx_members_comm     ON ze_community_members(community_id);
CREATE INDEX idx_members_user     ON ze_community_members(user_id);
CREATE INDEX idx_group_members    ON ze_group_members(group_id);
CREATE INDEX idx_threads_msg      ON ze_threads(message_id, created_at ASC);
CREATE INDEX idx_bookmarks_user   ON ze_bookmarks(user_id);
CREATE INDEX idx_friendships      ON ze_friendships(requester, addressee);
CREATE INDEX idx_posts_user       ON ze_posts(user_id, created_at DESC);
CREATE INDEX idx_post_likes       ON ze_post_likes(post_id);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE ze_notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES ze_users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  -- type: friend_request | friend_accepted | dm | mention | post_like | group_invite
  data       JSONB DEFAULT '{}',
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON ze_notifications(user_id, created_at DESC);
