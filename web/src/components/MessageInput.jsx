import { useState, useRef, useEffect } from 'react';

const EMOJI_SHORTCUTS = ['👍','❤️','😂','🔥','✨','💯','🎉','👀','🤔','😮'];

export function MessageInput({ onSend, onTyping, placeholder, replyTo, onCancelReply, disabled }) {
  const [text, setText]       = useState('');
  const [showEmoji, setEmoji] = useState(false);
  const textareaRef           = useRef(null);
  const typingTimerRef        = useRef(null);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const handleChange = (e) => {
    setText(e.target.value);
    if (onTyping) {
      clearTimeout(typingTimerRef.current);
      onTyping();
      typingTimerRef.current = setTimeout(() => {}, 3000);
    }
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; }
  };

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
    const ta = textareaRef.current;
    if (ta) ta.style.height = 'auto';
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Escape' && replyTo) onCancelReply?.();
  };

  return (
    <div style={{ padding: '0 16px 16px', position: 'relative' }}>
      {/* Reply preview */}
      {replyTo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', marginBottom: 0,
          background: 'var(--bg1)', borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
          borderLeft: '3px solid var(--blue)', fontSize: 12, color: 'var(--fg3)',
        }}>
          <span style={{ flex: 1 }}>
            Replying to <strong style={{ color: 'var(--blue-b)' }}>{replyTo.username}</strong>:&nbsp;
            <span style={{ color: 'var(--fg3)' }}>
              {replyTo.content?.slice(0, 60)}{replyTo.content?.length > 60 ? '…' : ''}
            </span>
          </span>
          <button onClick={onCancelReply} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg4)', fontSize: 16,
          }}>×</button>
        </div>
      )}

      {/* Input box — single style prop, no duplicate */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        background: 'var(--bg1)', border: '1px solid var(--bg2)',
        borderRadius: replyTo ? '0 0 var(--r) var(--r)' : 'var(--r)',
        padding: '8px 12px', transition: 'border-color .18s',
      }}>
        {/* Emoji picker toggle */}
        <button onClick={() => setEmoji(v => !v)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--fg4)', fontSize: 18, padding: '2px', flexShrink: 0,
          transition: 'color .15s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--yellow-b)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--fg4)'}
        >😊</button>

        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={disabled ? 'No permission to send messages' : placeholder || 'Send a message…'}
          value={text}
          onChange={handleChange}
          onKeyDown={onKey}
          disabled={disabled}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--fg)', fontSize: 14.5, resize: 'none',
            fontFamily: "'Inter', sans-serif", lineHeight: 1.5,
            maxHeight: 180, overflow: 'auto',
          }}
        />

        <button onClick={submit} disabled={!text.trim() || disabled} style={{
          background: text.trim() && !disabled ? 'var(--blue)' : 'var(--bg2)',
          border: 'none', borderRadius: 'var(--r-sm)', padding: '5px 10px',
          cursor: text.trim() && !disabled ? 'pointer' : 'default',
          color: text.trim() && !disabled ? '#1d2021' : 'var(--fg4)',
          fontWeight: 700, fontSize: 14, flexShrink: 0, transition: 'all .15s',
        }}>↑</button>
      </div>

      {/* Emoji quick-picker */}
      {showEmoji && (
        <div style={{
          position: 'absolute', bottom: 76, left: 16,
          background: 'var(--bg0-soft)', border: '1px solid var(--glass-border)',
          borderRadius: 'var(--r)', padding: 8,
          display: 'flex', flexWrap: 'wrap', gap: 4,
          boxShadow: 'var(--sh)', zIndex: 50, width: 220,
        }}>
          {EMOJI_SHORTCUTS.map(e => (
            <button key={e} onClick={() => { setText(t => t + e); setEmoji(false); textareaRef.current?.focus(); }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 22, borderRadius: 'var(--r-sm)', padding: 4,
              transition: 'background .15s',
            }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg1)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
            >{e}</button>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--fg4)', marginTop: 4, paddingLeft: 2 }}>
        <kbd style={{ fontSize:10, padding:'1px 4px', background:'var(--bg1)', borderRadius:3, border:'1px solid var(--bg3)' }}>Enter</kbd> to send ·&nbsp;
        <kbd style={{ fontSize:10, padding:'1px 4px', background:'var(--bg1)', borderRadius:3, border:'1px solid var(--bg3)' }}>Shift+Enter</kbd> newline
      </div>
    </div>
  );
}
