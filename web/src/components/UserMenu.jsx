import { useState, useRef, useEffect } from 'react';
import { Avatar } from './UI.jsx';
import { saveTheme } from '../theme.js';
import { ProfileIcon, PostsIcon, FriendsIcon, StarIcon, BellIcon } from './Icons.jsx';

export function UserMenu({ user, onNavigate, onLogout, currentTheme, onThemeChange }) {
  const [open, setOpen] = useState(false);
  const menuRef         = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const theme = currentTheme || 'dark';

  const Item = ({ icon, label, onClick, danger }) => (
    <button
      onClick={() => { onClick(); setOpen(false); }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left', color: danger ? 'var(--red-b)' : 'var(--fg2)',
        fontSize: 13, borderRadius: 'var(--r-sm)', transition: 'background .13s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(204,36,29,.12)' : 'var(--bg1)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );

  const Divider = () => (
    <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
  );

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Avatar button */}
      <button
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '4px',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Avatar username={user.username} color={user.avatar_color} size={28} />
          <span style={{
            position: 'absolute', bottom: -1, right: -1, width: 9, height: 9,
            borderRadius: '50%', background: 'var(--green-b)',
            border: '2px solid var(--bg0-hard)',
          }}/>
        </div>
        <span style={{
          fontSize: 9, color: 'var(--fg4)',
          maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.display_name || user.username}
        </span>
      </button>

      {/* Menu popup */}
      {open && (
        <div className="fade-up" style={{
          position: 'absolute', bottom: '100%', left: 0,
          marginBottom: 8, width: 220, zIndex: 200,
          background: 'var(--bg0-soft)',
          backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-lg)',
          overflow: 'hidden',
        }}>
          {/* User info header */}
          <div style={{
            padding: '12px 14px 10px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Avatar username={user.username} color={user.avatar_color} size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.display_name || user.username}
              </div>
              {user.display_name && (
                <div style={{ fontSize: 11, color: 'var(--fg4)' }}>@{user.username}</div>
              )}
              <div style={{
                fontSize: 11, color: 'var(--green-b)',
                display: 'flex', alignItems: 'center', gap: 4, marginTop: 1,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green-b)', display: 'inline-block' }}/>
                Online
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ padding: '4px 4px' }}>
            <Item icon={<ProfileIcon size={16} color="var(--fg3)" />} label="Profile & Settings" onClick={() => onNavigate('profile')} />
            <Item icon={<PostsIcon   size={16} color="var(--fg3)" />} label="My Posts"           onClick={() => onNavigate('posts')} />
            <Item icon={<FriendsIcon size={16} color="var(--fg3)" />} label="Friends"            onClick={() => onNavigate('friends')} />
            <Item icon={<BellIcon    size={16} color="var(--fg3)" />} label="Notifications"      onClick={() => onNavigate('notifications')} />
            <Item icon={<StarIcon    size={16} color="var(--fg3)" />} label="Bookmarks"          onClick={() => onNavigate('bookmarks')} />

            <Divider />

            {/* Theme toggle inline */}
            <div style={{ padding: '4px 14px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15 }}>{theme === 'dark' ? '🌙' : '☀️'}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--fg2)' }}>Theme</span>
              <button
                onClick={() => {
                  const next = theme === 'dark' ? 'light' : 'dark';
                  saveTheme(next);
                  onThemeChange(next);
                }}
                style={{
                  position: 'relative', width: 40, height: 22, borderRadius: 11,
                  background: theme === 'dark' ? 'var(--bg3)' : 'var(--blue)',
                  border: 'none', cursor: 'pointer', transition: 'background .2s',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: theme === 'dark' ? 3 : 21,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left .2s',
                }}/>
              </button>
            </div>

            <Divider />
            <Item
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              }
              label="Sign Out" onClick={onLogout} danger
            />
          </div>
        </div>
      )}
    </div>
  );
}
