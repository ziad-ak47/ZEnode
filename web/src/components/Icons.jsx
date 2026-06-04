/**
 * ZEnode Icon System
 * Geometric, minimal SVGs using stroke-based design.
 * All icons accept: size (number), color (string), strokeWidth (number)
 * Default color is "currentColor" so they inherit from CSS.
 */

const base = (size, children, viewBox = '0 0 24 24') => ({
  width: size, height: size,
  viewBox,
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  style: { flexShrink: 0, display: 'block' },
  children,
});

// ── Communities — hexagonal cluster ───────────────────────────
export function CommunitiesIcon({ size = 22, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)} fill="none">
      {/* Large centre hexagon */}
      <path
        d="M12 2.5 L18.5 6.25 L18.5 13.75 L12 17.5 L5.5 13.75 L5.5 6.25 Z"
        stroke={color} strokeWidth={sw} strokeLinejoin="round"
      />
      {/* Top-right satellite */}
      <path
        d="M18.5 6.25 L21.5 7.9 L21.5 11.2 L18.5 12.85 L15.5 11.2 L15.5 7.9 Z"
        stroke={color} strokeWidth={sw * 0.7} strokeLinejoin="round" opacity="0.5"
      />
      {/* Bottom satellite */}
      <path
        d="M8.5 14.5 L11 15.9 L11 18.6 L8.5 20 L6 18.6 L6 15.9 Z"
        stroke={color} strokeWidth={sw * 0.7} strokeLinejoin="round" opacity="0.5"
      />
      {/* Centre dot */}
      <circle cx="12" cy="10" r="1.4" fill={color} opacity="0.8" />
    </svg>
  );
}

