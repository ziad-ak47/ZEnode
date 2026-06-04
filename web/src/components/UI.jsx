// Avatar
export function Avatar({ username, color, size = 36, shape = 'circle' }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: shape === 'rounded' ? size * 0.3 : '50%',
      background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.38, color: '#1d2021',
      flexShrink: 0, userSelect: 'none',
      boxShadow: `0 0 0 2px ${color}30`,
    }}>
      {username?.[0]?.toUpperCase()}
    </div>
  );
}

// Online dot
export function OnlineDot({ online, size = 10 }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size, borderRadius: '50%',
      background: online ? 'var(--green-b)' : 'var(--bg3)',
      boxShadow: online ? `0 0 6px var(--green-b)` : 'none',
      flexShrink: 0,
    }} />
  );
}

// Spinner
export function Spinner({ size = 18 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid var(--bg2)`, borderTopColor: 'var(--blue)',
      animation: 'spin .7s linear infinite', display: 'inline-block',
    }} />
  );
}

// TimeAgo
export function TimeAgo({ date, full = false }) {
  const d    = new Date(date);
  const diff = Date.now() - d.getTime();
  const s    = Math.floor(diff / 1000);
  const m    = Math.floor(s / 60);
  const h    = Math.floor(m / 60);
  const day  = Math.floor(h / 24);

  const short =
    day > 6  ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) :
    day > 0  ? `${day}d` :
    h > 0    ? `${h}h` :
    m > 0    ? `${m}m` : 'now';

  const long = d.toLocaleString('en', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <span title={long} style={{
      color: 'var(--fg4)', fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {full ? long : short}
    </span>
  );
}

// Tooltip wrapper
export function Tip({ label, children }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={e => {
        const tip = e.currentTarget.querySelector('.tooltip');
        if (tip) tip.style.opacity = '1';
      }}
      onMouseLeave={e => {
        const tip = e.currentTarget.querySelector('.tooltip');
        if (tip) tip.style.opacity = '0';
      }}
    >
      {children}
      <span className="tooltip" style={{
        position: 'absolute', left: '110%', top: '50%',
        transform: 'translateY(-50%)',
        background: 'var(--bg1)', color: 'var(--fg1)',
        padding: '4px 8px', borderRadius: 'var(--r-sm)',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        pointerEvents: 'none', opacity: 0,
        transition: 'opacity .15s', zIndex: 999,
        boxShadow: 'var(--sh)',
      }}>
        {label}
      </span>
    </div>
  );
}

// Kbd shortcut badge
export function Kbd({ children }) {
  return (
    <kbd style={{
      display: 'inline-block', padding: '1px 5px',
      background: 'var(--bg1)', border: '1px solid var(--bg3)',
      borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
      color: 'var(--fg3)',
    }}>{children}</kbd>
  );
}

// Badge (unread count)
export function Badge({ count }) {
  if (!count || count < 1) return null;
  return (
    <span style={{
      minWidth: 18, height: 18, borderRadius: 9,
      background: 'var(--red-b)', color: '#fff',
      fontSize: 11, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 4px',
    }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

// Section divider
export function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
      {label && <span style={{ fontSize: 11, color: 'var(--fg4)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
    </div>
  );
}

// Modal backdrop + box
export function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;
  return (
    <div className="fade-in" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="fade-up" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: width,
        background: 'var(--bg0-soft)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-lg)',
        padding: '24px',
        position: 'relative',
      }}>
        {/* Top shimmer */}
        <div style={{
          position:'absolute',top:0,left:0,right:0,height:1,
          background:'linear-gradient(90deg,transparent,rgba(235,219,178,.1),transparent)',
          borderRadius:'var(--r-lg) var(--r-lg) 0 0',
        }}/>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ fontSize:17, fontWeight:700 }}>{title}</h2>
          <button onClick={onClose} style={{
            background:'none',border:'none',cursor:'pointer',
            color:'var(--fg4)',fontSize:22,lineHeight:1,borderRadius:'var(--r-sm)',padding:'2px 6px',
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Input
export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--fg2)', marginBottom:5 }}>{label}</label>}
      <input {...props} style={{
        width:'100%', background:'var(--bg1)', border:'1px solid var(--bg2)',
        borderRadius:'var(--r)', padding:'9px 12px', color:'var(--fg)', fontSize:14,
        outline:'none', transition:'border-color .18s',
        ...(props.style||{}),
      }}
        onFocus={e => e.target.style.borderColor='var(--blue)'}
        onBlur={e => e.target.style.borderColor='var(--bg2)'}
      />
    </div>
  );
}

// PrimaryButton
export function Btn({ children, variant='primary', disabled, onClick, style={} }) {
  const bg = variant==='danger'  ? 'var(--red)'
           : variant==='ghost'   ? 'transparent'
           : variant==='outline' ? 'transparent'
           : 'var(--blue)';
  const color = variant==='ghost'||variant==='outline' ? 'var(--fg2)' : '#1d2021';
  const border = variant==='outline' ? '1px solid var(--bg3)' : '1px solid transparent';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:'8px 18px', borderRadius:'var(--r)', border,
      background:disabled?'var(--bg1)':bg,
      color:disabled?'var(--fg4)':color,
      fontWeight:700, fontSize:14, cursor:disabled?'not-allowed':'pointer',
      opacity:disabled?0.6:1, transition:'all .18s',
      ...style,
    }}
      onMouseEnter={e=>{ if(!disabled&&variant!=='ghost') e.currentTarget.style.filter='brightness(1.15)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.filter=''; }}
    >
      {children}
    </button>
  );
}
