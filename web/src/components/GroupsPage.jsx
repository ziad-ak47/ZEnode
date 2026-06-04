import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { ChannelView } from './ChannelView.jsx';
import { Avatar, Modal, Input, Btn, Spinner, Badge } from './UI.jsx';

const EMOJIS = ['📁','🔥','🌊','⚡','🎯','🛸','🌙','🎮','💎','🦊','🐉','🌿','🎵','🔮','⚔️','🏔️'];

export function GroupsPage({ currentUser, ws }) {
  const [groups, setGroups]           = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupData, setGroupData]     = useState(null);
  const [activeChannel, setChannel]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [showCreate, setCreate]       = useState(false);
  const [showJoin, setJoin]           = useState(false);
  const [name, setName]               = useState('');
  const [desc, setDesc]               = useState('');
  const [emoji, setEmoji]             = useState('📁');
  const [isPrivate, setPrivate]       = useState(false);
  const [joinCode, setJoinCode]       = useState('');
  const [err, setErr]                 = useState('');
  const [busy, setBusy]               = useState(false);

  useEffect(() => {
    api.getMyGroups().then(setGroups).catch(() => {});
  }, []);

  const openGroup = async (g) => {
    setActiveGroup(g);
    setLoading(true);
    try {
      const data = await api.getGroup(g.id);
      setGroupData(data);
      setChannel(data.channels?.[0] || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const createGroup = async () => {
    if (!name.trim()) return setErr('Name required');
    setErr(''); setBusy(true);
    try {
      const g = await api.createStandaloneGroup({ name: name.trim(), description: desc, iconEmoji: emoji, isPrivate });
      setGroups(p => [...p, g]);
      setCreate(false); setName(''); setDesc(''); setEmoji('📁');
      openGroup(g);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const joinGroup = async () => {
    if (!joinCode.trim()) return setErr('Enter code');
    setErr(''); setBusy(true);
    try {
      const g = await api.joinGroup(joinCode.trim());
      setGroups(p => p.find(x => x.id === g.id) ? p : [...p, g]);
      setJoin(false); setJoinCode('');
      openGroup(g);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Group list */}
      <div style={{
        width: 240, flexShrink: 0,
        background: 'var(--bg0-soft)', borderRight: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid var(--glass-border)',
          fontWeight: 700, fontSize: 14,
        }}>
          👥 My Groups
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {groups.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--fg4)', padding: '8px 10px', lineHeight: 1.6 }}>
              No groups yet. Create one or join with an invite code.
            </p>
          )}
          {groups.map(g => (
            <button key={g.id} onClick={() => openGroup(g)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 10px', borderRadius: 'var(--r-sm)', border: 'none',
              background: activeGroup?.id === g.id ? 'var(--bg2)' : 'transparent',
              cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
            }}
              onMouseEnter={e => { if (activeGroup?.id !== g.id) e.currentTarget.style.background = 'var(--bg1)'; }}
              onMouseLeave={e => { if (activeGroup?.id !== g.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                width: 32, height: 32, borderRadius: '30%',
                background: 'linear-gradient(135deg,var(--blue),var(--aqua))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>{g.icon_emoji || '📁'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg4)' }}>
                  {g.role} · {g.member_count || 1} member{g.member_count !== 1 ? 's' : ''}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 6 }}>
          <Btn onClick={() => { setCreate(true); setErr(''); }} style={{ flex: 1, padding: '6px 0', fontSize: 12 }}>
            + Create
          </Btn>
          <Btn variant="outline" onClick={() => { setJoin(true); setErr(''); }} style={{ flex: 1, padding: '6px 0', fontSize: 12 }}>
            Join
          </Btn>
        </div>
      </div>

      {/* Channel list for active group */}
      {groupData && (
        <div style={{
          width: 200, flexShrink: 0,
          background: 'var(--bg0-soft)', borderRight: '1px solid var(--glass-border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{groupData.icon_emoji} {groupData.name}</div>
            <div style={{ fontSize: 11, color: 'var(--fg4)' }}>{groupData.members?.length || 1} members</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
            {(groupData.channels || []).map(ch => (
              <button key={ch.id} onClick={() => setChannel(ch)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 8px', borderRadius: 'var(--r-sm)', border: 'none',
                background: activeChannel?.id === ch.id ? 'var(--bg2)' : 'transparent',
                color: activeChannel?.id === ch.id ? 'var(--fg)' : 'var(--fg4)',
                cursor: 'pointer', textAlign: 'left', fontSize: 13,
                transition: 'all .15s',
              }}
                onMouseEnter={e => { if (activeChannel?.id !== ch.id) { e.currentTarget.style.background = 'var(--bg1)'; e.currentTarget.style.color = 'var(--fg)'; } }}
                onMouseLeave={e => { if (activeChannel?.id !== ch.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg4)'; } }}
              >
                <span style={{ fontSize: 12 }}>#</span> {ch.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner size={28} />
          </div>
        ) : activeChannel ? (
          <ChannelView channel={activeChannel} currentUser={currentUser} ws={ws} onMarkRead={() => {}} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 40 }}>👥</span>
            <p style={{ color: 'var(--fg4)', fontSize: 14 }}>
              {activeGroup ? 'Select a channel' : 'Select or create a group'}
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setCreate(false)} title="Create Group">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="My group" />
        <Input label="Description" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 6 }}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                width: 34, height: 34, borderRadius: 'var(--r-sm)',
                border: `2px solid ${emoji === e ? 'var(--blue)' : 'transparent'}`,
                background: emoji === e ? 'var(--bg2)' : 'var(--bg1)',
                fontSize: 18, cursor: 'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={isPrivate} onChange={e => setPrivate(e.target.checked)} />
          Private group (invite-only)
        </label>
        {err && <p style={{ color: 'var(--red-b)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setCreate(false)}>Cancel</Btn>
          <Btn disabled={busy} onClick={createGroup}>Create</Btn>
        </div>
      </Modal>

      {/* Join Modal */}
      <Modal open={showJoin} onClose={() => setJoin(false)} title="Join Group">
        <p style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 14 }}>Enter an invite code to join a private group.</p>
        <Input label="Invite Code" value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="XXXXXXXX"
          onKeyDown={e => e.key === 'Enter' && joinGroup()}
        />
        {err && <p style={{ color: 'var(--red-b)', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setJoin(false)}>Cancel</Btn>
          <Btn disabled={busy} onClick={joinGroup}>Join</Btn>
        </div>
      </Modal>
    </div>
  );
}
