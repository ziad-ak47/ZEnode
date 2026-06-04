const express      = require('express');
const cors         = require('cors');
const http         = require('http');
const bcrypt       = require('bcrypt');
const { WebSocketServer } = require('ws');
const { signAccess, signRefresh, verifyRefresh, requireAuth, verifyWsToken } = require('./auth');
const { authLimiter, apiLimiter, messageLimiter, WsRateLimiter } = require('./rateLimiter');
const { fetchLinkPreview } = require('./linkPreview');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(apiLimiter); // global rate limit

let db = null;

// ═══════════════════════════════════════════════════════════════
//  IN-MEMORY STATE
// ═══════════════════════════════════════════════════════════════
const clients      = new Map();  // userId → ws
const wsRl         = new WsRateLimiter(25, 10000);
const typingTimers = new Map();

function send(ws, data) { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function sendToUser(uid, data) { const ws = clients.get(+uid); if (ws) send(ws, data); }

// Create a DB notification and push it live if user is online
async function createNotification(userId, type, data = {}) {
  try {
    const r = await db.query(
      `INSERT INTO ze_notifications (user_id, type, data) VALUES ($1,$2,$3) RETURNING *`,
      [userId, type, JSON.stringify(data)]
    );
    const notif = r.rows[0];
    sendToUser(userId, { type: 'notification', notification: notif });
    return notif;
  } catch (_) {}
}

async function broadcastToCommunity(communityId, data, excludeId = null) {
  const r = await db.query('SELECT user_id FROM ze_community_members WHERE community_id=$1', [communityId]);
  for (const { user_id } of r.rows) {
    if (user_id === excludeId) continue;
    sendToUser(user_id, data);
  }
}

function generateCode() { return Math.random().toString(36).slice(2,10).toUpperCase(); }

// ═══════════════════════════════════════════════════════════════
//  WEBSOCKET
// ═══════════════════════════════════════════════════════════════
wss.on('connection', (ws, req) => {
  // Auth via ?token= query param
  const token  = new URL(req.url, 'http://x').searchParams.get('token');
  const payload = verifyWsToken(token);
  if (!payload) { ws.close(4001, 'Unauthorized'); return; }

  const userId = +payload.id;
  clients.set(userId, ws);
  wsRl.check(userId); // seed entry

  // Broadcast presence
  db.query('SELECT community_id FROM ze_community_members WHERE user_id=$1', [userId])
    .then(r => r.rows.forEach(({ community_id }) =>
      broadcastToCommunity(community_id, { type:'presence', userId, online:true }, userId)
    )).catch(() => {});

  send(ws, { type:'authenticated', onlineUsers: [...clients.keys()] });

  ws.on('message', async (raw) => {
    if (!wsRl.check(userId)) {
      send(ws, { type:'error', message:'Rate limit exceeded' }); return;
    }
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── CHANNEL MESSAGE ────────────────────────────────────────
    if (msg.type === 'channel_msg') {
      const { channelId, content, replyTo } = msg;
      if (!content?.trim() || content.length > 2000) return;

      const ch = await db.query(
        `SELECT c.community_id FROM ze_channels c
         JOIN ze_community_members m ON m.community_id=c.community_id AND m.user_id=$1
         WHERE c.id=$2`, [userId, channelId]
      );
      if (!ch.rows.length) return;
      const communityId = ch.rows[0].community_id;

      // Reply snippet
      let replySnippet = null;
      if (replyTo) {
        const rr = await db.query(
          `SELECT m.content,u.username FROM ze_messages m JOIN ze_users u ON u.id=m.user_id WHERE m.id=$1`, [replyTo]
        );
        if (rr.rows.length) replySnippet = rr.rows[0];
      }

      // Persist
      const r = await db.query(
        `INSERT INTO ze_messages (channel_id,user_id,content,reply_to) VALUES ($1,$2,$3,$4) RETURNING *`,
        [channelId, userId, content.trim(), replyTo||null]
      );
      const saved = r.rows[0];
      const uR = await db.query('SELECT username,avatar_color FROM ze_users WHERE id=$1', [userId]);

      // Async link preview (don't block broadcast)
      fetchLinkPreview(content).then(async (preview) => {
        if (preview) {
          await db.query('UPDATE ze_messages SET link_preview=$1 WHERE id=$2', [JSON.stringify(preview), saved.id]);
          broadcastToCommunity(communityId, { type:'link_preview', messageId:saved.id, channelId, preview });
        }
      }).catch(() => {});

      const payload = {
        type:'channel_msg', channelId,
        message: { ...saved, ...uR.rows[0], reactions:[], reply_snippet:replySnippet }
      };
      broadcastToCommunity(communityId, payload);

      // clear typing
      const key = `c:${channelId}:${userId}`;
      clearTimeout(typingTimers.get(key)); typingTimers.delete(key);
      broadcastToCommunity(communityId, { type:'stop_typing', channelId, userId }, userId);
      return;
    }

    // ── DM ─────────────────────────────────────────────────────
    if (msg.type === 'dm') {
      const { recipientId, encryptedContent, iv } = msg;
      if (!encryptedContent || !iv) return;
      // DMs only between friends
      const friends = await areFriends(db, userId, recipientId);
      if (!friends) {
        send(ws, { type:'error', message:'You can only DM friends. Send a friend request first.' });
        return;
      }
      const r = await db.query(
        `INSERT INTO ze_dms (sender_id,recipient_id,encrypted_content,iv) VALUES ($1,$2,$3,$4) RETURNING *`,
        [userId, recipientId, encryptedContent, iv]
      );
      const uR = await db.query('SELECT username,avatar_color FROM ze_users WHERE id=$1', [userId]);
      const p = { type:'dm', message:{ ...r.rows[0], ...uR.rows[0] } };
      sendToUser(userId, p); sendToUser(recipientId, p);
      // Notify recipient if they're not online or on a different page
      createNotification(recipientId, 'dm', {
        from_id: userId, from_username: uR.rows[0].username,
      });
      return;
    }

    // ── TYPING ────────────────────────────────────────────────
    if (msg.type === 'typing') {
      const { channelId } = msg;
      const ch = await db.query(
        `SELECT c.community_id FROM ze_channels c
         JOIN ze_community_members m ON m.community_id=c.community_id AND m.user_id=$1
         WHERE c.id=$2`, [userId, channelId]
      );
      if (!ch.rows.length) return;
      const communityId = ch.rows[0].community_id;
      const uR = await db.query('SELECT username FROM ze_users WHERE id=$1', [userId]);
      const key = `c:${channelId}:${userId}`;

      broadcastToCommunity(communityId, { type:'typing', channelId, userId, username:uR.rows[0].username }, userId);
      clearTimeout(typingTimers.get(key));
      typingTimers.set(key, setTimeout(() => {
        typingTimers.delete(key);
        broadcastToCommunity(communityId, { type:'stop_typing', channelId, userId }, userId);
      }, 4000));
      return;
    }

    if (msg.type === 'dm_typing') {
      const uR = await db.query('SELECT username FROM ze_users WHERE id=$1', [userId]);
      sendToUser(msg.recipientId, { type:'dm_typing', userId, username:uR.rows[0].username });
      return;
    }

    // ── REACTION ──────────────────────────────────────────────
    if (msg.type === 'react') {
      const { messageId, emoji } = msg;
      const ch = await db.query(
        `SELECT m.channel_id, c.community_id FROM ze_messages m
         JOIN ze_channels c ON c.id=m.channel_id
         JOIN ze_community_members cm ON cm.community_id=c.community_id AND cm.user_id=$1
         WHERE m.id=$2`, [userId, messageId]
      );
      if (!ch.rows.length) return;
      const { channel_id, community_id } = ch.rows[0];
      const exists = await db.query(
        'SELECT 1 FROM ze_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3', [messageId, userId, emoji]
      );
      let action;
      if (exists.rows.length) {
        await db.query('DELETE FROM ze_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3', [messageId, userId, emoji]);
        action = 'remove';
      } else {
        await db.query('INSERT INTO ze_reactions (message_id,user_id,emoji) VALUES ($1,$2,$3)', [messageId, userId, emoji]);
        action = 'add';
      }
      broadcastToCommunity(community_id, { type:'reaction', messageId, emoji, userId, action, channelId:channel_id });
      return;
    }

    // ── EDIT ──────────────────────────────────────────────────
    if (msg.type === 'edit') {
      const { messageId, content } = msg;
      if (!content?.trim() || content.length > 2000) return;
      const r = await db.query(
        `UPDATE ze_messages SET content=$1,edited=TRUE WHERE id=$2 AND user_id=$3 AND deleted=FALSE RETURNING channel_id`,
        [content.trim(), messageId, userId]
      );
      if (!r.rows.length) return;
      const ch = await db.query('SELECT community_id FROM ze_channels WHERE id=$1', [r.rows[0].channel_id]);
      broadcastToCommunity(ch.rows[0].community_id, { type:'message_edited', messageId, content:content.trim(), channelId:r.rows[0].channel_id });
      return;
    }

    // ── DELETE ────────────────────────────────────────────────
    if (msg.type === 'delete') {
      const r = await db.query(
        `UPDATE ze_messages SET deleted=TRUE,content='[deleted]' WHERE id=$1 AND user_id=$2 RETURNING channel_id`,
        [msg.messageId, userId]
      );
      if (!r.rows.length) return;
      const ch = await db.query('SELECT community_id FROM ze_channels WHERE id=$1', [r.rows[0].channel_id]);
      broadcastToCommunity(ch.rows[0].community_id, { type:'message_deleted', messageId:msg.messageId, channelId:r.rows[0].channel_id });
      return;
    }

    // ── PIN ───────────────────────────────────────────────────
    if (msg.type === 'pin') {
      const r = await db.query(
        `UPDATE ze_messages SET pinned=NOT pinned WHERE id=$1 RETURNING channel_id,pinned`, [msg.messageId]
      );
      if (!r.rows.length) return;
      const { channel_id, pinned } = r.rows[0];
      const ch = await db.query('SELECT community_id FROM ze_channels WHERE id=$1', [channel_id]);
      broadcastToCommunity(ch.rows[0].community_id, { type:'message_pinned', messageId:msg.messageId, channelId:channel_id, pinned });
      return;
    }

    // ── READ ──────────────────────────────────────────────────
    if (msg.type === 'read') {
      await db.query(
        `INSERT INTO ze_channel_reads (channel_id,user_id,last_read_at) VALUES ($1,$2,NOW())
         ON CONFLICT (channel_id,user_id) DO UPDATE SET last_read_at=NOW()`,
        [msg.channelId, userId]
      );
      return;
    }
    if (msg.type === 'dm_read') {
      await db.query(
        `INSERT INTO ze_dm_reads (user_id,other_id,last_read_at) VALUES ($1,$2,NOW())
         ON CONFLICT (user_id,other_id) DO UPDATE SET last_read_at=NOW()`,
        [userId, msg.otherId]
      );
      return;
    }

    // ── BOOKMARK ──────────────────────────────────────────────
    if (msg.type === 'bookmark') {
      const exists = await db.query('SELECT 1 FROM ze_bookmarks WHERE user_id=$1 AND message_id=$2', [userId, msg.messageId]);
      if (exists.rows.length) {
        await db.query('DELETE FROM ze_bookmarks WHERE user_id=$1 AND message_id=$2', [userId, msg.messageId]);
        send(ws, { type:'bookmark_update', messageId:msg.messageId, bookmarked:false });
      } else {
        await db.query('INSERT INTO ze_bookmarks (user_id,message_id) VALUES ($1,$2)', [userId, msg.messageId]);
        send(ws, { type:'bookmark_update', messageId:msg.messageId, bookmarked:true });
      }
      return;
    }
  });

  ws.on('close', async () => {
    clients.delete(userId);
    wsRl.clear(userId);
    try {
      const r = await db.query('SELECT community_id FROM ze_community_members WHERE user_id=$1', [userId]);
      r.rows.forEach(({ community_id }) =>
        broadcastToCommunity(community_id, { type:'presence', userId, online:false })
      );
      await db.query('UPDATE ze_users SET last_seen_at=NOW() WHERE id=$1', [userId]);
    } catch (_) {}
  });
});

// ═══════════════════════════════════════════════════════════════
//  REST — AUTH
// ═══════════════════════════════════════════════════════════════
app.get('/api/ping', (_, res) => res.json({ ok:true, app:'ZEnode' }));

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username?.trim() || username.trim().length < 2) return res.status(400).json({ error:'Username min 2 chars' });
  if (!email?.includes('@'))                            return res.status(400).json({ error:'Valid email required' });
  if (!password || password.length < 6)                 return res.status(400).json({ error:'Password min 6 chars' });

  const colors = ['#458588','#b16286','#d79921','#689d6a','#d65d0e','#cc241d','#98971a','#83a598'];
  const color  = colors[Math.floor(Math.random() * colors.length)];
  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query(
      `INSERT INTO ze_users (username,email,password_hash,avatar_color,bio)
       VALUES ($1,$2,$3,$4,'') RETURNING id,username,display_name,email,avatar_color,bio,theme,created_at`,
      [username.trim(), email.trim().toLowerCase(), hash, color]
    );
    const user = r.rows[0];
    const accessToken  = signAccess({ id:user.id, username:user.username });
    const refreshToken = signRefresh({ id:user.id });
    await db.query('UPDATE ze_users SET refresh_token=$1 WHERE id=$2', [refreshToken, user.id]);
    res.status(201).json({ user, accessToken, refreshToken });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: e.detail?.includes('email') ? 'Email already taken' : 'Username already taken' });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Login and password required' });
  try {
    // Match username case-insensitively OR by email
    const r = await db.query(
      `SELECT * FROM ze_users WHERE LOWER(username)=$1 OR LOWER(COALESCE(email,''))=$1`,
      [login.trim().toLowerCase()]
    );
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];

    // Guard: user exists but was created before password auth was added
    if (!user.password_hash) {
      return res.status(401).json({
        error: 'This account has no password set. Please register again with a password.',
        code: 'NO_PASSWORD',
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken  = signAccess({ id: user.id, username: user.username });
    const refreshToken = signRefresh({ id: user.id });
    await db.query(
      'UPDATE ze_users SET refresh_token=$1, last_seen_at=NOW() WHERE id=$2',
      [refreshToken, user.id]
    );

    const { password_hash, refresh_token, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error:'Refresh token required' });
  try {
    const payload = verifyRefresh(refreshToken);
    const r = await db.query('SELECT * FROM ze_users WHERE id=$1 AND refresh_token=$2', [payload.id, refreshToken]);
    if (!r.rows.length) return res.status(401).json({ error:'Invalid refresh token' });
    const user = r.rows[0];
    const newAccess  = signAccess({ id:user.id, username:user.username });
    const newRefresh = signRefresh({ id:user.id });
    await db.query('UPDATE ze_users SET refresh_token=$1 WHERE id=$2', [newRefresh, user.id]);
    res.json({ accessToken:newAccess, refreshToken:newRefresh });
  } catch { res.status(401).json({ error:'Invalid or expired refresh token' }); }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await db.query('UPDATE ze_users SET refresh_token=NULL WHERE id=$1', [req.user.id]);
  res.json({ ok:true });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const r = await db.query(
    'SELECT id,username,display_name,email,avatar_color,bio,theme,created_at,last_seen_at FROM ze_users WHERE id=$1', [req.user.id]
  );
  if (!r.rows.length) return res.status(404).json({ error:'Not found' });
  res.json(r.rows[0]);
});

