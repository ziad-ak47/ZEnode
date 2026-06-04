import { useState } from 'react';
import { api } from '../api/index.js';
import { Avatar } from './UI.jsx';
import { ZEnodeLogo } from './ZEnodeLogo.jsx';
import { saveTheme } from '../theme.js';

const COLORS = [
  '#458588','#b16286','#d79921','#689d6a',
  '#d65d0e','#cc241d','#98971a','#83a598',
  '#d3869b','#8ec07c','#fe8019','#fabd2f',
];

export function ProfilePage({ currentUser, onUpdate, showToast }) {
  const [displayName, setDisplayName] = useState(currentUser.display_name || '');
  const [bio, setBio]                 = useState(currentUser.bio || '');
  const [color, setColor]             = useState(currentUser.avatar_color || '#458588');
  const [theme, setTheme]             = useState(currentUser.theme || 'dark');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateMe({
        bio,
        display_name: displayName.trim() || null,
        theme,
      });
      // Avatar color update would need a separate endpoint — for now update locally
      saveTheme(theme);
      onUpdate({ ...updated, avatar_color: color });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast('Profile saved!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          ⚙️ Profile Settings
        </h2>

        {/* Avatar preview */}
        <div style={{
          background: 'var(--glass)', backdropFilter: 'var(--blur)',
          WebkitBackdropFilter: 'var(--blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--r-lg)', padding: '24px',
          marginBottom: 16, boxShadow: 'var(--sh)',
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{ position: 'relative' }}>
            <Avatar username={currentUser.username} color={color} size={72} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--fg)' }}>
              {displayName || currentUser.username}
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg4)' }}>@{currentUser.username}</div>
            <div style={{ fontSize: 12, color: 'var(--fg4)', marginTop: 4 }}>{bio || 'No bio yet'}</div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Display name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 6 }}>
              Display Name <span style={{ color: 'var(--fg4)', fontWeight: 400 }}>(shown instead of @username)</span>
            </label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value.slice(0, 60))}
              placeholder={currentUser.username}
              style={{
                width: '100%', background: 'var(--bg1)', border: '1px solid var(--bg2)',
                borderRadius: 'var(--r)', padding: '9px 12px', color: 'var(--fg)',
                fontSize: 14, outline: 'none', transition: 'border-color .18s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--bg2)'}
            />
          </div>

          {/* Bio */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 6 }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 200))}
              placeholder="Tell people a bit about yourself…"
              rows={3}
              style={{
                width: '100%', background: 'var(--bg1)', border: '1px solid var(--bg2)',
                borderRadius: 'var(--r)', padding: '9px 12px', color: 'var(--fg)',
                fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                transition: 'border-color .18s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--blue)'}
              onBlur={e => e.target.style.borderColor = 'var(--bg2)'}
            />
            <div style={{ fontSize: 11, color: 'var(--fg4)', textAlign: 'right', marginTop: 3 }}>
              {bio.length}/200
            </div>
          </div>

          {/* Avatar color */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 8 }}>
              Avatar Color
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COLORS.map(c => (
                <button
                  key={c} onClick={() => setColor(c)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%', background: c,
                    border: color === c ? `3px solid var(--fg)` : '3px solid transparent',
                    cursor: 'pointer', transition: 'transform .15s, border-color .15s',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Theme toggle */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 8 }}>
              Theme
            </label>
            <div style={{ display: 'flex', background: 'var(--bg1)', borderRadius: 'var(--r-sm)', padding: 3, gap: 2, width: 'fit-content' }}>
              {[
                { id: 'dark',  icon: '🌙', label: 'Dark'  },
                { id: 'light', icon: '☀️', label: 'Light' },
              ].map(t => (
                <button key={t.id} onClick={() => { setTheme(t.id); saveTheme(t.id); }} style={{
                  padding: '7px 20px', borderRadius: 'var(--r-xs)', border: 'none',
                  background: theme === t.id ? 'var(--blue)' : 'transparent',
                  color: theme === t.id ? '#1d2021' : 'var(--fg3)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, transition: 'all .18s',
                }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '11px 0', borderRadius: 'var(--r)', border: 'none',
              background: saved ? 'var(--green)' : 'var(--blue)',
              color: '#1d2021', fontWeight: 700, fontSize: 15,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1, transition: 'all .2s',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