// ── Groups — three overlapping person shapes ───────────────────
export function GroupsIcon({ size = 22, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      {/* Back-left person */}
      <circle cx="7.5" cy="7" r="2.5" stroke={color} strokeWidth={sw} opacity="0.5" />
      <path d="M2.5 19 C2.5 15.5 4.7 13 7.5 13" stroke={color} strokeWidth={sw} strokeLinecap="round" opacity="0.5" />
      {/* Back-right person */}
      <circle cx="16.5" cy="7" r="2.5" stroke={color} strokeWidth={sw} opacity="0.5" />
      <path d="M21.5 19 C21.5 15.5 19.3 13 16.5 13" stroke={color} strokeWidth={sw} strokeLinecap="round" opacity="0.5" />
      {/* Front-centre person */}
      <circle cx="12" cy="6.5" r="3" stroke={color} strokeWidth={sw} />
      <path d="M5.5 20 C5.5 16 8.4 13.5 12 13.5 C15.6 13.5 18.5 16 18.5 20"
        stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

// ── Posts — document with ruled lines ─────────────────────────
export function PostsIcon({ size = 22, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      {/* Document body */}
      <rect x="4" y="2" width="16" height="20" rx="2.5" stroke={color} strokeWidth={sw} />
      {/* Fold corner */}
      <path d="M14 2 L14 7 L20 7" stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      {/* Text lines */}
      <line x1="7.5" y1="11" x2="16.5" y2="11" stroke={color} strokeWidth={sw * 0.9} strokeLinecap="round" />
      <line x1="7.5" y1="14" x2="16.5" y2="14" stroke={color} strokeWidth={sw * 0.9} strokeLinecap="round" />
      <line x1="7.5" y1="17" x2="13"   y2="17" stroke={color} strokeWidth={sw * 0.9} strokeLinecap="round" />
    </svg>
  );
}

// ── Friends — two figures with a link arc ─────────────────────
export function FriendsIcon({ size = 22, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      {/* Left person */}
      <circle cx="7" cy="7" r="2.8" stroke={color} strokeWidth={sw} />
      <path d="M1.5 20 C1.5 16.5 3.9 14 7 14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Right person */}
      <circle cx="17" cy="7" r="2.8" stroke={color} strokeWidth={sw} />
      <path d="M22.5 20 C22.5 16.5 20.1 14 17 14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Heart between them */}
      <path d="M12 10.5 C12 10.5 10 8.5 10 7.5 C10 6.5 11 6 12 7 C13 6 14 6.5 14 7.5 C14 8.5 12 10.5 12 10.5Z"
        fill={color} opacity="0.9" />
    </svg>
  );
}

// ── DMs — chat bubble with padlock ────────────────────────────
export function DMsIcon({ size = 22, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      {/* Bubble */}
      <path d="M4 4 C4 2.9 4.9 2 6 2 L18 2 C19.1 2 20 2.9 20 4 L20 14 C20 15.1 19.1 16 18 16 L8 16 L4 20 L4 4 Z"
        stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      {/* Lock body */}
      <rect x="9.5" y="8.5" width="5" height="4" rx="1" stroke={color} strokeWidth={sw * 0.85} />
      {/* Lock shackle */}
      <path d="M10.5 8.5 L10.5 7 C10.5 6 11 5.5 12 5.5 C13 5.5 13.5 6 13.5 7 L13.5 8.5"
        stroke={color} strokeWidth={sw * 0.85} strokeLinecap="round" />
      {/* Keyhole dot */}
      <circle cx="12" cy="10.5" r="0.6" fill={color} />
    </svg>
  );
}

// ── Notifications — bell with accent dot ──────────────────────
export function BellIcon({ size = 22, color = 'currentColor', sw = 1.6, dot = false }) {
  return (
    <svg {...base(size, null)}>
      {/* Bell body */}
      <path d="M6 10 C6 7 8.7 4.5 12 4.5 C15.3 4.5 18 7 18 10 L18 16 L6 16 Z"
        stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      {/* Bell top stem */}
      <line x1="12" y1="2.5" x2="12" y2="4.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Clapper */}
      <path d="M10 16 C10 17.1 10.9 18 12 18 C13.1 18 14 17.1 14 16"
        stroke={color} strokeWidth={sw} strokeLinecap="round" />
      {/* Notification dot */}
      {dot && <circle cx="18" cy="5" r="3.5" fill="var(--red-b)" stroke="var(--bg0-hard)" strokeWidth="1.5" />}
    </svg>
  );
}

// ── Profile — person in circle ────────────────────────────────
export function ProfileIcon({ size = 22, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={sw} />
      <circle cx="12" cy="9.5" r="3"  stroke={color} strokeWidth={sw} />
      <path d="M5.5 19.5 C6.5 16.5 9 14.5 12 14.5 C15 14.5 17.5 16.5 18.5 19.5"
        stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

// ── Search ────────────────────────────────────────────────────
export function SearchIcon({ size = 16, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <circle cx="10" cy="10" r="6.5" stroke={color} strokeWidth={sw} />
      <line x1="15" y1="15" x2="21" y2="21" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

// ── Send arrow ────────────────────────────────────────────────
export function SendIcon({ size = 18, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <path d="M22 2 L11 13" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2 L15 22 L11 13 L2 9 Z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
  );
}

// ── Reply ────────────────────────────────────────────────────
export function ReplyIcon({ size = 16, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <path d="M9 14 L3 8 L9 2" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8 L13 8 C17.4 8 21 11.6 21 16 L21 22"
        stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Pin ──────────────────────────────────────────────────────
export function PinIcon({ size = 16, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <path d="M12 2 L16 6 L14 10 L18 14 L12 22 L6 14 L10 10 L8 6 Z"
        stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      <line x1="12" y1="10" x2="12" y2="14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

// ── Star / Bookmark ──────────────────────────────────────────
export function StarIcon({ size = 16, color = 'currentColor', sw = 1.6, filled = false }) {
  return (
    <svg {...base(size, null)}>
      <path d="M12 2 L14.9 8.6 L22 9.5 L17 14.3 L18.2 21.3 L12 18 L5.8 21.3 L7 14.3 L2 9.5 L9.1 8.6 Z"
        stroke={color} strokeWidth={sw} strokeLinejoin="round"
        fill={filled ? color : 'none'} />
    </svg>
  );
}

// ── Edit / Pencil ────────────────────────────────────────────
export function EditIcon({ size = 16, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <path d="M11 4 L20 4 L20 20 L4 20 L4 9" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 17 L3 21 L3 17 Z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M7 17 L16 8 L20 12 L11 21" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Trash / Delete ───────────────────────────────────────────
export function TrashIcon({ size = 16, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <line x1="3" y1="6" x2="21" y2="6"  stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <path d="M8 6 L8 4 C8 3 8.9 2 10 2 L14 2 C15.1 2 16 3 16 4 L16 6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <path d="M19 6 L18 21 C18 21.6 17.4 22 16.8 22 L7.2 22 C6.6 22 6 21.6 6 21 L5 6"
        stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

// ── Copy ────────────────────────────────────────────────────
export function CopyIcon({ size = 16, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <rect x="9" y="9" width="13" height="13" rx="2" stroke={color} strokeWidth={sw} />
      <path d="M5 15 L3 15 C1.9 15 1 14.1 1 13 L1 3 C1 1.9 1.9 1 3 1 L13 1 C14.1 1 15 1.9 15 3 L15 5"
        stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

// ── Forward ─────────────────────────────────────────────────
export function ForwardIcon({ size = 16, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <path d="M15 10 L21 6 L15 2 L15 6 C9 6 5 10 4 16 C7 13 10 11 15 11 Z"
        stroke={color} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
  );
}

// ── Emoji / React ────────────────────────────────────────────
export function EmojiIcon({ size = 16, color = 'currentColor', sw = 1.6 }) {
  return (
    <svg {...base(size, null)}>
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth={sw} />
      <circle cx="9"  cy="10" r="1"   fill={color} />
      <circle cx="15" cy="10" r="1"   fill={color} />
      <path d="M8.5 14.5 C9.5 16.5 14.5 16.5 15.5 14.5"
        stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}