app.patch('/api/me', requireAuth, async (req, res) => {
  const { bio, display_name, theme } = req.body;
  try {
    const r = await db.query(
      `UPDATE ze_users SET
         bio=$1, display_name=$2, theme=$3
       WHERE id=$4
       RETURNING id,username,display_name,email,avatar_color,bio,theme`,
      [bio?.slice(0,200)||'', display_name?.slice(0,60)||null, theme||'dark', req.user.id]
    );
    res.json(r.rows[0]);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ── User pub key (for E2E DMs) ────────────────────────────────
app.put('/api/me/pubkey', requireAuth, async (req, res) => {
  const { publicKey } = req.body;
  await db.query('UPDATE ze_users SET public_key=$1 WHERE id=$2', [publicKey, req.user.id]);
  res.json({ ok:true });
});

app.get('/api/users/:id/pubkey', requireAuth, async (req, res) => {
  const r = await db.query('SELECT id,username,public_key FROM ze_users WHERE id=$1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error:'Not found' });
  res.json(r.rows[0]);
});

// ── Bookmarks ─────────────────────────────────────────────────
app.get('/api/me/bookmarks', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT m.*,u.username,u.avatar_color,c.name AS channel_name,b.created_at AS bookmarked_at
       FROM ze_bookmarks b
       JOIN ze_messages m ON m.id=b.message_id
       JOIN ze_users u ON u.id=m.user_id
       JOIN ze_channels c ON c.id=m.channel_id
       WHERE b.user_id=$1 ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  REST — COMMUNITIES
// ═══════════════════════════════════════════════════════════════
app.get('/api/me/communities', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT c.*,m.role,
              (SELECT COUNT(*) FROM ze_community_members WHERE community_id=c.id) AS member_count,
              (SELECT COUNT(*) FROM ze_messages msg
               JOIN ze_channels ch ON ch.id=msg.channel_id AND ch.community_id=c.id
               LEFT JOIN ze_channel_reads cr ON cr.channel_id=ch.id AND cr.user_id=$1
               WHERE msg.created_at>COALESCE(cr.last_read_at,'1970-01-01') AND NOT msg.deleted
              ) AS unread_count
       FROM ze_communities c
       JOIN ze_community_members m ON m.community_id=c.id AND m.user_id=$1
       ORDER BY c.created_at ASC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/communities/:id', requireAuth, async (req, res) => {
  try {
    const mem = await db.query(
      'SELECT role FROM ze_community_members WHERE community_id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!mem.rows.length) return res.status(403).json({ error:'Not a member' });
    const comm = await db.query('SELECT * FROM ze_communities WHERE id=$1', [req.params.id]);
    const groups   = await db.query('SELECT * FROM ze_groups WHERE community_id=$1 ORDER BY position,id', [req.params.id]);
    const channels = await db.query(
      `SELECT ch.*,
              COALESCE((SELECT COUNT(*) FROM ze_messages m
               LEFT JOIN ze_channel_reads cr ON cr.channel_id=ch.id AND cr.user_id=$2
               WHERE m.channel_id=ch.id AND m.created_at>COALESCE(cr.last_read_at,'1970-01-01') AND NOT m.deleted
              ),0) AS unread
       FROM ze_channels ch WHERE ch.community_id=$1 ORDER BY ch.position,ch.id`,
      [req.params.id, req.user.id]
    );
    res.json({ ...comm.rows[0], role:mem.rows[0].role, groups:groups.rows, channels:channels.rows });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/communities', requireAuth, async (req, res) => {
  const { name, description, iconEmoji, iconColor } = req.body;
  if (!name?.trim()) return res.status(400).json({ error:'Name required' });
  try {
    const code = generateCode();
    const r = await db.query(
      `INSERT INTO ze_communities (name,description,icon_emoji,icon_color,owner_id,invite_code)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.trim(), description||'', iconEmoji||'⬡', iconColor||'#458588', req.user.id, code]
    );
    const c = r.rows[0];
    await db.query('INSERT INTO ze_community_members (community_id,user_id,role) VALUES ($1,$2,$3)', [c.id, req.user.id, 'owner']);
    const g = await db.query('INSERT INTO ze_groups (community_id,name,position) VALUES ($1,$2,0) RETURNING *', [c.id,'General']);
    await db.query(
      `INSERT INTO ze_channels (group_id,community_id,name,description,position) VALUES ($1,$2,$3,$4,0)`,
      [g.rows[0].id, c.id, 'general', 'General discussion']
    );
    res.status(201).json({ ...c, role:'owner' });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/communities/join', requireAuth, async (req, res) => {
  const { inviteCode } = req.body;
  try {
    const r = await db.query('SELECT * FROM ze_communities WHERE invite_code=$1', [inviteCode?.toUpperCase()]);
    if (!r.rows.length) return res.status(404).json({ error:'Invalid invite code' });
    const c = r.rows[0];
    const exists = await db.query('SELECT 1 FROM ze_community_members WHERE community_id=$1 AND user_id=$2', [c.id, req.user.id]);
    if (exists.rows.length) return res.json({ ...c, role:'member', already:true });
    await db.query('INSERT INTO ze_community_members (community_id,user_id,role) VALUES ($1,$2,$3)', [c.id, req.user.id, 'member']);
    res.status(201).json({ ...c, role:'member' });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/communities/:id/members', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT u.id,u.username,u.avatar_color,u.bio,u.last_seen_at,m.role,m.joined_at
       FROM ze_community_members m JOIN ze_users u ON u.id=m.user_id
       WHERE m.community_id=$1 ORDER BY m.role='owner' DESC,m.role='admin' DESC,u.username`,
      [req.params.id]
    );
    const online = [...clients.keys()];
    res.json(r.rows.map(m => ({ ...m, online:online.includes(m.id) })));
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// ── Groups ────────────────────────────────────────────────────
app.post('/api/communities/:id/groups', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error:'Name required' });
  try {
    const mem = await db.query(
      `SELECT role FROM ze_community_members WHERE community_id=$1 AND user_id=$2 AND role IN ('owner','admin')`,
      [req.params.id, req.user.id]
    );
    if (!mem.rows.length) return res.status(403).json({ error:'No permission' });
    const pos = await db.query('SELECT COALESCE(MAX(position),0)+1 AS p FROM ze_groups WHERE community_id=$1', [req.params.id]);
    const r = await db.query(
      'INSERT INTO ze_groups (community_id,name,position) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, name.trim(), pos.rows[0].p]
    );
    broadcastToCommunity(req.params.id, { type:'group_created', group:r.rows[0] });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// ── Channels ──────────────────────────────────────────────────
app.post('/api/community-groups/:id/channels', requireAuth, async (req, res) => {
  const { name, description, type } = req.body;
  if (!name?.trim()) return res.status(400).json({ error:'Name required' });
  try {
    const g = await db.query('SELECT * FROM ze_groups WHERE id=$1', [req.params.id]);
    if (!g.rows.length) return res.status(404).json({ error:'Group not found' });
    const communityId = g.rows[0].community_id;
    const mem = await db.query(
      `SELECT role FROM ze_community_members WHERE community_id=$1 AND user_id=$2 AND role IN ('owner','admin')`,
      [communityId, req.user.id]
    );
    if (!mem.rows.length) return res.status(403).json({ error:'No permission' });
    const pos = await db.query('SELECT COALESCE(MAX(position),0)+1 AS p FROM ze_channels WHERE group_id=$1', [req.params.id]);
    const r = await db.query(
      `INSERT INTO ze_channels (group_id,community_id,name,description,type,position)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, communityId, name.trim().toLowerCase().replace(/\s+/g,'-'), description||'', type||'text', pos.rows[0].p]
    );
    broadcastToCommunity(communityId, { type:'channel_created', channel:{ ...r.rows[0], unread:0 } });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// ── Messages ──────────────────────────────────────────────────
app.get('/api/channels/:id/messages', requireAuth, async (req, res) => {
  const { before, limit=50 } = req.query;
  try {
    // Check access: either community member OR standalone group member
    const ch = await db.query(
      `SELECT c.community_id, c.group_id FROM ze_channels c WHERE c.id=$1`,
      [req.params.id]
    );
    if (!ch.rows.length) return res.status(404).json({ error: 'Channel not found' });
    const { community_id, group_id } = ch.rows[0];

    if (community_id) {
      const mem = await db.query(
        `SELECT 1 FROM ze_community_members WHERE community_id=$1 AND user_id=$2`,
        [community_id, req.user.id]
      );
      if (!mem.rows.length) return res.status(403).json({ error: 'No access' });
    } else if (group_id) {
      const mem = await db.query(
        `SELECT 1 FROM ze_group_members WHERE group_id=$1 AND user_id=$2`,
        [group_id, req.user.id]
      );
      if (!mem.rows.length) return res.status(403).json({ error: 'No access' });
    } else {
      return res.status(403).json({ error: 'No access' });
    }

    const params = before ? [req.params.id, before, Math.min(limit,100)] : [req.params.id, Math.min(limit,100)];
    const beforeClause = before ? 'AND m.id<$2' : '';
    const limitParam   = before ? '$3' : '$2';

    const r = await db.query(
      `SELECT m.*,u.username,u.avatar_color,
              COALESCE(json_agg(json_build_object('emoji',rx.emoji,'user_id',rx.user_id,'username',ux.username))
               FILTER (WHERE rx.emoji IS NOT NULL),'[]') AS reactions,
              CASE WHEN m.reply_to IS NOT NULL THEN
                json_build_object('id',rm.id,'content',rm.content,'username',ru.username)
              END AS reply_snippet,
              EXISTS(SELECT 1 FROM ze_bookmarks WHERE user_id=${ before?'$4':'$3'} AND message_id=m.id) AS bookmarked
       FROM ze_messages m
       JOIN ze_users u ON u.id=m.user_id
       LEFT JOIN ze_reactions rx ON rx.message_id=m.id
       LEFT JOIN ze_users ux ON ux.id=rx.user_id
       LEFT JOIN ze_messages rm ON rm.id=m.reply_to
       LEFT JOIN ze_users ru ON ru.id=rm.user_id
       WHERE m.channel_id=$1 ${beforeClause}
       GROUP BY m.id,u.username,u.avatar_color,rm.id,rm.content,ru.username
       ORDER BY m.id DESC LIMIT ${limitParam}`,
      [...params, req.user.id]
    );
    res.json({ messages: r.rows.reverse(), hasMore: r.rows.length === +limit });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/channels/:id/pinned', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT m.*,u.username,u.avatar_color FROM ze_messages m JOIN ze_users u ON u.id=m.user_id
       WHERE m.channel_id=$1 AND m.pinned=TRUE AND m.deleted=FALSE ORDER BY m.created_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/channels/:id/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json([]);
  try {
    const r = await db.query(
      `SELECT m.*,u.username,u.avatar_color FROM ze_messages m JOIN ze_users u ON u.id=m.user_id
       WHERE m.channel_id=$1 AND m.content ILIKE $2 AND NOT m.deleted ORDER BY m.created_at DESC LIMIT 30`,
      [req.params.id, `%${q.trim()}%`]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// ── DMs ───────────────────────────────────────────────────────
app.get("/api/dms", requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT DISTINCT ON (other_user)
              CASE WHEN d.sender_id=$1 THEN d.recipient_id ELSE d.sender_id END AS other_user,
              d.id, d.encrypted_content, d.iv, d.created_at,
              u.username, u.avatar_color
       FROM ze_dms d
       JOIN ze_users u ON u.id=CASE WHEN d.sender_id=$1 THEN d.recipient_id ELSE d.sender_id END
       JOIN ze_friendships f ON
         ((f.requester=$1 AND f.addressee=u.id) OR (f.requester=u.id AND f.addressee=$1))
         AND f.status="accepted"
       WHERE d.sender_id=$1 OR d.recipient_id=$1
       ORDER BY other_user, d.created_at DESC`,
      [req.user.id]
    );
    const online = [...clients.keys()];
    res.json(r.rows.map(c => ({ ...c, online:online.includes(c.other_user) })));
  } catch (e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/dms/:otherId', requireAuth, async (req, res) => {
  const { before, limit=50 } = req.query;
  try {
    const params = before
      ? [req.user.id, req.params.otherId, before, Math.min(limit,100)]
      : [req.user.id, req.params.otherId, Math.min(limit,100)];
    const beforeClause = before ? 'AND d.id<$3' : '';
    const limitParam   = before ? '$4' : '$3';
    const r = await db.query(
      `SELECT d.*,u.username,u.avatar_color FROM ze_dms d JOIN ze_users u ON u.id=d.sender_id
       WHERE ((d.sender_id=$1 AND d.recipient_id=$2) OR (d.sender_id=$2 AND d.recipient_id=$1))
       ${beforeClause} ORDER BY d.id DESC LIMIT ${limitParam}`,
      params
    );
    res.json({ messages:r.rows.reverse(), hasMore:r.rows.length===+limit });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  FRIENDS
// ═══════════════════════════════════════════════════════════════

// List my friends (accepted)
app.get('/api/friends', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT u.id,u.username,u.avatar_color,u.bio,f.created_at AS friends_since
       FROM ze_friendships f
       JOIN ze_users u ON u.id = CASE WHEN f.requester=$1 THEN f.addressee ELSE f.requester END
       WHERE (f.requester=$1 OR f.addressee=$1) AND f.status='accepted'
       ORDER BY u.username`,
      [req.user.id]
    );
    const online = [...clients.keys()];
    res.json(r.rows.map(u => ({ ...u, online: online.includes(u.id) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List pending requests (incoming + outgoing)
app.get('/api/friends/requests', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT f.id,f.status,f.created_at,
              u.id AS user_id,u.username,u.avatar_color,
              CASE WHEN f.requester=$1 THEN 'outgoing' ELSE 'incoming' END AS direction
       FROM ze_friendships f
       JOIN ze_users u ON u.id = CASE WHEN f.requester=$1 THEN f.addressee ELSE f.requester END
       WHERE (f.requester=$1 OR f.addressee=$1) AND f.status='pending'
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Send friend request
app.post('/api/friends/request', requireAuth, async (req, res) => {
  const { targetId } = req.body;
  if (!targetId || +targetId === req.user.id)
    return res.status(400).json({ error: 'Invalid target' });
  try {
    // check reverse — maybe they already sent us one
    const existing = await db.query(
      `SELECT * FROM ze_friendships
       WHERE (requester=$1 AND addressee=$2) OR (requester=$2 AND addressee=$1)`,
      [req.user.id, targetId]
    );
    if (existing.rows.length) {
      const f = existing.rows[0];
      if (f.status === 'accepted') return res.status(409).json({ error: 'Already friends' });
      if (f.status === 'blocked')  return res.status(403).json({ error: 'Cannot send request' });
      // They sent us one — auto-accept
      if (f.requester === +targetId) {
        await db.query(
          `UPDATE ze_friendships SET status='accepted',updated_at=NOW() WHERE id=$1`, [f.id]
        );
        return res.json({ status: 'accepted' });
      }
      return res.status(409).json({ error: 'Request already sent' });
    }
    const r = await db.query(
      `INSERT INTO ze_friendships (requester,addressee) VALUES ($1,$2) RETURNING *`,
      [req.user.id, targetId]
    );
    // Notify target via WS
    sendToUser(targetId, {
      type: 'friend_request',
      from: { id: req.user.id, username: req.user.username },
    });
    createNotification(targetId, 'friend_request', {
      from_id: req.user.id, from_username: req.user.username,
    });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Accept / decline request
app.patch('/api/friends/request/:id', requireAuth, async (req, res) => {
  const { action } = req.body; // 'accept' | 'decline'
  if (!['accept','decline'].includes(action))
    return res.status(400).json({ error: 'action must be accept or decline' });
  try {
    const f = await db.query(
      `SELECT * FROM ze_friendships WHERE id=$1 AND addressee=$2 AND status='pending'`,
      [req.params.id, req.user.id]
    );
    if (!f.rows.length) return res.status(404).json({ error: 'Request not found' });
    if (action === 'accept') {
      await db.query(
        `UPDATE ze_friendships SET status='accepted',updated_at=NOW() WHERE id=$1`, [req.params.id]
      );
      sendToUser(f.rows[0].requester, {
        type: 'friend_accepted',
        by: { id: req.user.id, username: req.user.username },
      });
      createNotification(f.rows[0].requester, 'friend_accepted', {
        by_id: req.user.id, by_username: req.user.username,
      });
      res.json({ status: 'accepted' });
    } else {
      await db.query(`DELETE FROM ze_friendships WHERE id=$1`, [req.params.id]);
      res.json({ status: 'declined' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Remove friend / block
app.delete('/api/friends/:targetId', requireAuth, async (req, res) => {
  try {
    await db.query(
      `DELETE FROM ze_friendships
       WHERE (requester=$1 AND addressee=$2) OR (requester=$2 AND addressee=$1)`,
      [req.user.id, req.params.targetId]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Search users (to find people to add)
app.get('/api/users/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q?.trim() || q.trim().length < 2)
    return res.status(400).json({ error: 'Query too short' });
  try {
    const r = await db.query(
      `SELECT u.id,u.username,u.avatar_color,
              COALESCE(f.status,'none') AS friendship_status,
              CASE WHEN f.requester=$1 THEN 'outgoing'
                   WHEN f.addressee=$1 THEN 'incoming'
                   ELSE NULL END AS direction
       FROM ze_users u
       LEFT JOIN ze_friendships f
         ON (f.requester=$1 AND f.addressee=u.id) OR (f.addressee=$1 AND f.requester=u.id)
       WHERE u.id != $1 AND u.username ILIKE $2
       LIMIT 20`,
      [req.user.id, `%${q.trim()}%`]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DM guard — helper used in WS handler below
async function areFriends(db, a, b) {
  const r = await db.query(
    `SELECT 1 FROM ze_friendships
     WHERE ((requester=$1 AND addressee=$2) OR (requester=$2 AND addressee=$1))
     AND status='accepted'`,
    [a, b]
  );
  return r.rows.length > 0;
}

// ═══════════════════════════════════════════════════════════════
//  STANDALONE GROUPS
// ═══════════════════════════════════════════════════════════════

// List my standalone groups (not tied to a community)
app.get('/api/groups/my', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT g.*,gm.role,
              (SELECT COUNT(*) FROM ze_group_members WHERE group_id=g.id) AS member_count
       FROM ze_groups g
       JOIN ze_group_members gm ON gm.group_id=g.id AND gm.user_id=$1
       WHERE g.community_id IS NULL
       ORDER BY g.created_at ASC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get one group with its channels + members
app.get('/api/groups/:id', requireAuth, async (req, res) => {
  try {
    const mem = await db.query(
      `SELECT role FROM ze_group_members WHERE group_id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!mem.rows.length) return res.status(403).json({ error: 'Not a member' });
    const g = await db.query('SELECT * FROM ze_groups WHERE id=$1', [req.params.id]);
    const channels = await db.query(
      `SELECT ch.*,
              COALESCE((SELECT COUNT(*) FROM ze_messages m
               LEFT JOIN ze_channel_reads cr ON cr.channel_id=ch.id AND cr.user_id=$2
               WHERE m.channel_id=ch.id AND m.created_at>COALESCE(cr.last_read_at,'1970-01-01') AND NOT m.deleted
              ),0) AS unread
       FROM ze_channels ch WHERE ch.group_id=$1 ORDER BY ch.position,ch.id`,
      [req.params.id, req.user.id]
    );
    const members = await db.query(
      `SELECT u.id,u.username,u.avatar_color,gm.role
       FROM ze_group_members gm JOIN ze_users u ON u.id=gm.user_id
       WHERE gm.group_id=$1 ORDER BY gm.role='owner' DESC,u.username`,
      [req.params.id]
    );
    const online = [...clients.keys()];
    res.json({
      ...g.rows[0],
      role: mem.rows[0].role,
      channels: channels.rows,
      members: members.rows.map(m => ({ ...m, online: online.includes(m.id) })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create standalone group
app.post('/api/groups', requireAuth, async (req, res) => {
  const { name, description, iconEmoji, isPrivate } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const code = isPrivate ? generateCode() : null;
    const r = await db.query(
      `INSERT INTO ze_groups (community_id,owner_id,name,description,icon_emoji,is_private,invite_code)
       VALUES (NULL,$1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, name.trim(), description||'', iconEmoji||'📁', !!isPrivate, code]
    );
    const group = r.rows[0];
    await db.query(
      `INSERT INTO ze_group_members (group_id,user_id,role) VALUES ($1,$2,'owner')`,
      [group.id, req.user.id]
    );
    // Create a default general channel
    const ch = await db.query(
      `INSERT INTO ze_channels (group_id,name,description,position) VALUES ($1,'general','General discussion',0) RETURNING *`,
      [group.id]
    );
    res.status(201).json({ ...group, role: 'owner', channels: [{ ...ch.rows[0], unread: 0 }], members: [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Invite member to standalone group
app.post('/api/groups/:id/invite', requireAuth, async (req, res) => {
  const { targetId } = req.body;
  try {
    const isAdmin = await db.query(
      `SELECT role FROM ze_group_members WHERE group_id=$1 AND user_id=$2 AND role IN ('owner','admin')`,
      [req.params.id, req.user.id]
    );
    if (!isAdmin.rows.length) return res.status(403).json({ error: 'No permission' });
    await db.query(
      `INSERT INTO ze_group_members (group_id,user_id,role) VALUES ($1,$2,'member') ON CONFLICT DO NOTHING`,
      [req.params.id, targetId]
    );
    sendToUser(+targetId, { type: 'group_invite', groupId: +req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Join group by invite code
app.post('/api/groups/join', requireAuth, async (req, res) => {
  const { inviteCode } = req.body;
  try {
    const r = await db.query(
      `SELECT * FROM ze_groups WHERE invite_code=$1 AND community_id IS NULL`,
      [inviteCode?.toUpperCase()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Invalid invite code' });
    const g = r.rows[0];
    await db.query(
      `INSERT INTO ze_group_members (group_id,user_id,role) VALUES ($1,$2,'member') ON CONFLICT DO NOTHING`,
      [g.id, req.user.id]
    );
    res.json({ ...g, role: 'member' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Add channel to standalone group
app.post('/api/groups/:id/channels', requireAuth, async (req, res) => {
  const { name, description, type } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const mem = await db.query(
      `SELECT role FROM ze_group_members WHERE group_id=$1 AND user_id=$2 AND role IN ('owner','admin')`,
      [req.params.id, req.user.id]
    );
    if (!mem.rows.length) return res.status(403).json({ error: 'No permission' });
    const pos = await db.query(
      `SELECT COALESCE(MAX(position),0)+1 AS p FROM ze_channels WHERE group_id=$1`, [req.params.id]
    );
    const r = await db.query(
      `INSERT INTO ze_channels (group_id,name,description,type,position)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, name.trim().toLowerCase().replace(/\s+/g,'-'), description||'', type||'text', pos.rows[0].p]
    );
    // Notify group members
    const gMembers = await db.query(
      `SELECT user_id FROM ze_group_members WHERE group_id=$1`, [req.params.id]
    );
    gMembers.rows.forEach(({ user_id }) =>
      sendToUser(user_id, { type:'channel_created', channel:{ ...r.rows[0], unread:0 }, groupId:+req.params.id })
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  POSTS WITH VISIBILITY
// ═══════════════════════════════════════════════════════════════

// Get social feed (my posts + friends' public/friends posts)
app.get('/api/posts', requireAuth, async (req, res) => {
  const { before, limit = 20 } = req.query;
  try {
    const params = [req.user.id, Math.min(+limit, 50)];
    const beforeClause = before ? `AND p.id < $3` : '';
    if (before) params.push(+before);
    const r = await db.query(
      `SELECT p.*,u.username,u.avatar_color,
              (SELECT COUNT(*) FROM ze_post_likes WHERE post_id=p.id) AS like_count,
              EXISTS(SELECT 1 FROM ze_post_likes WHERE post_id=p.id AND user_id=$1) AS liked
       FROM ze_posts p
       JOIN ze_users u ON u.id=p.user_id
       WHERE NOT p.deleted
         AND (
           -- my own posts always visible
           p.user_id = $1
           -- public posts from friends
           OR (p.visibility='public' AND EXISTS(
             SELECT 1 FROM ze_friendships f
             WHERE ((f.requester=$1 AND f.addressee=p.user_id)
                 OR (f.addressee=$1 AND f.requester=p.user_id))
             AND f.status='accepted'
           ))
           -- friends-only posts from friends
           OR (p.visibility='friends' AND EXISTS(
             SELECT 1 FROM ze_friendships f
             WHERE ((f.requester=$1 AND f.addressee=p.user_id)
                 OR (f.addressee=$1 AND f.requester=p.user_id))
             AND f.status='accepted'
           ))
           -- chosen posts where I'm explicitly included
           OR (p.visibility='chosen' AND EXISTS(
             SELECT 1 FROM ze_post_visibility pv WHERE pv.post_id=p.id AND pv.user_id=$1
           ))
         )
       ${beforeClause}
       ORDER BY p.id DESC LIMIT $2`,
      params
    );
    res.json({ posts: r.rows, hasMore: r.rows.length === +limit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create post
app.post('/api/posts', requireAuth, async (req, res) => {
  const { content, visibility = 'public', chosenFriends = [] } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  if (!['public','friends','chosen'].includes(visibility))
    return res.status(400).json({ error: 'Invalid visibility' });
  try {
    const r = await db.query(
      `INSERT INTO ze_posts (user_id,content,visibility) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, content.trim(), visibility]
    );
    const post = r.rows[0];
    // If chosen visibility, insert allowed users
    if (visibility === 'chosen' && chosenFriends.length) {
      const vals = chosenFriends.map((_, i) => `($1,$${i+2})`).join(',');
      await db.query(
        `INSERT INTO ze_post_visibility (post_id,user_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
        [post.id, ...chosenFriends]
      );
    }
    const u = await db.query('SELECT username,avatar_color FROM ze_users WHERE id=$1', [req.user.id]);
    res.status(201).json({ ...post, ...u.rows[0], like_count: 0, liked: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update post visibility
app.patch('/api/posts/:id/visibility', requireAuth, async (req, res) => {
  const { visibility, chosenFriends = [] } = req.body;
  if (!['public','friends','chosen'].includes(visibility))
    return res.status(400).json({ error: 'Invalid visibility' });
  try {
    const r = await db.query(
      `UPDATE ze_posts SET visibility=$1 WHERE id=$2 AND user_id=$3 RETURNING *`,
      [visibility, req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Post not found' });
    // Replace chosen list
    await db.query(`DELETE FROM ze_post_visibility WHERE post_id=$1`, [req.params.id]);
    if (visibility === 'chosen' && chosenFriends.length) {
      const vals = chosenFriends.map((_, i) => `($1,$${i+2})`).join(',');
      await db.query(
        `INSERT INTO ze_post_visibility (post_id,user_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
        [req.params.id, ...chosenFriends]
      );
    }
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Like / unlike post
app.post('/api/posts/:id/like', requireAuth, async (req, res) => {
  try {
    const exists = await db.query(
      `SELECT 1 FROM ze_post_likes WHERE post_id=$1 AND user_id=$2`, [req.params.id, req.user.id]
    );
    if (exists.rows.length) {
      await db.query(`DELETE FROM ze_post_likes WHERE post_id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    } else {
      await db.query(`INSERT INTO ze_post_likes (post_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, req.user.id]);
    }
    const cnt = await db.query(`SELECT COUNT(*) AS c FROM ze_post_likes WHERE post_id=$1`, [req.params.id]);
    res.json({ like_count: +cnt.rows[0].c, liked: !exists.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete post
app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  try {
    await db.query(
      `UPDATE ze_posts SET deleted=TRUE WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM ze_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unread = r.rows.filter(n => !n.read).length;
    res.json({ notifications: r.rows, unread });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await db.query(
      `UPDATE ze_notifications SET read=TRUE WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await db.query(
      `UPDATE ze_notifications SET read=TRUE WHERE user_id=$1 AND read=FALSE`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/notifications', requireAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM ze_notifications WHERE user_id=$1`, [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
async function start() {
  const createPool = require('./db');
  db = await createPool();
  server.listen(PORT, () => console.log(`ZEnode API + WS → http://localhost:${PORT}`));
}
start().catch(e => { console.error(e.message); process.exit(1); });
