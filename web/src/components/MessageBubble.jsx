import { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, TimeAgo } from './UI.jsx';
import { MarkdownContent } from './MarkdownContent.jsx';
import { LinkPreviewCard } from './LinkPreviewCard.jsx';
import {
  ReplyIcon, CopyIcon, EmojiIcon, ForwardIcon,
  PinIcon, StarIcon, EditIcon, TrashIcon,
} from './Icons.jsx';

// ── Emoji Reaction Pill ────────────────────────────────────────
function ReactionPill({ emoji, count, users, isOurs, onToggle }) {
  return (
    <button onClick={onToggle} title={users} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12,
      background: isOurs ? 'rgba(69,133,136,.18)' : 'var(--bg1)',
      border: `1px solid ${isOurs ? 'var(--blue)' : 'var(--bg2)'}`,
      cursor: 'pointer', fontSize: 13, color: 'var(--fg2)',
      transition: 'all .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = isOurs ? 'var(--blue)' : 'var(--bg2)'}
    >
      <span>{emoji}</span>
      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{count}</span>
    </button>
  );
}

// ── Context Menu ───────────────────────────────────────────────
const REACTIONS = ['👍','❤️','😂','🔥','✨','👀','😮','🎉'];

function ContextMenu({ x, y, msg, isOwn, bookmarked, onClose,
                       onReply, onReact, onForward, onPin,
                       onBookmark, onCopy, onEdit, onDelete }) {

  const ref = useRef(null);

  // Close on outside click or Escape
  useEffect(() => {
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const menuW = 220;
  const menuH = isOwn ? 370 : 290;
  const left  = x + menuW > window.innerWidth  ? x - menuW : x;
  const top   = y + menuH > window.innerHeight ? y - menuH : y;

  const Item = ({ icon, label, onClick, danger }) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 14px', background: 'none', border: 'none',
        cursor: 'pointer', textAlign: 'left',
        color: danger ? 'var(--red-b)' : 'var(--fg1)',
        fontSize: 14, borderRadius: 'var(--r-sm)',
        transition: 'background .12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? 'rgba(204,36,29,.14)' : 'var(--bg2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{
        width: 22, height: 22, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
        color: danger ? 'var(--red-b)' : 'var(--fg3)',
      }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );

  const Divider = () => (
    <div style={{ height: 1, background: 'var(--glass-border)', margin: '3px 8px' }} />
  );

  return (
    <div
      ref={ref}
      className="fade-up"
      style={{
        position: 'fixed', left, top, zIndex: 1000,
        width: menuW,
        background: 'var(--bg0-soft)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r-md)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(235,219,178,0.06) inset',
        padding: '6px 4px',
        userSelect: 'none',
      }}
    >
      {/* Quick emoji reactions row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: '6px 10px 8px', gap: 2,
      }}>
        {REACTIONS.map(e => (
          <button
            key={e}
            onClick={() => { onReact(msg.id, e); onClose(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, borderRadius: 8, padding: '3px 4px',
              transition: 'transform .12s, background .12s',
              lineHeight: 1,
            }}
            onMouseEnter={ev => {
              ev.currentTarget.style.transform = 'scale(1.3)';
              ev.currentTarget.style.background = 'var(--bg2)';
            }}
            onMouseLeave={ev => {
              ev.currentTarget.style.transform = 'scale(1)';
              ev.currentTarget.style.background = 'none';
            }}
          >{e}</button>
        ))}
      </div>

      <Divider />

      {/* Actions */}
      <Item icon={<ReplyIcon size={15} />}   label="Reply"                        onClick={() => onReply(msg)} />
      <Item icon={<CopyIcon  size={15} />}   label="Copy"                         onClick={() => { navigator.clipboard.writeText(msg.content).catch(() => {}); }} />
      <Item icon={<EmojiIcon size={15} />}   label="React"                        onClick={() => {}} />
      <Item icon={<ForwardIcon size={15} />} label="Forward"                      onClick={onForward} />
      <Item icon={<PinIcon   size={15} />}   label={msg.pinned ? 'Unpin' : 'Pin'} onClick={() => onPin(msg.id)} />

      <Divider />

      <Item
        icon={<StarIcon size={15} filled={bookmarked} />}
        label={bookmarked ? 'Remove Bookmark' : 'Star'}
        onClick={() => onBookmark(msg.id)}
      />

      {isOwn && <Item icon={<EditIcon  size={15} />} label="Edit"   onClick={() => onEdit()} />}
      {isOwn && (
        <>
          <Divider />
          <Item icon={<TrashIcon size={15} />} label="Delete" onClick={() => onDelete(msg.id)} danger />
        </>
      )}
    </div>
  );
}

// ── Main MessageBubble ─────────────────────────────────────────
export function MessageBubble({
  msg, currentUser, onReact, onReply, onEdit, onDelete,
  onPin, onBookmark, compact = false,
}) {
  const [hovering, setHovering]     = useState(false);
  const [editing, setEditing]       = useState(false);
  const [editText, setEditText]     = useState(msg.content);
  const [animPop, setAnimPop]       = useState('');
  const [bookmarked, setBookmarked] = useState(msg.bookmarked || false);
  const [menu, setMenu]             = useState(null); // {x, y}

  const isOwn     = currentUser?.id === msg.user_id;
  const isDeleted = msg.deleted;

  // Build reaction map
  const reactions = {};
  if (Array.isArray(msg.reactions)) {
    msg.reactions.forEach(r => {
      if (!r?.emoji) return;
      if (!reactions[r.emoji]) reactions[r.emoji] = { count: 0, users: [], isOurs: false };
      reactions[r.emoji].count++;
      reactions[r.emoji].users.push(r.username || '');
      if (r.user_id === currentUser?.id) reactions[r.emoji].isOurs = true;
    });
  }

  const handleReact = useCallback((id, emoji) => {
    setAnimPop(emoji);
    setTimeout(() => setAnimPop(''), 400);
    onReact(id, emoji);
  }, [onReact]);

  const handleBookmark = useCallback((id) => {
    setBookmarked(v => !v);
    onBookmark?.(id);
  }, [onBookmark]);

  const handleForward = useCallback(() => {
    navigator.clipboard.writeText(msg.content).catch(() => {});
  }, [msg.content]);

  const handleContextMenu = (e) => {
    if (isDeleted || editing) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const submitEdit = () => {
    if (!editText.trim()) return;
    onEdit(msg.id, editText.trim());
    setEditing(false);
  };

  return (
    <>
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex', gap: 10,
          padding: compact ? '2px 16px' : '6px 16px',
          position: 'relative',
          background: menu
            ? 'rgba(69,133,136,.05)'
            : hovering
              ? 'rgba(235,219,178,.025)'
              : 'transparent',
          transition: 'background .1s',
          cursor: 'default',
        }}
      >
        {/* Avatar / compact spacer */}
        {!compact ? (
          <Avatar username={msg.username} color={msg.avatar_color} size={36} />
        ) : (
          <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: 2 }}>
            {hovering && <TimeAgo date={msg.created_at} />}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          {!compact && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: msg.avatar_color }}>
                {msg.username}
              </span>
              <TimeAgo date={msg.created_at} />
              {msg.edited  && <span style={{ fontSize: 10, color: 'var(--fg4)' }}>(edited)</span>}
              {msg.pinned  && <span style={{ fontSize: 10, color: 'var(--yellow-b)' }}>📌 pinned</span>}
              {bookmarked  && <span style={{ fontSize: 10, color: 'var(--yellow-b)' }}>🔖</span>}
            </div>
          )}

          {/* Reply snippet */}
          {msg.reply_snippet && (
            <div style={{
              borderLeft: '3px solid var(--bg3)', paddingLeft: 8, marginBottom: 4,
              fontSize: 12, color: 'var(--fg4)',
            }}>
              <strong style={{ color: 'var(--fg3)' }}>{msg.reply_snippet.username}: </strong>
              {msg.reply_snippet.content?.slice(0, 80)}
              {msg.reply_snippet.content?.length > 80 ? '…' : ''}
            </div>
          )}

          {/* Content */}
          {isDeleted ? (
            <p style={{ fontSize: 14, color: 'var(--fg4)', fontStyle: 'italic' }}>
              [message deleted]
            </p>
          ) : editing ? (
            <div>
              <textarea
                autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(); }
                  if (e.key === 'Escape') setEditing(false);
                }}
                rows={2}
                style={{
                  width: '100%', background: 'var(--bg1)',
                  border: '1px solid var(--blue)', borderRadius: 'var(--r-sm)',
                  padding: '6px 8px', color: 'var(--fg)', fontSize: 14,
                  resize: 'none', outline: 'none', fontFamily: "'Inter',sans-serif",
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 12 }}>
                <button onClick={submitEdit} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--green-b)',fontWeight:700 }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--fg4)' }}>Cancel</button>
                <span style={{ color:'var(--fg4)' }}>· Enter to save · Esc to cancel</span>
              </div>
            </div>
          ) : (
            <>
              <MarkdownContent text={msg.content} />
              {msg.link_preview && <LinkPreviewCard preview={msg.link_preview} />}
            </>
          )}

          {/* Reactions */}
          {Object.keys(reactions).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {Object.entries(reactions).map(([emoji, { count, users, isOurs }]) => (
                <ReactionPill
                  key={emoji} emoji={emoji} count={count}
                  users={users.join(', ')} isOurs={isOurs}
                  onToggle={() => handleReact(msg.id, emoji)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Subtle right-click hint on hover (non-deleted, non-editing) */}
        {hovering && !isDeleted && !editing && !menu && (
          <div style={{
            position: 'absolute', right: 14, top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11, color: 'var(--fg4)',
            pointerEvents: 'none',
            fontFamily: "'JetBrains Mono',monospace",
            opacity: 0.5,
          }}>
            right-click
          </div>
        )}
      </div>

      {/* Context menu rendered outside the message div */}
      {menu && (
        <ContextMenu
          x={menu.x} y={menu.y}
          msg={msg}
          isOwn={isOwn}
          bookmarked={bookmarked}
          onClose={() => setMenu(null)}
          onReply={onReply}
          onReact={handleReact}
          onForward={handleForward}
          onPin={onPin}
          onBookmark={handleBookmark}
          onCopy={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
          onEdit={() => { setEditing(true); setEditText(msg.content); }}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
