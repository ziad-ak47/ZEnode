import { useState } from 'react';
import { Badge, Modal, Input, Btn, Tip } from './UI.jsx';
import { api } from '../api/index.js';

function CommunityIcon({ comm, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <Tip label={comm.name}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          position: 'relative', width: 48, height: 48,
          borderRadius: active ? '30%' : hov ? '35%' : '50%',
          background: active
            ? `linear-gradient(135deg, ${comm.icon_color}dd, ${comm.icon_color}88)`
            : `linear-gradient(135deg, var(--bg1), var(--bg0-soft))`,
          border: active ? `2px solid ${comm.icon_color}` : '2px solid transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, cursor: 'pointer',
          transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
          boxShadow: active ? `0 0 16px ${comm.icon_color}55` : 'none',
        }}
      >
        {comm.icon_emoji || comm.name[0].toUpperCase()}
        {comm.unread_count > 0 && !active && (
          <span style={{
            position: 'absolute', bottom: -2, right: -2,
            minWidth: 16, height: 16, borderRadius: 8,
            background: 'var(--red-b)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', border: '2px solid var(--bg0-hard)',
          }}>
            {comm.unread_count > 9 ? '9+' : comm.unread_count}
          </span>
        )}
      </button>
    </Tip>
  );
}

const EMOJIS = ['⬡','🔥','🌊','⚡','🎯','🛸','🌙','🎮','💎','🦊','🐉','🌿','🎵','🔮','⚔️','🏔️'];
const COLORS = ['#458588','#b16286','#d79921','#689d6a','#d65d0e','#83a598','#d3869b','#8ec07c'];

export function CommunitySidebar({ communities, activeCommunityId, onSelect, userId, onCreated, onJoined }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin]     = useState(false);
  const [name, setName]             = useState('');
  const [desc, setDesc]             = useState('');
  const [emoji, setEmoji]           = useState('⬡');
  const [color, setColor]           = useState('#458588');
  const [code, setCode]             = useState('');
  const [err, setErr]               = useState('');
  const [loading, setLoading]       = useState(false);

  const create = async () => {
    if (!name.trim()) return setErr('Name required');
    setErr(''); setLoading(true);
    try {
      const c = await api.createCommunity({ name, description: desc, iconEmoji: emoji, iconColor: color, userId });
      onCreated(c);
      setShowCreate(false); setName(''); setDesc('');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const join = async () => {
    if (!code.trim()) return setErr('Enter an invite code');
    setErr(''); setLoading(true);
    try {
      const c = await api.joinCommunity(code.trim(), userId);
      onJoined(c);
      setShowJoin(false); setCode('');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      width: 'var(--comm-w)', flexShrink: 0,
      background: 'var(--bg0-hard)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 0', gap: 6, overflowY: 'auto',
    }}>
      {/* DMs button */}
      <Tip label="Direct Messages">
        <button onClick={() => onSelect('dm')} style={{
          width: 48, height: 48,
          borderRadius: activeCommunityId === 'dm' ? '30%' : '50%',
          background: activeCommunityId === 'dm'
            ? 'linear-gradient(135deg, var(--blue), var(--aqua))'
            : 'var(--bg1)',
          border: activeCommunityId === 'dm' ? '2px solid var(--blue)' : '2px solid transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, cursor: 'pointer',
          transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
          boxShadow: activeCommunityId === 'dm' ? '0 0 16px rgba(69,133,136,.4)' : 'none',
          color: activeCommunityId === 'dm' ? '#1d2021' : 'var(--fg2)',
        }}>💬</button>
      </Tip>

      {/* Divider */}
      <div style={{ width: 32, height: 2, background: 'var(--bg2)', borderRadius: 1, margin: '4px 0' }} />

      {/* Community icons */}
      {communities.map(c => (
        <CommunityIcon
          key={c.id} comm={c}
          active={activeCommunityId === c.id}
          onClick={() => onSelect(c.id)}
        />
      ))}

      {/* Divider */}
      {communities.length > 0 && (
        <div style={{ width: 32, height: 2, background: 'var(--bg2)', borderRadius: 1, margin: '4px 0' }} />
      )}

      {/* Add / Join */}
      <Tip label="Create community">
        <button onClick={() => setShowCreate(true)} style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--bg1)', border: '2px dashed var(--bg3)',
          color: 'var(--green-b)', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .18s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderRadius = '35%'; e.currentTarget.style.borderColor = 'var(--green-b)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderRadius = '50%'; e.currentTarget.style.borderColor = 'var(--bg3)'; }}
        >+</button>
      </Tip>

      <Tip label="Join with invite code">
        <button onClick={() => setShowJoin(true)} style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--bg1)', border: '2px dashed var(--bg3)',
          color: 'var(--yellow-b)', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .18s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderRadius = '35%'; e.currentTarget.style.borderColor = 'var(--yellow-b)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderRadius = '50%'; e.currentTarget.style.borderColor = 'var(--bg3)'; }}
        >#</button>
      </Tip>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Community">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="My awesome community" />
        <Input label="Description" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's it about?" />

        <div style={{ marginBottom: 14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--fg2)', marginBottom:6 }}>Icon</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                width:36, height:36, borderRadius:'var(--r-sm)', border:`2px solid ${emoji===e?'var(--blue)':'transparent'}`,
                background: emoji===e?'var(--bg2)':'var(--bg1)', fontSize:18, cursor:'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--fg2)', marginBottom:6 }}>Color</label>
          <div style={{ display:'flex', gap:6 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer',
                border: color===c?`3px solid var(--fg)`:'3px solid transparent',
              }} />
            ))}
          </div>
        </div>

        {err && <p style={{ color:'var(--red-b)', fontSize:13, marginBottom:12 }}>{err}</p>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn disabled={loading} onClick={create}>{loading ? 'Creating…' : 'Create'}</Btn>
        </div>
      </Modal>

      {/* Join Modal */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Join Community">
        <p style={{ fontSize:13, color:'var(--fg3)', marginBottom:14 }}>
          Enter an invite code shared by a community admin.
        </p>
        <Input label="Invite Code" value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC12345"
          onKeyDown={e => e.key==='Enter' && join()}
        />
        {err && <p style={{ color:'var(--red-b)', fontSize:13, marginBottom:12 }}>{err}</p>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowJoin(false)}>Cancel</Btn>
          <Btn disabled={loading} onClick={join}>{loading ? 'Joining…' : 'Join'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
