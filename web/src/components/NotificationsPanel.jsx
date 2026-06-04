import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/index.js';
import { Avatar, Spinner, TimeAgo } from './UI.jsx';
import { BellIcon, FriendsIcon, DMsIcon } from './Icons.jsx';

// ── Notification type config ───────────────────────────────────
function notifMeta(n) {
  switch (n.type) {
    case 'friend_request':
      return {
        icon: <FriendsIcon size={18} color="var(--yellow-b)" />,
        accent: 'var(--yellow-b)',
        title: 'Friend Request',
        body:  `${n.data?.from_username} sent you a friend request`,
        action: 'friends',
      };
    case 'friend_accepted':
      return {
        icon: <FriendsIcon size={18} color="var(--green-b)" />,
        accent: 'var(--green-b)',
        title: 'Request Accepted',
        body:  `${n.data?.by_username} accepted your friend request`,
        action: 'friends',
      };
    case 'dm':
      return {
        icon: <DMsIcon size={18} color="var(--blue-b)" />,
        accent: 'var(--blue-b)',
        title: 'New Message',
        body:  `${n.data?.from_username} sent you a message`,
        action: 'dm',
      };
    case 'mention':
      return {
        icon: <span style={{ fontSize: 16 }}>@</span>,
        accent: 'var(--purple-b)',
        title: 'Mentioned',
        body:  `${n.data?.from_username} mentioned you in #${n.data?.channel_name || 'a channel'}`,
        action: 'chat',
      };
    case 'post_like':
      return {
        icon: <span style={{ fontSize: 16 }}>♥</span>,
        accent: 'var(--red-b)',
        title: 'Post Liked',
        body:  `${n.data?.from_username} liked your post`,
        action: 'posts',
      };
    case 'group_invite':
      return {
        icon: <span style={{ fontSize: 16 }}>👥</span>,
        accent: 'var(--aqua-b)',
        title: 'Group Invite',
        body:  `You were added to a group`,
        action: 'groups',
      };
    default:
      return {
        icon: <BellIcon size={18} color="var(--fg3)" />,
        accent: 'var(--fg3)',
        title: 'Notification',
        body:  'You have a new notification',
        action: null,
      };
  }
}

// ── Single notification row ────────────────────────────────────
function NotifRow({ notif, onRead, onNavigate }) {
  const meta = notifMeta(notif);

  const handleClick = async () => {
    if (!notif.read) await onRead(notif.id);
    if (meta.action) onNavigate(meta.action);
  };

  return (
    <button
      onClick={handleClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px', border: 'none', textAlign: 'left',
        background: notif.read ? 'transparent' : 'rgba(69,133,136,.06)',
        cursor: 'pointer', transition: 'background .15s',
        borderLeft: `3px solid ${notif.read ? 'transparent' : meta.accent}`,
        position: 'relative',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg1)'}
      onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(69,133,136,.06)'}
    >
      {/* Icon bubble */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: `${meta.accent}18`,
        border: `1px solid ${meta.accent}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: meta.accent,
      }}>
        {meta.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: notif.read ? 500 : 700,
          fontSize: 13, color: notif.read ? 'var(--fg2)' : 'var(--fg)',
          marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {meta.title}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--fg4)', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {meta.body}
        </div>
        <div style={{ marginTop: 3 }}>
          <TimeAgo date={notif.created_at} />
        </div>
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: meta.accent, flexShrink: 0, marginTop: 4,
        }} />
      )}
    </button>
  );
}

// ── Main panel ────────────────────────────────────────────────
export function NotificationsPanel({ onNavigate, onUnreadChange }) {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('all'); // all | unread

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifs(data.notifications);
      onUnreadChange?.(data.unread);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await api.markNotificationRead(id).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    const unread = notifs.filter(n => !n.read && n.id !== id).length;
    onUnreadChange?.(unread);
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    onUnreadChange?.(0);
  };

  const clearAll = async () => {
    await api.clearNotifications().catch(() => {});
    setNotifs([]);
    onUnreadChange?.(0);
  };

  const displayed = tab === 'unread' ? notifs.filter(n => !n.read) : notifs;
  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg0-soft)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--glass-border)',
        background: 'var(--glass)',
        backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BellIcon size={20} color="var(--fg)" sw={1.8} />
          <h2 style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Notifications</h2>
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--red-b)', color: '#fff',
              fontSize: 11, fontWeight: 700, borderRadius: 10,
              padding: '1px 7px',
            }}>{unreadCount}</span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg1)', borderRadius: 'var(--r-sm)', padding: 3 }}>
          {[
            { id: 'all',    label: 'All'    },
            { id: 'unread', label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '5px 0', borderRadius: 'var(--r-xs)',
              border: 'none', cursor: 'pointer',
              background: tab === t.id ? 'var(--blue)' : 'transparent',
              color: tab === t.id ? '#1d2021' : 'var(--fg3)',
              fontWeight: 700, fontSize: 12, transition: 'all .15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      {notifs.length > 0 && (
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--glass-border)',
        }}>
          <button onClick={markAllRead} style={{
            flex: 1, padding: '7px 0', background: 'none', border: 'none',
            borderRight: '1px solid var(--glass-border)',
            color: 'var(--fg4)', fontSize: 12, cursor: 'pointer',
            transition: 'background .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >✓ Mark all read</button>
          <button onClick={clearAll} style={{
            flex: 1, padding: '7px 0', background: 'none', border: 'none',
            color: 'var(--red-b)', fontSize: 12, cursor: 'pointer',
            transition: 'background .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(204,36,29,.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >🗑 Clear all</button>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Spinner />
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ marginBottom: 12, opacity: 0.4 }}>
              <BellIcon size={40} color="var(--fg3)" sw={1.2} />
            </div>
            <p style={{ color: 'var(--fg4)', fontSize: 14, fontWeight: 600 }}>
              {tab === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </p>
            <p style={{ color: 'var(--fg4)', fontSize: 12, marginTop: 4 }}>
              {tab === 'unread'
                ? 'You have no unread notifications'
                : 'Friend requests, DMs and more will appear here'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {displayed.map((n, i) => (
              <div key={n.id}>
                <NotifRow notif={n} onRead={markRead} onNavigate={onNavigate} />
                {i < displayed.length - 1 && (
                  <div style={{ height: 1, background: 'var(--glass-border)', margin: '0 14px' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
