export function LinkPreviewCard({ preview }) {
  if (!preview) return null;
  return (
    <a href={preview.url} target="_blank" rel="noopener noreferrer" style={{
      display:'block', marginTop:8, textDecoration:'none',
      background:'var(--bg1)', border:'1px solid var(--bg2)',
      borderLeft:'4px solid var(--blue)',
      borderRadius:'var(--r-sm)', overflow:'hidden',
      maxWidth:440, transition:'border-color .18s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderLeftColor='var(--blue-b)'}
      onMouseLeave={e => e.currentTarget.style.borderLeftColor='var(--blue)'}
    >
      <div style={{ display:'flex', gap:0 }}>
        {preview.image && (
          <img
            src={preview.image} alt=""
            style={{ width:80, height:80, objectFit:'cover', flexShrink:0 }}
            onError={e => e.target.style.display='none'}
          />
        )}
        <div style={{ padding:'8px 12px', minWidth:0 }}>
          <div style={{ fontSize:11, color:'var(--fg4)', marginBottom:3, fontFamily:"'JetBrains Mono',monospace" }}>
            {preview.siteName}
          </div>
          <div style={{ fontWeight:700, fontSize:13, color:'var(--fg)', marginBottom:3,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {preview.title}
          </div>
          {preview.description && (
            <div style={{ fontSize:12, color:'var(--fg3)', lineHeight:1.4,
              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
              {preview.description}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
