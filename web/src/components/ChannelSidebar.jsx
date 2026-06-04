import { useState, useEffect } from 'react';
import { Avatar, Badge, Spinner, Modal, Input, Btn, Divider, OnlineDot } from './UI.jsx';
import { api } from '../api/index.js';

function ChannelItem({ ch, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 8px', borderRadius: 'var(--r-sm)', border: 'none',
      background: active ? 'var(--bg2)' : 'transparent',
      color: active ? 'var(--fg)' : ch.unread > 0 ? 'var(--fg1)' : 'var(--fg4)',
      cursor: 'pointer', textAlign: 'left',
      fontWeight: ch.unread > 0 ? 700 : active ? 600 : 400,
      fontSize: 14, transition: 'all .15s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg1)'; e.currentTarget.style.color = 'var(--fg)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = active ? 'var(--fg)' : ch.unread > 0 ? 'var(--fg1)' : 'var(--fg4)'; }}
    >
      <span style={{ fontSize: 13, color: 'var(--fg4)', flexShrink: 0 }}>
        {ch.type === 'announcement' ? '📢' : '#'}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
      {ch.unread > 0 && <Badge count={ch.unread} />}
    </button>
  );
}

function MemberRow({ member, onDM }) {
  return (
    <button onClick={() => onDM(member)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 8px', borderRadius: 'var(--r-sm)', border: 'none',
      background: 'transparent', cursor: 'pointer', textAlign: 'left',
      transition: 'background .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg1)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ position: 'relative' }}>
        <Avatar username={member.username} color={member.avatar_color} size={30} />
        <span style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 10, height: 10, borderRadius: '50%',
          background: member.online ? 'var(--green-b)' : 'var(--bg3)',
          border: '2px solid var(--bg0-soft)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: member.online ? 'var(--fg1)' : 'var(--fg4)',
        }}>{member.username}</div>
        {member.role !== 'member' && (
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: member.role === 'owner' ? 'var(--yellow-b)' : 'var(--blue-b)',
          }}>{member.role}</div>
        )}
      </div>
    </button>
  );
}

