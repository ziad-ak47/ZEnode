const BASE = 'http://localhost:3000';

// ── Token storage ──────────────────────────────────────────────
export const tokens = {
  get access()  { return localStorage.getItem('zn_access'); },
  get refresh() { return localStorage.getItem('zn_refresh'); },
  set(access, refresh) {
    localStorage.setItem('zn_access', access);
    if (refresh) localStorage.setItem('zn_refresh', refresh);
  },
  clear() {
    localStorage.removeItem('zn_access');
    localStorage.removeItem('zn_refresh');
    localStorage.removeItem('ze_user');
  },
};

// ── Core fetch with auto token-refresh ─────────────────────────
let refreshing = null;

async function req(path, opts = {}) {
  const doFetch = (token) => fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });

  let res = await doFetch(tokens.access);

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'TOKEN_EXPIRED' && tokens.refresh) {
      if (!refreshing) {
        refreshing = fetch(`${BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refresh }),
        }).then(async (r) => {
          const d = await r.json();
          if (r.ok) tokens.set(d.accessToken, d.refreshToken);
          else tokens.clear();
          return d;
        }).finally(() => { refreshing = null; });
      }
      await refreshing;
      if (tokens.access) res = await doFetch(tokens.access);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Unauthorized');
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
}

// ── API ────────────────────────────────────────────────────────
export const api = {
  // Auth
  register:    (username, email, password) => req('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login:       (login, password)           => req('/api/auth/login',    { method: 'POST', body: JSON.stringify({ login, password }) }),
  logout:      ()                          => req('/api/auth/logout',   { method: 'POST' }),
  getMe:       ()                          => req('/api/me'),
  updateMe:    (data)          => req('/api/me',            { method: 'PATCH', body: JSON.stringify(data) }),
  updatePubKey:(publicKey)                 => req('/api/me/pubkey',     { method: 'PUT',   body: JSON.stringify({ publicKey }) }),
  getPubKey:   (id)                        => req(`/api/users/${id}/pubkey`),
  getBookmarks:()                          => req('/api/me/bookmarks'),

  // Communities
  getMyCommunities: ()             => req('/api/me/communities'),
  getCommunity:     (id)           => req(`/api/communities/${id}`),
  createCommunity:  (body)         => req('/api/communities',      { method: 'POST', body: JSON.stringify(body) }),
  joinCommunity:    (inviteCode)   => req('/api/communities/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
  getMembers:       (id)           => req(`/api/communities/${id}/members`),

  // Community-scoped groups (categories inside a community)
  createCommunityGroup: (communityId, name) =>
    req(`/api/communities/${communityId}/groups`, { method: 'POST', body: JSON.stringify({ name }) }),

  // Channels inside a community group
  createChannel: (groupId, body) =>
    req(`/api/community-groups/${groupId}/channels`, { method: 'POST', body: JSON.stringify(body) }),

  // Messages
  getMessages:    (chId, before)  => req(`/api/channels/${chId}/messages?limit=50${before ? `&before=${before}` : ''}`),
  getPinned:      (chId)          => req(`/api/channels/${chId}/pinned`),
  searchMessages: (chId, q)       => req(`/api/channels/${chId}/search?q=${encodeURIComponent(q)}`),

  // DMs (friends only)
  getDMList: ()                    => req('/api/dms'),
  getDMs:    (otherId, before)     => req(`/api/dms/${otherId}?limit=50${before ? `&before=${before}` : ''}`),

  // Friends
  getFriends:        ()            => req('/api/friends'),
  getFriendRequests: ()            => req('/api/friends/requests'),
  sendFriendRequest: (targetId)    => req('/api/friends/request',     { method: 'POST',   body: JSON.stringify({ targetId }) }),
  respondFriendReq:  (id, action)  => req(`/api/friends/request/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  removeFriend:      (targetId)    => req(`/api/friends/${targetId}`, { method: 'DELETE' }),
  searchUsers:       (q)           => req(`/api/users/search?q=${encodeURIComponent(q)}`),

  // Standalone groups
  getMyGroups:        ()           => req('/api/groups/my'),
  getGroup:           (id)         => req(`/api/groups/${id}`),
  createStandaloneGroup: (body)    => req('/api/groups',           { method: 'POST', body: JSON.stringify(body) }),
  inviteToGroup:      (gid, tid)   => req(`/api/groups/${gid}/invite`, { method: 'POST', body: JSON.stringify({ targetId: tid }) }),
  joinGroup:          (code)       => req('/api/groups/join',      { method: 'POST', body: JSON.stringify({ inviteCode: code }) }),
  createGroupChannel: (gid, body)  => req(`/api/groups/${gid}/channels`, { method: 'POST', body: JSON.stringify(body) }),

  // Posts
  getPosts:              (before)          => req(`/api/posts?limit=20${before ? `&before=${before}` : ''}`),
  createPost:            (body)            => req('/api/posts',                  { method: 'POST',   body: JSON.stringify(body) }),
  updatePostVisibility:  (id, vis, chosen) => req(`/api/posts/${id}/visibility`, { method: 'PATCH',  body: JSON.stringify({ visibility: vis, chosenFriends: chosen || [] }) }),
  likePost:              (id)              => req(`/api/posts/${id}/like`,        { method: 'POST' }),
  deletePost:            (id)              => req(`/api/posts/${id}`,             { method: 'DELETE' }),

  // Notifications
  getNotifications:         ()   => req('/api/notifications'),
  markNotificationRead:     (id) => req(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: ()   => req('/api/notifications/read-all',   { method: 'PATCH' }),
  clearNotifications:       ()   => req('/api/notifications',            { method: 'DELETE' }),
};
