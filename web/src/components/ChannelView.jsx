import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/index.js';
import { MessageBubble } from './MessageBubble.jsx';
import { MessageInput } from './MessageInput.jsx';
import { Spinner, Divider, TimeAgo } from './UI.jsx';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';

const SAME_AUTHOR_GAP = 5 * 60 * 1000; // 5 min

function DateDivider({ date }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const label =
    d.toDateString() === today.toDateString()     ? 'Today' :
    d.toDateString() === yesterday.toDateString() ? 'Yesterday' :
    d.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' });
  return <Divider label={label} />;
}

function TypingIndicator({ typingUsers }) {
  if (!typingUsers.length) return null;
  const names = typingUsers.map(u => u.username);
  const label =
    names.length === 1 ? `${names[0]} is typing` :
    names.length === 2 ? `${names[0]} and ${names[1]} are typing` :
    `${names.length} people are typing`;
  return (
    <div style={{ padding: '0 16px 4px', display: 'flex', alignItems: 'center', gap: 6, height: 22 }}>
      <span style={{ display: 'flex', gap: 3 }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: '50%', background: 'var(--fg4)',
            display: 'inline-block',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </span>
      <span style={{ fontSize: 12, color: 'var(--fg4)', fontStyle: 'italic' }}>{label}…</span>
    </div>
  );
}

export function ChannelView({ channel, currentUser, ws, onMarkRead }) {
  const [messages, setMessages]     = useState([]);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(false);
  const [replyTo, setReplyTo]       = useState(null);
  const [typingUsers, setTyping]    = useState([]);
  const [pinned, setPinned]         = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [searchQ, setSearchQ]       = useState('');
  const [searchRes, setSearchRes]   = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const bottomRef                   = useRef(null);
  const containerRef                = useRef(null);
  const loadedChannelRef            = useRef(null);
  const typingTimers                = useRef({});

  // Load messages when channel changes
  useEffect(() => {
    if (!channel?.id) return;
    loadedChannelRef.current = channel.id;
    setMessages([]); setHasMore(true); setTyping([]); setReplyTo(null);
    setSearchRes(null); setSearchQ('');
    loadMessages(null, true);
    loadPinned();
    onMarkRead(channel.id);
  }, [channel?.id]);

  const loadMessages = async (before, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await api.getMessages(channel.id, before);
      setMessages(prev => reset ? data.messages : [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      if (reset) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadPinned = async () => {
    try { const d = await api.getPinned(channel.id); setPinned(d); } catch {}
  };

  // Load more on scroll to top
  const topSentinel = useInfiniteScroll(() => {
    if (messages.length > 0 && hasMore && !loading) {
      loadMessages(messages[0].id);
    }
  }, hasMore && messages.length > 0 && !loading);

  // WebSocket incoming messages
  useEffect(() => {
    if (!ws) return;
    const origHandler = ws._onMessage;

    const handler = (data) => {
      if (data.type === 'channel_msg' && data.channelId === channel?.id) {
        if (loadedChannelRef.current !== channel.id) return;
        setMessages(prev => {
          if (prev.find(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
        onMarkRead(channel.id);
      }
      if (data.type === 'typing' && data.channelId === channel?.id && data.userId !== currentUser.id) {
        setTyping(prev => {
          if (prev.find(u => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, username: data.username }];
        });
        clearTimeout(typingTimers.current[data.userId]);
        typingTimers.current[data.userId] = setTimeout(() =>
          setTyping(p => p.filter(u => u.userId !== data.userId)), 5000
        );
      }
      if (data.type === 'stop_typing' && data.channelId === channel?.id) {
        setTyping(p => p.filter(u => u.userId !== data.userId));
      }
      if (data.type === 'reaction' && data.channelId === channel?.id) {
        setMessages(prev => prev.map(m => {
          if (m.id !== data.messageId) return m;
          let reactions = [...(m.reactions || [])];
          if (data.action === 'add') {
            reactions.push({ emoji: data.emoji, user_id: data.userId, username: '' });
          } else {
            reactions = reactions.filter(r => !(r.emoji === data.emoji && r.user_id === data.userId));
          }
          return { ...m, reactions };
        }));
      }
      if (data.type === 'message_edited' && data.channelId === channel?.id) {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId ? { ...m, content: data.content, edited: true } : m
        ));
      }
      if (data.type === 'message_deleted' && data.channelId === channel?.id) {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId ? { ...m, deleted: true, content: '[deleted]' } : m
        ));
      }
      if (data.type === 'message_pinned' && data.channelId === channel?.id) {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId ? { ...m, pinned: data.pinned } : m
        ));
        loadPinned();
      }
    };

    ws._channelHandler = handler;
    ws.addListener(handler);
    return () => ws.removeListener(handler);
  }, [channel?.id, ws, currentUser.id]);

  const sendMessage = (text) => {
    ws.send({ type: 'channel_msg', channelId: channel.id, content: text, replyTo: replyTo?.id || null });
    setReplyTo(null);
  };

  const handleTyping = () => ws.send({ type: 'typing', channelId: channel.id });

  const handleReact    = (msgId, emoji)   => ws.send({ type: 'react',    messageId: msgId, emoji });
  const handleEdit     = (msgId, content) => ws.send({ type: 'edit',     messageId: msgId, content });
  const handleDelete   = (msgId)          => ws.send({ type: 'delete',   messageId: msgId });
  const handlePin      = (msgId)          => ws.send({ type: 'pin',      messageId: msgId });
  const handleBookmark = (msgId)          => ws.send({ type: 'bookmark', messageId: msgId });

  const handleSearch = async (q) => {
    if (!q.trim()) { setSearchRes(null); return; }
    try {
      const data = await api.searchMessages(channel.id, q);
      setSearchRes(data);
    } catch {}
  };

  // Group messages (compact consecutive from same author)
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const compact = prev &&
      prev.user_id === msg.user_id &&
      !prev.deleted &&
      new Date(msg.created_at) - new Date(prev.created_at) < SAME_AUTHOR_GAP;

    const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
    acc.push({ msg, compact, showDate });
    return acc;
  }, []);

  if (!channel) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <span style={{ fontSize:48 }}>⬡</span>
      <p style={{ color:'var(--fg4)', fontSize:14 }}>Select a channel to start chatting</p>
    </div>
  );

  const displayMessages = searchRes ?? grouped;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>
      {/* Channel header */}
      <div style={{
        padding: '0 16px', height: 52,
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
        flexShrink: 0,
      }}>
        <span style={{ color:'var(--fg4)', fontSize:16 }}>
          {channel.type === 'announcement' ? '📢' : '#'}
        </span>
        <span style={{ fontWeight:700, fontSize:15 }}>{channel.name}</span>
        {channel.description && (
          <>
            <div style={{ width:1, height:20, background:'var(--bg3)' }} />
            <span style={{ fontSize:13, color:'var(--fg4)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {channel.description}
            </span>
          </>
        )}

        {/* Toolbar */}
        <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
          <ToolBtn onClick={() => setShowPinned(v => !v)} active={showPinned} title={`Pinned (${pinned.length})`}>📌</ToolBtn>
          <ToolBtn onClick={() => setShowSearch(v => !v)} active={showSearch} title="Search messages">🔍</ToolBtn>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={{ padding:'8px 16px', background:'var(--bg0-soft)', borderBottom:'1px solid var(--glass-border)', display:'flex', gap:8 }}>
          <input
            autoFocus
            placeholder="Search in this channel…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(searchQ); if (e.key === 'Escape') { setShowSearch(false); setSearchRes(null); setSearchQ(''); } }}
            style={{
              flex:1, background:'var(--bg1)', border:'1px solid var(--bg2)',
              borderRadius:'var(--r-sm)', padding:'6px 10px', color:'var(--fg)',
              fontSize:13, outline:'none',
            }}
          />
          {searchRes !== null && (
            <button onClick={() => { setSearchRes(null); setSearchQ(''); }} style={{
              background:'none', border:'none', cursor:'pointer', color:'var(--fg4)', fontSize:16,
            }}>×</button>
          )}
        </div>
      )}

      {/* Pinned messages panel */}
      {showPinned && pinned.length > 0 && (
        <div className="slide-l" style={{
          position:'absolute', right:0, top:52, width:320, zIndex:20,
          background:'var(--bg0-soft)', border:'1px solid var(--glass-border)',
          borderRadius:'0 0 0 var(--r-md)',
          boxShadow:'var(--sh)', overflow:'hidden',
        }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--glass-border)', fontWeight:700, fontSize:13 }}>
            📌 Pinned Messages ({pinned.length})
          </div>
          <div style={{ maxHeight:360, overflowY:'auto', padding:'8px' }}>
            {pinned.map(m => (
              <div key={m.id} style={{
                padding:'8px 10px', marginBottom:4, borderRadius:'var(--r-sm)',
                background:'var(--bg1)', border:'1px solid var(--bg2)',
              }}>
                <div style={{ fontSize:12, color:'var(--fg3)', marginBottom:3 }}>
                  <strong style={{ color:m.avatar_color }}>{m.username}</strong> · <TimeAgo date={m.created_at} />
                </div>
                <p style={{ fontSize:13, color:'var(--fg2)' }}>{m.content?.slice(0,100)}{m.content?.length>100?'…':''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={containerRef} style={{ flex:1, overflowY:'auto', paddingTop:16 }}>
        {/* Top sentinel for loading more */}
        <div ref={topSentinel} style={{ height:4 }} />

        {loading && (
          <div style={{ display:'flex', justifyContent:'center', padding:'8px 0' }}>
            <Spinner size={16} />
          </div>
        )}

        {/* Search results mode */}
        {searchRes !== null ? (
          <div style={{ padding:'0 16px' }}>
            <p style={{ fontSize:12, color:'var(--fg4)', marginBottom:8 }}>
              {searchRes.length} result{searchRes.length !== 1 ? 's' : ''} for "{searchQ}"
            </p>
            {searchRes.map(m => (
              <div key={m.id} style={{
                padding:'8px 12px', marginBottom:6, borderRadius:'var(--r-sm)',
                background:'var(--bg1)', border:'1px solid var(--bg2)',
              }}>
                <div style={{ fontSize:12, color:'var(--fg3)', marginBottom:4 }}>
                  <strong style={{ color:m.avatar_color }}>{m.username}</strong> · <TimeAgo date={m.created_at} full />
                </div>
                <p style={{ fontSize:13, color:'var(--fg2)' }}>{m.content}</p>
              </div>
            ))}
          </div>
        ) : (
          /* Normal feed */
          grouped.map(({ msg, compact, showDate }) => (
            <div key={msg.id}>
              {showDate && <div style={{ padding:'0 16px' }}><DateDivider date={msg.created_at} /></div>}
              <MessageBubble
                msg={msg} currentUser={currentUser} compact={compact}
                onReact={handleReact} onReply={setReplyTo}
                onEdit={handleEdit} onDelete={handleDelete}
                onPin={handlePin} onBookmark={handleBookmark}
              />
            </div>
          ))
        )}

        {messages.length === 0 && !loading && searchRes === null && (
          <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--fg4)' }}>
            <p style={{ fontSize:32, marginBottom:8 }}>#</p>
            <p style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>Welcome to #{channel.name}!</p>
            {channel.description && <p style={{ fontSize:13 }}>{channel.description}</p>}
          </div>
        )}

        <div ref={bottomRef} style={{ height:4 }} />
      </div>

      <TypingIndicator typingUsers={typingUsers} />

      <MessageInput
        placeholder={`Message #${channel.name}`}
        onSend={sendMessage}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}

function ToolBtn({ children, onClick, active, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: active ? 'var(--bg2)' : 'none',
      border: 'none', cursor: 'pointer', color: active ? 'var(--fg)' : 'var(--fg4)',
      fontSize: 15, padding: '5px 8px', borderRadius: 'var(--r-sm)',
      transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='var(--fg)'; }}
      onMouseLeave={e => { e.currentTarget.style.background=active?'var(--bg2)':'none'; e.currentTarget.style.color=active?'var(--fg)':'var(--fg4)'; }}
    >{children}</button>
  );
}
