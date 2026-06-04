import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/index.js';
import { encryptMessage, decryptMessage, loadKeys } from '../crypto/e2e.js';
import { Avatar, TimeAgo, Spinner, Badge } from './UI.jsx';
import { MessageInput } from './MessageInput.jsx';

function DMItem({ conv, active, online, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 'var(--r-sm)', border: 'none',
      background: active ? 'var(--bg2)' : 'transparent',
      cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg1)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar username={conv.username} color={conv.avatar_color} size={34} />
        <span style={{
          position: 'absolute', bottom: -1, right: -1, width: 11, height: 11,
          borderRadius: '50%', background: online ? 'var(--green-b)' : 'var(--bg3)',
          border: '2px solid var(--bg0-soft)',
        }}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg1)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {conv.username}
          {conv.unread > 0 && <Badge count={conv.unread} />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--green-b)' }}>🔒 encrypted</div>
      </div>
    </button>
  );
}

export function DMView({ currentUser, ws, onlineUsers, pendingDM, onPendingDMOpened }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv]       = useState(null);
  const [messages, setMessages]           = useState([]);
  const [decrypted, setDecrypted]         = useState({});
  const [hasMore, setHasMore]             = useState(true);
  const [loading, setLoading]             = useState(false);
  const [typingFrom, setTypingFrom]       = useState(null);
  const [theirKey, setTheirKey]           = useState(null);
  const [keyError, setKeyError]           = useState(false);
  const bottomRef                         = useRef(null);
  const typingTimer                       = useRef(null);
  const myKeys                            = loadKeys(currentUser.id);

  const loadConvos = useCallback(async () => {
    try {
      const data = await api.getDMList();
      setConversations(data.map(c => ({ ...c, online: onlineUsers.has(c.other_user) })));
    } catch(e) { console.error('loadConvos', e); }
  }, [onlineUsers]);

  useEffect(() => { loadConvos(); }, [currentUser.id]);

  // Sync online status into conversation list
  useEffect(() => {
    setConversations(p => p.map(c => ({ ...c, online: onlineUsers.has(c.other_user) })));
  }, [onlineUsers]);

  // Open a pending DM (triggered by clicking a member in sidebar)
  useEffect(() => {
    if (!pendingDM) return;
    // Build a synthetic conv object from the member
    const synth = {
      other_user:   pendingDM.id,
      username:     pendingDM.username,
      avatar_color: pendingDM.avatar_color,
      online:       onlineUsers.has(pendingDM.id),
      unread:       0,
    };
    openConv(synth);
    onPendingDMOpened?.();
  }, [pendingDM]);

  const decryptAll = async (msgs, pubJwk) => {
    const plain = {};
    for (const m of msgs) {
      plain[m.id] = await decryptMessage(m.encrypted_content, m.iv, myKeys.privateJwk, pubJwk);
    }
    return plain;
  };

  const openConv = async (conv) => {
    setActiveConv(conv);
    setMessages([]); setDecrypted({}); setHasMore(true); setKeyError(false);
    setLoading(true);
    try {
      const keyData = await api.getPubKey(conv.other_user);
      if (!keyData.public_key) { setKeyError(true); setLoading(false); return; }
      const pubJwk = JSON.parse(keyData.public_key);
      setTheirKey(pubJwk);
      const data = await api.getDMs(conv.other_user);
      setMessages(data.messages);
      setHasMore(data.hasMore);
      const plain = await decryptAll(data.messages, pubJwk);
      setDecrypted(plain);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
      // Mark read
      api.getDMList().then(setConversations).catch(() => {});
    } catch(e) { console.error('openConv', e); setKeyError(true); }
    finally { setLoading(false); }
  };

  // Handle WS events
  useEffect(() => {
    if (!ws) return;
    const handler = async (data) => {
      if (data.type === 'dm') {
        const msg = data.message;
        const myId = currentUser.id;
        const relevantOther = msg.sender_id === myId ? msg.recipient_id : msg.sender_id;
        if (relevantOther === activeConv?.other_user) {
          setMessages(p => { if (p.find(m => m.id === msg.id)) return p; return [...p, msg]; });
          if (theirKey) {
            const plain = await decryptMessage(msg.encrypted_content, msg.iv, myKeys.privateJwk, theirKey);
            setDecrypted(p => ({ ...p, [msg.id]: plain }));
          }
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
        }
        loadConvos();
      }
      if (data.type === 'dm_typing' && data.userId === activeConv?.other_user) {
        setTypingFrom(data.username);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingFrom(null), 4000);
      }
      if (data.type === 'dm_stop_typing' && data.userId === activeConv?.other_user) {
        setTypingFrom(null);
      }
    };
    ws.addListener(handler);
    return () => ws.removeListener(handler);
  }, [ws, activeConv?.other_user, theirKey, currentUser.id]);

  const sendDM = async (text) => {
    if (!theirKey || !myKeys) return;
    try {
      const { encryptedContent, iv } = await encryptMessage(text, myKeys.privateJwk, theirKey);
      ws.send({ type: 'dm', recipientId: activeConv.other_user, encryptedContent, iv });
    } catch(e) { console.error('sendDM encrypt error', e); }
  };

  const handleTyping = () => ws?.send({ type: 'dm_typing', recipientId: activeConv?.other_user });

  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const compact = prev && prev.sender_id === msg.sender_id &&
      new Date(msg.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
    acc.push({ msg, compact });
    return acc;
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* DM list */}
      <div style={{
        width: 220, flexShrink: 0, background: 'var(--bg0-soft)',
        borderRight: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 12px 10px', borderBottom: '1px solid var(--glass-border)',
          fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>💬</span> Direct Messages
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {conversations.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--fg4)', padding: '8px 10px' }}>
              No conversations yet.<br/>Click a member in any community to DM them.
            </p>
          )}
          {conversations.map(c => (
            <DMItem
              key={c.other_user} conv={c}
              active={activeConv?.other_user === c.other_user}
              online={onlineUsers.has(c.other_user)}
              onClick={() => openConv(c)}
            />
          ))}
        </div>
      </div>

      {/* Conversation panel */}
      {!activeConv ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 40 }}>🔒</span>
          <p style={{ color: 'var(--fg4)', fontSize: 14 }}>Select a conversation</p>
          <p style={{ color: 'var(--fg4)', fontSize: 12 }}>All messages are end-to-end encrypted</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            height: 52, padding: '0 16px', flexShrink: 0,
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
          }}>
            <div style={{ position: 'relative' }}>
              <Avatar username={activeConv.username} color={activeConv.avatar_color} size={30} />
              <span style={{
                position: 'absolute', bottom: -1, right: -1, width: 10, height: 10,
                borderRadius: '50%', background: onlineUsers.has(activeConv.other_user) ? 'var(--green-b)' : 'var(--bg3)',
                border: '2px solid var(--bg0-soft)',
              }}/>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{activeConv.username}</div>
              <div style={{ fontSize: 11, color: 'var(--green-b)' }}>🔒 end-to-end encrypted</div>
            </div>
          </div>

          {keyError ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: 24 }}>
              <span style={{ fontSize: 32 }}>⚠️</span>
              <p style={{ color: 'var(--yellow-b)', fontWeight: 600 }}>Encryption key unavailable</p>
              <p style={{ color: 'var(--fg4)', fontSize: 13, textAlign: 'center' }}>
                {activeConv.username} needs to log in again to register their key.
              </p>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                {loading && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                    <Spinner />
                  </div>
                )}

                {grouped.map(({ msg, compact }) => {
                  const isOwn = msg.sender_id === currentUser.id;
                  const plain = decrypted[msg.id];
                  return (
                    <div key={msg.id} style={{
                      display: 'flex', gap: 10, padding: compact ? '2px 16px' : '6px 16px',
                      flexDirection: isOwn ? 'row-reverse' : 'row',
                    }}>
                      {!compact && <Avatar username={msg.username} color={msg.avatar_color} size={34} />}
                      {compact && <div style={{ width: 34 }}/>}
                      <div style={{ maxWidth: '70%' }}>
                        {!compact && (
                          <div style={{
                            display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 2,
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                          }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: msg.avatar_color }}>{msg.username}</span>
                            <TimeAgo date={msg.created_at} />
                          </div>
                        )}
                        <div style={{
                          padding: '8px 12px',
                          background: isOwn ? 'var(--blue)' : 'var(--bg1)',
                          color: isOwn ? '#1d2021' : 'var(--fg1)',
                          borderRadius: isOwn ? 'var(--r) var(--r-xs) var(--r) var(--r)' : 'var(--r-xs) var(--r) var(--r) var(--r)',
                          fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                        }}>
                          {plain === undefined ? (
                            <span style={{ display: 'flex', gap: 6, alignItems: 'center', color: isOwn ? '#1d202188' : 'var(--fg4)' }}>
                              <Spinner size={12}/> decrypting…
                            </span>
                          ) : plain}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typingFrom && (
                  <div style={{ padding: '4px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ display: 'flex', gap: 3 }}>
                      {[0,1,2].map(i => (
                        <span key={i} style={{
                          width: 5, height: 5, borderRadius: '50%', background: 'var(--fg4)',
                          display: 'inline-block', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite`,
                        }}/>
                      ))}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--fg4)', fontStyle: 'italic' }}>{typingFrom} is typing…</span>
                  </div>
                )}
                <div ref={bottomRef} style={{ height: 4 }}/>
              </div>

              <MessageInput
                placeholder={`Message ${activeConv.username} (encrypted)`}
                onSend={sendDM}
                onTyping={handleTyping}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
