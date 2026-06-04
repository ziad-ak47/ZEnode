// ZEnode logo — Node.js-style hexagon with ZE inside
// Used in LoginPage, Navbar, CommunitySidebar
export function ZEnodeLogo({ size = 40, showText = false, textSize = 20 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg
        width={size} height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="lg-hex" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#458588"/>
            <stop offset="100%" stopColor="#b16286"/>
          </linearGradient>
          <linearGradient id="lg-txt" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#ebdbb2"/>
            <stop offset="100%" stopColor="#d5c4a1"/>
          </linearGradient>
        </defs>
        {/* Outer hex */}
        <path
          d="M32 3 L56 16.5 L56 47.5 L32 61 L8 47.5 L8 16.5 Z"
          fill="url(#lg-hex)"
          stroke="#83a598"
          strokeWidth="1.5"
        />
        {/* Inner ring */}
        <path
          d="M32 8 L52 19.5 L52 44.5 L32 56 L12 44.5 L12 19.5 Z"
          fill="none"
          stroke="rgba(235,219,178,0.10)"
          strokeWidth="1"
        />
        {/* ZE */}
        <text
          x="32" y="40"
          textAnchor="middle"
          fontFamily="'Inter','JetBrains Mono',monospace"
          fontWeight="900"
          fontSize="22"
          letterSpacing="-1"
          fill="url(#lg-txt)"
        >ZE</text>
      </svg>

      {showText && (
        <span style={{
          fontWeight: 800,
          fontSize: textSize,
          letterSpacing: '-0.5px',
          background: 'linear-gradient(135deg, #83a598, #d3869b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          ZEnode
        </span>
      )}
    </div>
  );
}