export function ChannelSidebar({ community, activeChannelId, onSelectChannel, userId, onDM, onlineUsers, onStructureUpdate, onCommunityCreated, onCommunityJoined }) {
  const [members, setMembers]     = useState([]);
  const [showMembers, setShowMem] = useState(true);
  const [showNewGroup, setNewGrp] = useState(false);
  const [showNewCh, setNewCh]     = useState(null);
  const [groupName, setGrpName]   = useState('');
  const [chName, setChName]       = useState('');
  const [chDesc, setChDesc]       = useState('');
  const [chType, setChType]       = useState('text');
  const [err, setErr]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [showInvite, setShowInv]  = useState(false);
  const [copied, setCopied]       = useState(false);
  const [showSearch, setSearch]   = useState(false);
  const [searchQ, setSearchQ]     = useState('');

  // Create/Join community
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin]     = useState(false);
  const [commName, setCommName]     = useState('');
  const [commDesc, setCommDesc]     = useState('');
  const [commEmoji, setCommEmoji]   = useState('⬡');
  const [commColor, setCommColor]   = useState('#458588');
  const [joinCode, setJoinCode]     = useState('');
  const [commErr, setCommErr]       = useState('');
  const [commBusy, setCommBusy]     = useState(false);

  const EMOJIS_COMM = ['⬡','🔥','🌊','⚡','🎯','🛸','🌙','🎮','💎','🦊','🐉','🌿','🎵','🔮','⚔️','🏔️'];
  const COLORS_COMM = ['#458588','#b16286','#d79921','#689d6a','#d65d0e','#cc241d','#98971a','#83a598'];

  const doCreateCommunity = async () => {
    if (!commName.trim()) return setCommErr('Name required');
    setCommErr(''); setCommBusy(true);
    try {
      const c = await api.createCommunity({ name: commName.trim(), description: commDesc, iconEmoji: commEmoji, iconColor: commColor });
      onCommunityCreated?.(c);
      setShowCreate(false); setCommName(''); setCommDesc('');
    } catch (e) { setCommErr(e.message); }
    finally { setCommBusy(false); }
  };

  const doJoinCommunity = async () => {
    if (!joinCode.trim()) return setCommErr('Enter a code');
    setCommErr(''); setCommBusy(true);
    try {
      const c = await api.joinCommunity(joinCode.trim());
      onCommunityJoined?.(c);
      setShowJoin(false); setJoinCode('');
    } catch (e) { setCommErr(e.message); }
    finally { setCommBusy(false); }
  };

  useEffect(() => {
    if (community?.id) {
      api.getMembers(community.id)
        .then(data => setMembers(data.map(m => ({ ...m, online: onlineUsers.has(m.id) }))))
        .catch(() => {});
    }
  }, [community?.id]);

  // Sync online status
  useEffect(() => {
    setMembers(prev => prev.map(m => ({ ...m, online: onlineUsers.has(m.id) })));
  }, [onlineUsers]);

  const isAdmin = community?.role === 'owner' || community?.role === 'admin';

  const createGroup = async () => {
    if (!groupName.trim()) return setErr('Name required');
    setErr(''); setLoading(true);
    try {
      await api.createCommunityGroup(community.id, groupName.trim());
      setNewGrp(false); setGrpName('');
      onStructureUpdate();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const createChannel = async () => {
    if (!chName.trim()) return setErr('Name required');
    setErr(''); setLoading(true);
    try {
      await api.createChannel(showNewCh, { name: chName, description: chDesc, type: chType });
      setNewCh(null); setChName(''); setChDesc('');
      onStructureUpdate();
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(community.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const groups = community?.groups || [];
  const channels = community?.channels || [];

  const filteredChannels = searchQ.trim()
    ? channels.filter(c => c.name.includes(searchQ.toLowerCase()))
    : channels;

  if (!community) return (
    <div style={{
      width: 'var(--sidebar-w)', background: 'var(--bg0-soft)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--glass-border)', fontWeight: 700, fontSize: 13 }}>
        Communities
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
        <p style={{ color: 'var(--fg4)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          Create a community or join one with an invite code.
        </p>
        <Btn onClick={() => { setShowCreate(true); setCommErr(''); }} style={{ width: '100%' }}>+ Create Community</Btn>
        <Btn variant="outline" onClick={() => { setShowJoin(true); setCommErr(''); }} style={{ width: '100%' }}>Join with Code</Btn>
      </div>

      {/* Create Community Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Community">
        <Input label="Name" value={commName} onChange={e => setCommName(e.target.value)} placeholder="My awesome community" />
        <Input label="Description" value={commDesc} onChange={e => setCommDesc(e.target.value)} placeholder="What's it about?" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 6 }}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {EMOJIS_COMM.map(e => (
              <button key={e} onClick={() => setCommEmoji(e)} style={{
                width: 34, height: 34, borderRadius: 'var(--r-sm)',
                border: `2px solid ${commEmoji === e ? 'var(--blue)' : 'transparent'}`,
                background: commEmoji === e ? 'var(--bg2)' : 'var(--bg1)', fontSize: 17, cursor: 'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 6 }}>Color</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLORS_COMM.map(c => (
              <button key={c} onClick={() => setCommColor(c)} style={{
                width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                border: commColor === c ? '3px solid var(--fg)' : '3px solid transparent',
                transition: 'transform .15s', transform: commColor === c ? 'scale(1.2)' : 'scale(1)',
              }}/>
            ))}
          </div>
        </div>
        {commErr && <p style={{ color: 'var(--red-b)', fontSize: 13, marginBottom: 12 }}>{commErr}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn disabled={commBusy} onClick={doCreateCommunity}>{commBusy ? 'Creating…' : 'Create'}</Btn>
        </div>
      </Modal>

      {/* Join Community Modal */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Join Community">
        <p style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 14 }}>Enter an invite code to join.</p>
        <Input label="Invite Code" value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC12345"
          onKeyDown={e => e.key === 'Enter' && doJoinCommunity()}
        />
        {commErr && <p style={{ color: 'var(--red-b)', fontSize: 13, marginBottom: 12 }}>{commErr}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowJoin(false)}>Cancel</Btn>
          <Btn disabled={commBusy} onClick={doJoinCommunity}>{commBusy ? 'Joining…' : 'Join'}</Btn>
        </div>
      </Modal>
    </div>
  );

  const onlineCount = members.filter(m => m.online).length;

  return (
    <div style={{
      width: 'var(--sidebar-w)', background: 'var(--bg0-soft)',
      borderRight: '1px solid var(--glass-border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Community header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '30%',
            background: `linear-gradient(135deg, ${community.icon_color}dd, ${community.icon_color}66)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>{community.icon_emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {community.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg4)' }}>
              {onlineCount} online · {members.length} members
            </div>
          </div>
          {/* Create new community shortcut */}
          <button onClick={() => { setShowCreate(true); setCommErr(''); }} title="Create community" style={{
            background: 'none', border: '1px solid var(--bg2)', borderRadius: 'var(--r-sm)',
            padding: '3px 7px', cursor: 'pointer', color: 'var(--fg4)', fontSize: 13,
            flexShrink: 0, transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.color = 'var(--blue-b)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg2)'; e.currentTarget.style.color = 'var(--fg4)'; }}
          >+</button>
        </div>

        {/* Channel search */}
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            placeholder="Search channels…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{
              flex: 1, background: 'var(--bg1)', border: '1px solid var(--bg2)',
              borderRadius: 'var(--r-sm)', padding: '4px 8px',
              color: 'var(--fg)', fontSize: 12, outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--bg2)'}
          />
          {isAdmin && (
            <button onClick={() => setShowInv(true)} title="Invite link" style={{
              background: 'var(--bg1)', border: '1px solid var(--bg2)',
              borderRadius: 'var(--r-sm)', padding: '4px 7px',
              color: 'var(--fg3)', cursor: 'pointer', fontSize: 13,
            }}>🔗</button>
          )}
        </div>
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {groups.map(g => {
          const gChannels = filteredChannels.filter(c => c.group_id === g.id);
          return (
            <div key={g.id} style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '4px 6px', marginBottom: 2,
              }}>
                <span style={{
                  flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--fg4)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{g.name}</span>
                {isAdmin && (
                  <button onClick={() => setNewCh(g.id)} title="New channel" style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--fg4)', fontSize: 16, lineHeight: 1, padding: '0 2px',
                    transition: 'color .15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--fg)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--fg4)'}
                  >+</button>
                )}
              </div>
              {gChannels.map(ch => (
                <ChannelItem
                  key={ch.id} ch={ch}
                  active={activeChannelId === ch.id}
                  onClick={() => onSelectChannel(ch)}
                />
              ))}
              {gChannels.length === 0 && !searchQ && (
                <p style={{ fontSize: 12, color: 'var(--fg4)', padding: '2px 8px' }}>No channels yet</p>
              )}
            </div>
          );
        })}

        {/* Uncategorised channels */}
        {(() => {
          const uncategorized = filteredChannels.filter(c => !c.group_id || !groups.find(g => g.id === c.group_id));
          return uncategorized.length > 0 ? (
            <div style={{ marginBottom: 8 }}>
              {uncategorized.map(ch => (
                <ChannelItem key={ch.id} ch={ch} active={activeChannelId === ch.id} onClick={() => onSelectChannel(ch)} />
              ))}
            </div>
          ) : null;
        })()}

        {isAdmin && !searchQ && (
          <button onClick={() => setNewGrp(true)} style={{
            width: '100%', padding: '5px 8px', borderRadius: 'var(--r-sm)',
            background: 'none', border: '1px dashed var(--bg3)',
            color: 'var(--fg4)', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, marginTop: 4,
            transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--fg4)'; e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bg3)'; e.currentTarget.style.color = 'var(--fg4)'; }}
          >+ Add category</button>
        )}
      </div>

      {/* Member list toggle */}
      <div style={{ borderTop: '1px solid var(--glass-border)' }}>
        <button onClick={() => setShowMem(v => !v)} style={{
          width: '100%', padding: '8px 14px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--fg3)', fontSize: 12, fontWeight: 600,
        }}>
          <span style={{ flex: 1, textAlign: 'left' }}>Members ({members.length})</span>
          <span style={{ fontSize: 10 }}>{showMembers ? '▲' : '▼'}</span>
        </button>

        {showMembers && (
          <div style={{ maxHeight: 200, overflowY: 'auto', padding: '0 6px 8px' }}>
            {[...members].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)).map(m => (
              <MemberRow key={m.id} member={m} onDM={onDM} />
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Modal open={showInvite} onClose={() => setShowInv(false)} title="Invite People">
        <p style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 14 }}>
          Share this code with anyone you want to invite to <strong>{community.name}</strong>.
        </p>
        <div style={{
          background: 'var(--bg1)', border: '1px solid var(--bg2)',
          borderRadius: 'var(--r)', padding: '12px 16px',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 20,
          fontWeight: 700, textAlign: 'center', letterSpacing: '0.15em',
          color: 'var(--yellow-b)', marginBottom: 12,
        }}>
          {community.invite_code}
        </div>
        <Btn onClick={copyInvite} style={{ width: '100%' }}>
          {copied ? '✓ Copied!' : 'Copy Code'}
        </Btn>
      </Modal>

      {/* New Group Modal */}
      <Modal open={showNewGroup} onClose={() => setNewGrp(false)} title="New Category">
        <Input label="Category Name" value={groupName} onChange={e => setGrpName(e.target.value)}
          placeholder="e.g. Voice Rooms, Resources" onKeyDown={e => e.key === 'Enter' && createGroup()} />
        {err && <p style={{ color:'var(--red-b)', fontSize:13, marginBottom:12 }}>{err}</p>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={() => setNewGrp(false)}>Cancel</Btn>
          <Btn disabled={loading} onClick={createGroup}>Create</Btn>
        </div>
      </Modal>

      {/* New Channel Modal */}
      <Modal open={!!showNewCh} onClose={() => setNewCh(null)} title="New Channel">
        <Input label="Channel Name" value={chName} onChange={e => setChName(e.target.value.toLowerCase().replace(/\s+/g,'-'))}
          placeholder="e.g. off-topic" />
        <Input label="Description" value={chDesc} onChange={e => setChDesc(e.target.value)} placeholder="Optional" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--fg2)', marginBottom:6 }}>Type</label>
          <div style={{ display:'flex', gap:8 }}>
            {['text','announcement'].map(t => (
              <button key={t} onClick={() => setChType(t)} style={{
                flex:1, padding:'6px 0', borderRadius:'var(--r-sm)', border:'none', cursor:'pointer',
                background: chType===t ? 'var(--blue)' : 'var(--bg1)',
                color: chType===t ? '#1d2021' : 'var(--fg3)',
                fontWeight:600, fontSize:13,
              }}>{t}</button>
            ))}
          </div>
        </div>
        {err && <p style={{ color:'var(--red-b)', fontSize:13, marginBottom:12 }}>{err}</p>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="ghost" onClick={() => setNewCh(null)}>Cancel</Btn>
          <Btn disabled={loading} onClick={createChannel}>Create</Btn>
        </div>
      </Modal>

      {/* Create Community Modal (from within an existing community) */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Community">
        <Input label="Name" value={commName} onChange={e => setCommName(e.target.value)} placeholder="My awesome community" />
        <Input label="Description" value={commDesc} onChange={e => setCommDesc(e.target.value)} placeholder="What's it about?" />
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 6 }}>Icon</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {EMOJIS_COMM.map(e => (
              <button key={e} onClick={() => setCommEmoji(e)} style={{
                width: 34, height: 34, borderRadius: 'var(--r-sm)',
                border: `2px solid ${commEmoji === e ? 'var(--blue)' : 'transparent'}`,
                background: commEmoji === e ? 'var(--bg2)' : 'var(--bg1)', fontSize: 17, cursor: 'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg2)', marginBottom: 6 }}>Color</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLORS_COMM.map(c => (
              <button key={c} onClick={() => setCommColor(c)} style={{
                width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                border: commColor === c ? '3px solid var(--fg)' : '3px solid transparent',
              }}/>
            ))}
          </div>
        </div>
        {commErr && <p style={{ color: 'var(--red-b)', fontSize: 13, marginBottom: 12 }}>{commErr}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Btn>
          <Btn disabled={commBusy} onClick={doCreateCommunity}>{commBusy ? 'Creating…' : 'Create'}</Btn>
        </div>
      </Modal>

      {/* Join Community Modal */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Join Community">
        <p style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 14 }}>Enter an invite code to join.</p>
        <Input label="Invite Code" value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC12345"
          onKeyDown={e => e.key === 'Enter' && doJoinCommunity()}
        />
        {commErr && <p style={{ color: 'var(--red-b)', fontSize: 13, marginBottom: 12 }}>{commErr}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setShowJoin(false)}>Cancel</Btn>
          <Btn disabled={commBusy} onClick={doJoinCommunity}>{commBusy ? 'Joining…' : 'Join'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
