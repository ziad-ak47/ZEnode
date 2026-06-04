import { useState, useEffect, useRef, useCallback } from 'react';
import { api, tokens } from './api/index.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useNotifications } from './hooks/useNotifications.js';
import { applyTheme, getStoredTheme, saveTheme } from './theme.js';
import { LoginPage } from './components/LoginPage.jsx';
import { ChannelSidebar } from './components/ChannelSidebar.jsx';
import { ChannelView } from './components/ChannelView.jsx';
import { DMView } from './components/DMView.jsx';
import { GroupsPage } from './components/GroupsPage.jsx';
import { PostsPage } from './components/PostsPage.jsx';
import { FriendsPage } from './components/FriendsPage.jsx';
import { ProfilePage } from './components/ProfilePage.jsx';
import { NotificationsPanel } from './components/NotificationsPanel.jsx';
import { UserMenu } from './components/UserMenu.jsx';
import { Spinner } from './components/UI.jsx';
import { ZEnodeLogo } from './components/ZEnodeLogo.jsx';
import {
  CommunitiesIcon, GroupsIcon, PostsIcon,
  FriendsIcon, DMsIcon, BellIcon,
} from './components/Icons.jsx';

function makeWsProxy(sendFn) {
  const listeners = [];
  return {
    send:           sendFn,
    addListener:    (fn) => listeners.push(fn),
    removeListener: (fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
    dispatch:       (data) => listeners.forEach(fn => { try { fn(data); } catch(e) { console.error(e); } }),
  };
}

// Nav items — icon is a render function that receives (active, unread)
const NAV = [
  {
    id: 'chat', label: 'Communities',
    Icon: ({ active }) => <CommunitiesIcon size={22} color={active ? '#1d2021' : 'currentColor'} sw={active ? 2 : 1.6} />,
  },
  {
    id: 'groups', label: 'Groups',
    Icon: ({ active }) => <GroupsIcon size={22} color={active ? '#1d2021' : 'currentColor'} sw={active ? 2 : 1.6} />,
  },
  {
    id: 'posts', label: 'Posts',
    Icon: ({ active }) => <PostsIcon size={22} color={active ? '#1d2021' : 'currentColor'} sw={active ? 2 : 1.6} />,
  },
  {
    id: 'friends', label: 'Friends',
    Icon: ({ active }) => <FriendsIcon size={22} color={active ? '#1d2021' : 'currentColor'} sw={active ? 2 : 1.6} />,
  },
  {
    id: 'dm', label: 'Direct Messages',
    Icon: ({ active }) => <DMsIcon size={22} color={active ? '#1d2021' : 'currentColor'} sw={active ? 2 : 1.6} />,
  },
  {
    id: 'notifications', label: 'Notifications',
    Icon: ({ active, unread }) => <BellIcon size={22} color={active ? '#1d2021' : 'currentColor'} sw={active ? 2 : 1.6} dot={unread > 0 && !active} />,
  },
];

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ze_user')); } catch { return null; }
  });
  const [theme, setTheme]              = useState(getStoredTheme);
  const [page, setPage]                = useState('chat');
  const [communities, setCommunities]  = useState([]);
  const [activeCommunityId, setCommId] = useState(null);
  const [communityData, setCommData]   = useState(null);
  const [activeChannel, setChannel]    = useState(null);
  const [onlineUsers, setOnlineUsers]  = useState(new Set());
  const [loading, setLoading]          = useState(false);
  const [toast, setToast]              = useState(null);
  const [pendingDM, setPendingDM]      = useState(null);
  const [unreadNotifs, setUnreadNotifs]= useState(0);
  const wsProxyRef                     = useRef(null);
  const { notify }                     = useNotifications();

  useEffect(() => { applyTheme(theme); }, [theme]);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const { send } = useWebSocket(user?.id, (data) => {
    wsProxyRef.current?.dispatch(data);

    if (data.type === 'channel_msg' && data.message?.user_id !== user?.id)
      notify(data.message?.username, { body: data.message?.content?.slice(0, 80) });

    if (data.type === 'dm' && data.message?.sender_id !== user?.id)
      notify(`DM from ${data.message?.username}`, { body: '🔒 Encrypted message' });

    if (data.type === 'authenticated')
      setOnlineUsers(new Set((data.onlineUsers || []).map(Number)));

    if (data.type === 'presence')
      setOnlineUsers(prev => {
        const next = new Set(prev);
        data.online ? next.add(Number(data.userId)) : next.delete(Number(data.userId));
        return next;
      });

    if (data.type === 'group_created')
      setCommData(prev => prev ? { ...prev, groups: [...(prev.groups || []), data.group] } : prev);

    if (data.type === 'channel_created' && !data.groupId)
      setCommData(prev => prev ? { ...prev, channels: [...(prev.channels || []), data.channel] } : prev);

    // Live notification push → bump unread badge
    if (data.type === 'notification') {
      setUnreadNotifs(n => n + 1);
      const meta = {
        friend_request: `Friend request from ${data.notification?.data?.from_username}`,
        friend_accepted:`${data.notification?.data?.by_username} accepted your request`,
        dm:             `New DM from ${data.notification?.data?.from_username}`,
        post_like:      `${data.notification?.data?.from_username} liked your post`,
        group_invite:   'You were invited to a group',
      };
      const msg = meta[data.notification?.type] || 'New notification';
      showToast(msg, 'info');
      notify('ZEnode', { body: msg });
    }

    if (data.type === 'friend_request')
      showToast(`Friend request from ${data.from?.username}`, 'info');
    if (data.type === 'friend_accepted')
      showToast(`${data.by?.username} accepted your request!`, 'success');
  });

  useEffect(() => { wsProxyRef.current = makeWsProxy(send); }, [send]);

  // Load unread notification count on mount
  useEffect(() => {
    if (!user) return;
    api.getNotifications()
      .then(d => setUnreadNotifs(d.unread || 0))
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    api.getMyCommunities()
      .then(data => { setCommunities(data); if (data.length > 0) setCommId(p => p || data[0].id); })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!activeCommunityId || page !== 'chat') { setCommData(null); setChannel(null); return; }
    setLoading(true);
    api.getCommunity(activeCommunityId)
      .then(data => {
        setCommData(data);
        setChannel(prev =>
          prev && data.channels?.find(c => c.id === prev.id) ? prev : data.channels?.[0] || null
        );
      })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [activeCommunityId, page]);

  const refreshCommunity = () => {
    if (activeCommunityId) api.getCommunity(activeCommunityId).then(setCommData).catch(() => {});
  };

  const markRead = (channelId) => {
    send({ type: 'read', channelId });
    setCommData(prev => prev ? {
      ...prev,
      channels: prev.channels.map(c => c.id === channelId ? { ...c, unread: 0 } : c),
    } : prev);
    setCommunities(prev => prev.map(c =>
      c.id === activeCommunityId
        ? { ...c, unread_count: Math.max(0, (c.unread_count || 1) - 1) }
        : c
    ));
  };

  const handleLogin = (u) => {
    localStorage.setItem('ze_user', JSON.stringify(u));
    const t = u.theme || getStoredTheme();
    setTheme(t); applyTheme(t);
    setUser(u);
  };

  const handleLogout = () => {
    api.logout().catch(() => {});
    tokens.clear();
    setUser(null); setCommunities([]); setCommData(null);
    setChannel(null); setCommId(null); setPage('chat');
  };

  const handleProfileUpdate = (updated) => {
    const next = { ...user, ...updated };
    setUser(next);
    localStorage.setItem('ze_user', JSON.stringify(next));
  };

  const onDMUser = (member) => { setPendingDM(member); setPage('dm'); };
  const navigate = (p) => setPage(p);

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Toast */}
      {toast && (
        <div className="slide-l" style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
          padding: '10px 18px', borderRadius: 'var(--r)',
          background: toast.type === 'error'   ? 'rgba(204,36,29,.92)'
                    : toast.type === 'success' ? 'rgba(69,133,136,.92)'
                    : 'rgba(40,40,40,.92)',
          backdropFilter: 'blur(12px)', color: '#fff', fontWeight: 600, fontSize: 13,
          boxShadow: 'var(--sh-lg)', border: '1px solid var(--glass-border)',
          animation: 'slideL .25s ease both',
        }}>{toast.msg}</div>
      )}

      {/* ── Left nav rail ─────────────────────────────────────── */}
      <div style={{
        width: 'var(--comm-w)', flexShrink: 0,
        background: 'var(--bg0-hard)',
        borderRight: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 0 0', gap: 2,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 8, marginTop: 2 }}>
          <ZEnodeLogo size={32} />
        </div>
        <div style={{ width: 32, height: 1, background: 'var(--bg2)', margin: '2px 0 4px' }} />

        {/* Nav items */}
        {NAV.map(({ id, label, Icon }) => {
          const active = page === id;
          const isNotif = id === 'notifications';
          return (
            <button
              key={id}
              onClick={() => {
                setPage(id);
                if (isNotif) setUnreadNotifs(0); // badge clears on open
              }}
              title={label}
              style={{
                position: 'relative',
                width: 44, height: 44,
                borderRadius: active ? '30%' : '50%',
                background: active
                  ? 'linear-gradient(135deg, var(--blue), var(--aqua))'
                  : 'var(--bg1)',
                border: active ? '2px solid var(--blue)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: active ? '#1d2021' : 'var(--fg3)',
                boxShadow: active ? '0 0 16px rgba(69,133,136,.35)' : 'none',
                transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.borderRadius = '35%';
                  e.currentTarget.style.background = 'var(--bg2)';
                  e.currentTarget.style.color = 'var(--fg)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.borderRadius = '50%';
                  e.currentTarget.style.background = 'var(--bg1)';
                  e.currentTarget.style.color = 'var(--fg3)';
                }
              }}
            >
              <Icon active={active} unread={unreadNotifs} />
            </button>
          );
        })}

        {/* Community icons — chat page only */}
        {page === 'chat' && communities.length > 0 && (
          <>
            <div style={{ width: 32, height: 1, background: 'var(--bg2)', margin: '4px 0' }} />
            {communities.map(c => {
              const active = activeCommunityId === c.id;
              return (
                <button key={c.id} onClick={() => setCommId(c.id)} title={c.name} style={{
                  position: 'relative', width: 44, height: 44,
                  borderRadius: active ? '30%' : '50%',
                  background: active
                    ? `linear-gradient(135deg, ${c.icon_color}dd, ${c.icon_color}88)`
                    : 'var(--bg1)',
                  border: active ? `2px solid ${c.icon_color}` : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 19,
                  boxShadow: active ? `0 0 16px ${c.icon_color}44` : 'none',
                  transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderRadius='35%'; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderRadius='50%'; }}}
                >
                  {c.icon_emoji}
                  {c.unread_count > 0 && !active && (
                    <span style={{
                      position: 'absolute', bottom: -2, right: -2,
                      minWidth: 14, height: 14, borderRadius: 7,
                      background: 'var(--red-b)', color: '#fff', fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px', border: '2px solid var(--bg0-hard)',
                    }}>{c.unread_count > 9 ? '9+' : c.unread_count}</span>
                  )}
                </button>
              );
            })}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* User avatar menu at bottom */}
        <div style={{ paddingBottom: 10 }}>
          <UserMenu
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
            currentTheme={theme}
            onThemeChange={(t) => { setTheme(t); handleProfileUpdate({ theme: t }); }}
          />
        </div>
      </div>

      {/* ── Channel sidebar (chat page only) ─────────────────── */}
      {page === 'chat' && (
        <ChannelSidebar
          community={communityData}
          activeChannelId={activeChannel?.id}
          onSelectChannel={ch => { setChannel(ch); markRead(ch.id); }}
          userId={user.id}
          onDM={onDMUser}
          onlineUsers={onlineUsers}
          onStructureUpdate={refreshCommunity}
          onCommunityCreated={c => { setCommunities(p => [...p, c]); setCommId(c.id); }}
          onCommunityJoined={c => {
            setCommunities(p => p.find(x => x.id === c.id) ? p : [...p, c]);
            setCommId(c.id);
          }}
        />
      )}

      {/* ── Main content ──────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', background: 'var(--bg0)',
      }}>
        {page === 'chat' && (
          loading && !communityData ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Spinner size={32} />
            </div>
          ) : communityData ? (
            <ChannelView
              channel={activeChannel} currentUser={user}
              ws={wsProxyRef.current} onMarkRead={markRead}
            />
          ) : (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
              <ZEnodeLogo size={64} />
              <p style={{ color:'var(--fg3)', fontSize:17, fontWeight:700 }}>Welcome to ZEnode</p>
              <p style={{ color:'var(--fg4)', fontSize:13 }}>
                Select a community from the left, or create one in the sidebar.
              </p>
            </div>
          )
        )}

        {page === 'groups'        && <GroupsPage        currentUser={user} ws={wsProxyRef.current} />}
        {page === 'posts'         && <PostsPage         currentUser={user} showToast={showToast} />}
        {page === 'friends'       && <FriendsPage       currentUser={user} showToast={showToast} onDM={onDMUser} />}
        {page === 'profile'       && <ProfilePage       currentUser={user} onUpdate={handleProfileUpdate} showToast={showToast} />}
        {page === 'notifications' && (
          <NotificationsPanel
            onNavigate={navigate}
            onUnreadChange={setUnreadNotifs}
          />
        )}
        {page === 'dm' && (
          <DMView
            currentUser={user} ws={wsProxyRef.current}
            onlineUsers={onlineUsers}
            pendingDM={pendingDM}
            onPendingDMOpened={() => setPendingDM(null)}
          />
        )}
      </div>
    </div>
  );
}
