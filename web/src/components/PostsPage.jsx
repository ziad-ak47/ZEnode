import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/index.js';
import { Avatar, TimeAgo, Spinner, Badge } from './UI.jsx';
import { MarkdownContent } from './MarkdownContent.jsx';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';

const VISIBILITY_ICONS = { public: '🌐', friends: '👥', chosen: '🔒' };
const VISIBILITY_LABELS = { public: 'Public', friends: 'Friends', chosen: 'Chosen friends' };

function PostCard({ post: init, currentUser, onDelete }) {
  const [post, setPost]             = useState(init);
  const [showVis, setShowVis]       = useState(false);
  const [liking, setLiking]         = useState(false);
  const [animHeart, setAnimHeart]   = useState(false);

  const toggleLike = async () => {
    if (liking) return;
    setLiking(true); setAnimHeart(true);
    setTimeout(() => setAnimHeart(false), 400);
    try {
      const data = await api.likePost(post.id);
      setPost(p => ({ ...p, like_count: data.like_count, liked: data.liked }));
    } catch (e) { console.error(e); }
    finally { setLiking(false); }
  };

  const changeVis = async (vis) => {
    try {
      await api.updatePostVisibility(post.id, vis, []);
      setPost(p => ({ ...p, visibility: vis }));
    } catch (e) { console.error(e); }
    setShowVis(false);
  };

  const isOwn = post.user_id === currentUser.id;

  return (
    <article className="fade-up" style={{
      background: 'var(--glass)',
      backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--r-lg)', padding: '16px 18px', marginBottom: 12,
      boxShadow: 'var(--sh)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(235,219,178,.07),transparent)' }} />

      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
        <Avatar username={post.username} color={post.avatar_color} size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{post.username}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <TimeAgo date={post.created_at} />
            {/* Visibility badge */}
            <span style={{
              fontSize: 11, color: 'var(--fg4)',
              background: 'var(--bg1)', borderRadius: 10, padding: '1px 6px',
              border: '1px solid var(--bg2)',
            }}>
              {VISIBILITY_ICONS[post.visibility]} {VISIBILITY_LABELS[post.visibility]}
            </span>
          </div>
        </div>
        {isOwn && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowVis(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--fg4)', fontSize: 14, padding: '2px 6px', borderRadius: 'var(--r-sm)',
            }}>⋯</button>
            {showVis && (
              <div className="fade-in" style={{
                position: 'absolute', right: 0, top: 24, zIndex: 10,
                background: 'var(--bg0-soft)', border: '1px solid var(--glass-border)',
                borderRadius: 'var(--r-sm)', boxShadow: 'var(--sh)', minWidth: 150,
                overflow: 'hidden',
              }}>
                {Object.entries(VISIBILITY_ICONS).map(([vis, icon]) => (
                  <button key={vis} onClick={() => changeVis(vis)} style={{
                    display: 'block', width: '100%', padding: '8px 14px',
                    background: vis === post.visibility ? 'var(--bg1)' : 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    color: vis === post.visibility ? 'var(--fg)' : 'var(--fg2)',
                    fontSize: 13,
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg1)'}
                    onMouseLeave={e => e.currentTarget.style.background = vis === post.visibility ? 'var(--bg1)' : 'none'}
                  >
                    {icon} {VISIBILITY_LABELS[vis]}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--glass-border)' }}>
                  <button onClick={() => { onDelete(post.id); setShowVis(false); }} style={{
                    display: 'block', width: '100%', padding: '8px 14px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', color: 'var(--red-b)', fontSize: 13,
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(204,36,29,.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >🗑 Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ marginLeft: 48, marginBottom: 10 }}>
        <MarkdownContent text={post.content} />
      </div>

      {/* Actions */}
      <div style={{
        marginLeft: 44, display: 'flex', gap: 4,
        paddingTop: 10, borderTop: '1px solid var(--glass-border)',
      }}>
        <button onClick={toggleLike} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: post.liked ? 'rgba(204,36,29,.1)' : 'none',
          border: `1px solid ${post.liked ? 'rgba(251,73,52,.2)' : 'transparent'}`,
          borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
          color: post.liked ? 'var(--red-b)' : 'var(--fg3)',
          fontSize: 13, fontWeight: 600, transition: 'all .18s',
        }}>
          <span style={{ animation: animHeart ? 'pop .4s ease' : 'none', display: 'inline-block', fontSize: 15 }}>
            {post.liked ? '♥' : '♡'}
          </span>
          {post.like_count > 0 && post.like_count}
        </button>
      </div>
    </article>
  );
}

function ComposePost({ currentUser, onPost }) {
  const [text, setText]       = useState('');
  const [vis, setVis]         = useState('public');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const p = await api.createPost({ content: text.trim(), visibility: vis });
      onPost(p);
      setText(''); setFocused(false);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
      border: `1px solid ${focused ? 'rgba(69,133,136,.4)' : 'var(--glass-border)'}`,
      borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 16,
      boxShadow: 'var(--sh)', transition: 'border-color .2s',
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Avatar username={currentUser.username} color={currentUser.avatar_color} size={38} />
        <div style={{ flex: 1 }}>
          <textarea
            rows={focused ? 4 : 2}
            placeholder="What's on your mind? Supports **markdown**"
            value={text}
            onChange={e => setText(e.target.value.slice(0, 500))}
            onFocus={() => setFocused(true)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submit(); }}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--fg)', fontSize: 14.5, resize: 'none',
              fontFamily: "'Inter',sans-serif", lineHeight: 1.6,
            }}
          />
          {focused && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--glass-border)',
            }}>
              {/* Visibility selector */}
              <div style={{ display: 'flex', gap: 4 }}>
                {Object.entries(VISIBILITY_ICONS).map(([v, icon]) => (
                  <button key={v} onClick={() => setVis(v)} style={{
                    padding: '4px 10px', borderRadius: 12,
                    border: `1px solid ${vis === v ? 'var(--blue)' : 'var(--bg2)'}`,
                    background: vis === v ? 'rgba(69,133,136,.15)' : 'var(--bg1)',
                    color: vis === v ? 'var(--blue-b)' : 'var(--fg3)',
                    fontSize: 12, cursor: 'pointer', fontWeight: vis === v ? 700 : 400,
                  }}>
                    {icon} {VISIBILITY_LABELS[v]}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: text.length > 450 ? 'var(--red-b)' : 'var(--fg4)' }}>
                  {text.length}/500
                </span>
                <button onClick={submit} disabled={!text.trim() || loading} style={{
                  padding: '6px 18px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: !text.trim() || loading ? 'var(--bg2)' : 'var(--blue)',
                  color: !text.trim() || loading ? 'var(--fg4)' : '#1d2021',
                  fontWeight: 700, fontSize: 13, cursor: !text.trim() || loading ? 'not-allowed' : 'pointer',
                }}>
                  {loading ? '…' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PostsPage({ currentUser, showToast }) {
  const [posts, setPosts]     = useState([]);
  const [cursor, setCursor]   = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const fetchingRef           = useRef(false);

  const loadMore = useCallback(async (cur) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const data = await api.getPosts(cur);
      setPosts(prev => cur ? [...prev, ...data.posts] : data.posts);
      setCursor(data.hasMore ? data.posts.at(-1)?.id : null);
      setHasMore(data.hasMore);
    } catch (e) { showToast(e.message, 'error'); }
    finally { fetchingRef.current = false; setLoading(false); }
  }, []);

  useEffect(() => { loadMore(null); }, []);

  const sentinelRef = useInfiniteScroll(
    () => { if (hasMore && cursor && !loading) loadMore(cursor); },
    hasMore && !loading
  );

  const onPost = (p) => setPosts(prev => [p, ...prev]);
  const onDelete = async (id) => {
    try {
      await api.deletePost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (e) { showToast(e.message, 'error'); }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <h2 style={{ fontWeight: 800, fontSize: 20, marginBottom: 16, color: 'var(--fg)' }}>
          📝 Posts
        </h2>

        <ComposePost currentUser={currentUser} onPost={onPost} />

        {posts.map(p => (
          <PostCard key={p.id} post={p} currentUser={currentUser} onDelete={onDelete} />
        ))}

        {posts.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg4)', fontSize: 14 }}>
            No posts yet. Be the first to post!
          </div>
        )}

        <div ref={sentinelRef} style={{ height: 40, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {loading && <Spinner />}
          {!hasMore && posts.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--fg4)' }}>— end of feed —</span>
          )}
        </div>
      </div>
    </div>
  );
}
