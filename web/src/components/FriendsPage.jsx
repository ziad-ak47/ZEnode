import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { Avatar, OnlineDot, Spinner, Input, Btn } from './UI.jsx';

function UserCard({ user, friendStatus, direction, onAdd, onAccept, onDecline, onRemove, onDM, requestId }) {
  const [busy, setBusy] = useState(false);

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      background: 'var(--glass)', border: '1px solid var(--glass-border)',
      borderRadius: 'var(--r)', marginBottom: 8, boxShadow: 'var(--sh)',
    }}>
      <Avatar username={user.username} color={user.avatar_color} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{user.username}</div>
        {user.bio && <div style={{ fontSize: 12, color: 'var(--fg4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.bio}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {friendStatus === 'accepted' && (
          <>
            <Btn onClick={() => act(onDM)} style={{ padding: '5px 12px', fontSize: 12 }}>💬 DM</Btn>
            <Btn variant="outline" onClick={() => act(onRemove)} style={{ padding: '5px 10px', fontSize: 12 }}>Remove</Btn>
          </>
        )}
        {friendStatus === 'none' && (
          <Btn onClick={() => act(onAdd)} disabled={busy} style={{ padding: '5px 12px', fontSize: 12 }}>+ Add</Btn>
        )}
        {friendStatus === 'pending' && direction === 'outgoing' && (
          <span style={{ fontSize: 12, color: 'var(--fg4)', padding: '5px 10px', background: 'var(--bg1)', borderRadius: 'var(--r-sm)' }}>
            Pending…
          </span>
        )}
        {friendStatus === 'pending' && direction === 'incoming' && (
          <>
            <Btn onClick={() => act(onAccept)} disabled={busy} style={{ padding: '5px 12px', fontSize: 12 }}>Accept</Btn>
            <Btn variant="outline" onClick={() => act(onDecline)} disabled={busy} style={{ padding: '5px 10px', fontSize: 12 }}>Decline</Btn>
          </>
        )}
      </div>
    </div>
  );
}

export function FriendsPage({ currentUser, showToast, onDM }) {
  const [tab, setTab]             = useState('friends'); // friends | requests | search
  const [friends, setFriends]     = useState([]);
  const [requests, setRequests]   = useState([]);
  const [searchQ, setSearchQ]     = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([api.getFriends(), api.getFriendRequests()]);
      setFriends(f);
      setRequests(r);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const search = async () => {
    if (searchQ.trim().length < 2) return;
    setSearching(true);
    try {
      const data = await api.searchUsers(searchQ.trim());
      setSearchRes(data);
      setTab('search');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSearching(false); }
  };

  const sendRequest = async (targetId) => {
    try {
      await api.sendFriendRequest(targetId);
      showToast('Friend request sent!', 'success');
      setSearchRes(prev => prev.map(u =>
        u.id === targetId ? { ...u, friendship_status: 'pending', direction: 'outgoing' } : u
      ));
    } catch (e) { showToast(e.message, 'error'); }
  };

  const respond = async (requestId, action, userId) => {
    try {
      await api.respondFriendReq(requestId, action);
      if (action === 'accept') {
        showToast('Friend added!', 'success');
        load();
      } else {
        setRequests(prev => prev.filter(r => r.id !== requestId));
      }
    } catch (e) { showToast(e.message, 'error'); }
  };

  const removeFriend = async (targetId) => {
    try {
      await api.removeFriend(targetId);
      setFriends(prev => prev.filter(f => f.id !== targetId));
    } catch (e) { showToast(e.message, 'error'); }
  };

  const pendingIncoming = requests.filter(r => r.direction === 'incoming');

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 16 }}>🤝 Friends</h2>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Search users by username…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            style={{
              flex: 1, background: 'var(--bg1)', border: '1px solid var(--bg2)',
              borderRadius: 'var(--r)', padding: '9px 14px', color: 'var(--fg)',
              fontSize: 14, outline: 'none', transition: 'border-color .18s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--bg2)'}
          />
          <Btn onClick={search} disabled={searching || searchQ.trim().length < 2}>
            {searching ? <Spinner size={14} /> : '🔍 Search'}
          </Btn>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', background: 'var(--bg1)',
          borderRadius: 'var(--r-sm)', padding: 3, marginBottom: 16, gap: 2,
        }}>
          {[
            { id: 'friends', label: `Friends (${friends.length})` },
            { id: 'requests', label: `Requests${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ''}` },
            ...(searchRes.length > 0 ? [{ id: 'search', label: `Results (${searchRes.length})` }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '7px 0', borderRadius: 'var(--r-xs)',
              border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'var(--blue)' : 'transparent',
              color: tab === t.id ? '#1d2021' : 'var(--fg3)',
              fontWeight: 700, fontSize: 13, transition: 'all .18s',
            }}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
        ) : (
          <>
            {tab === 'friends' && (
              friends.length === 0 ? (
                <p style={{ color: 'var(--fg4)', fontSize: 14, textAlign: 'center', padding: 32 }}>
                  No friends yet. Search for users to add them!
                </p>
              ) : friends.map(f => (
                <UserCard
                  key={f.id} user={f}
                  friendStatus="accepted"
                  onDM={() => onDM(f)}
                  onRemove={() => removeFriend(f.id)}
                />
              ))
            )}

            {tab === 'requests' && (
              requests.length === 0 ? (
                <p style={{ color: 'var(--fg4)', fontSize: 14, textAlign: 'center', padding: 32 }}>
                  No pending requests.
                </p>
              ) : requests.map(r => (
                <UserCard
                  key={r.id}
                  user={{ id: r.user_id, username: r.username, avatar_color: r.avatar_color }}
                  friendStatus="pending"
                  direction={r.direction}
                  requestId={r.id}
                  onAccept={() => respond(r.id, 'accept', r.user_id)}
                  onDecline={() => respond(r.id, 'decline', r.user_id)}
                />
              ))
            )}

            {tab === 'search' && (
              searchRes.length === 0 ? (
                <p style={{ color: 'var(--fg4)', fontSize: 14, textAlign: 'center', padding: 32 }}>
                  No users found.
                </p>
              ) : searchRes.map(u => (
                <UserCard
                  key={u.id} user={u}
                  friendStatus={u.friendship_status || 'none'}
                  direction={u.direction}
                  onAdd={() => sendRequest(u.id)}
                  onDM={() => onDM(u)}
                  onRemove={() => removeFriend(u.id)}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
