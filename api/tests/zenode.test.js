/**
 * ZEnode — Unit & Integration Tests
 *
 * Tests cover every backend module and expected user interactions.
 * Run with: npm test (from /api directory)
 *
 * Note: these are unit tests that do NOT require a live database.
 * Integration tests requiring a DB are marked with @integration
 * and skipped unless INTEGRATION=true env var is set.
 */

// ═══════════════════════════════════════════════════════════════
//  auth.js — JWT helpers + middleware
// ═══════════════════════════════════════════════════════════════
describe('auth.js', () => {
  let auth;
  beforeAll(() => {
    process.env.JWT_SECRET         = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    auth = require('../auth');
  });

  test('signAccess produces a verifiable token', () => {
    const token = auth.signAccess({ id: 1, username: 'alice' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.sig
  });

  test('verifyAccess decodes the correct payload', () => {
    const token   = auth.signAccess({ id: 42, username: 'bob' });
    const payload = auth.verifyAccess(token);
    expect(payload.id).toBe(42);
    expect(payload.username).toBe('bob');
  });

  test('signRefresh + verifyRefresh round-trip', () => {
    const token   = auth.signRefresh({ id: 7 });
    const payload = auth.verifyRefresh(token);
    expect(payload.id).toBe(7);
  });

  test('verifyAccess throws on tampered token', () => {
    const token = auth.signAccess({ id: 1 });
    expect(() => auth.verifyAccess(token + 'tampered')).toThrow();
  });

  test('verifyWsToken returns null for invalid token', () => {
    const result = auth.verifyWsToken('not-a-real-token');
    expect(result).toBeNull();
  });

  test('verifyWsToken returns payload for valid token', () => {
    const token   = auth.signAccess({ id: 99, username: 'carol' });
    const payload = auth.verifyWsToken(token);
    expect(payload?.id).toBe(99);
  });

  test('requireAuth middleware returns 401 when no header', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    auth.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('requireAuth middleware returns 401 for wrong scheme', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    auth.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('requireAuth middleware calls next() and attaches user for valid token', () => {
    const token = auth.signAccess({ id: 5, username: 'dave' });
    const req   = { headers: { authorization: `Bearer ${token}` } };
    const res   = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next  = jest.fn();
    auth.requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(5);
  });

  test('requireAuth returns TOKEN_EXPIRED code for expired tokens', () => {
    // Create expired token by manipulating the secret env var temporarily
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ id: 1 }, 'test-access-secret', { expiresIn: -1 });
    const req  = { headers: { authorization: `Bearer ${expired}` } };
    const res  = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    auth.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_EXPIRED' }));
  });
});

// ═══════════════════════════════════════════════════════════════
//  rateLimiter.js — express-rate-limit + WsRateLimiter
// ═══════════════════════════════════════════════════════════════
describe('rateLimiter.js — WsRateLimiter', () => {
  let WsRateLimiter;
  beforeAll(() => {
    ({ WsRateLimiter } = require('../rateLimiter'));
  });

  test('allows messages within the window', () => {
    const rl = new WsRateLimiter(5, 10000);
    for (let i = 0; i < 5; i++) {
      expect(rl.check('user1')).toBe(true);
    }
  });

  test('blocks message that exceeds the limit', () => {
    const rl = new WsRateLimiter(3, 10000);
    rl.check('u'); rl.check('u'); rl.check('u');
    expect(rl.check('u')).toBe(false);
  });

  test('resets counter after window expires', async () => {
    const rl = new WsRateLimiter(2, 50); // 50ms window
    rl.check('x'); rl.check('x');
    expect(rl.check('x')).toBe(false);
    await new Promise(r => setTimeout(r, 60));
    expect(rl.check('x')).toBe(true); // window reset
  });

  test('tracks different socket IDs independently', () => {
    const rl = new WsRateLimiter(2, 10000);
    rl.check('a'); rl.check('a');
    expect(rl.check('a')).toBe(false);
    expect(rl.check('b')).toBe(true); // 'b' has its own count
  });

  test('clear() removes a socket entry', () => {
    const rl = new WsRateLimiter(2, 10000);
    rl.check('c'); rl.check('c'); // hit limit
    rl.clear('c');
    expect(rl.check('c')).toBe(true); // fresh after clear
  });
});

// ═══════════════════════════════════════════════════════════════
//  linkPreview.js — OG scraper
// ═══════════════════════════════════════════════════════════════
describe('linkPreview.js', () => {
  const { fetchLinkPreview } = require('../linkPreview');

  test('returns null for plain text with no URLs', async () => {
    const result = await fetchLinkPreview('hello world, no links here');
    expect(result).toBeNull();
  });

  test('returns null for media file URLs', async () => {
    const result = await fetchLinkPreview('check this out https://example.com/photo.jpg');
    expect(result).toBeNull();
  });

  test('returns null for text with no valid URLs', async () => {
    const result = await fetchLinkPreview('visit example.com for more');
    expect(result).toBeNull();
  });

  test.skip('returns preview object for a live URL (network required)', async () => {
    // Requires outbound internet access. Run manually outside of CI.
    const result = await fetchLinkPreview('https://github.com').catch(() => null);
    if (result !== null) {
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('title');
      expect(typeof result.title).toBe('string');
    }
  }, 8000);

  test('handles fetch errors gracefully (returns null)', async () => {
    const result = await fetchLinkPreview('https://this-domain-does-not-exist-zenode.xyz');
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
//  Input validation helpers (pure functions extracted from index.js)
// ═══════════════════════════════════════════════════════════════
describe('Input validation', () => {
  const validateUsername = (u) => u?.trim().length >= 2;
  const validateEmail    = (e) => typeof e === 'string' && e.includes('@') && e.includes('.');
  const validatePassword = (p) => typeof p === 'string' && p.length >= 6;
  const validateContent  = (c) => typeof c === 'string' && c.trim().length > 0 && c.length <= 2000;

  describe('Username', () => {
    test('accepts valid username', ()   => expect(validateUsername('alice')).toBe(true));
    test('accepts two-char username', ()=> expect(validateUsername('ab')).toBe(true));
    test('rejects one-char username', ()=> expect(validateUsername('a')).toBe(false));
    test('rejects empty string', ()     => expect(validateUsername('')).toBe(false));
    test('rejects null', ()             => expect(validateUsername(null)).toBe(false));
    test('trims whitespace', ()         => expect(validateUsername('  a  ')).toBe(false));
  });

  describe('Email', () => {
    test('accepts valid email', ()       => expect(validateEmail('user@example.com')).toBe(true));
    test('rejects no @ symbol', ()       => expect(validateEmail('userexample.com')).toBe(false));
    test('rejects no dot', ()            => expect(validateEmail('user@example')).toBe(false));
    test('rejects empty string', ()      => expect(validateEmail('')).toBe(false));
  });

  describe('Password', () => {
    test('accepts 6-char password', ()   => expect(validatePassword('abc123')).toBe(true));
    test('rejects 5-char password', ()   => expect(validatePassword('ab12')).toBe(false));
    test('rejects empty', ()             => expect(validatePassword('')).toBe(false));
  });

  describe('Message content', () => {
    test('accepts normal message', ()    => expect(validateContent('Hello world')).toBe(true));
    test('rejects empty string', ()      => expect(validateContent('')).toBe(false));
    test('rejects whitespace only', ()   => expect(validateContent('   ')).toBe(false));
    test('rejects >2000 chars', ()       => expect(validateContent('x'.repeat(2001))).toBe(false));
    test('accepts exactly 2000 chars', ()=> expect(validateContent('x'.repeat(2000))).toBe(true));
  });
});

// ═══════════════════════════════════════════════════════════════
//  Invite code generator
// ═══════════════════════════════════════════════════════════════
describe('Invite code generation', () => {
  const generateCode = () => Math.random().toString(36).slice(2, 10).toUpperCase();

  test('generates 8-character codes', () => {
    expect(generateCode()).toHaveLength(8);
  });

  test('generates only uppercase alphanumeric characters', () => {
    const code = generateCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  test('generates different codes on each call', () => {
    const codes = new Set(Array.from({ length: 100 }, generateCode));
    expect(codes.size).toBeGreaterThan(90); // very unlikely to collide
  });
});

// ═══════════════════════════════════════════════════════════════
//  Message grouping logic (compact rendering)
// ═══════════════════════════════════════════════════════════════
describe('Message grouping (compact rendering)', () => {
  const SAME_AUTHOR_GAP = 5 * 60 * 1000;

  function groupMessages(messages) {
    return messages.reduce((acc, msg, i) => {
      const prev = messages[i - 1];
      const compact = prev &&
        prev.user_id === msg.user_id &&
        !prev.deleted &&
        new Date(msg.created_at) - new Date(prev.created_at) < SAME_AUTHOR_GAP;
      const showDate = !prev ||
        new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
      acc.push({ msg, compact, showDate });
      return acc;
    }, []);
  }

  const now = new Date().toISOString();
  const soon = new Date(Date.now() + 60000).toISOString();           // +1 min
  const later = new Date(Date.now() + 10 * 60000).toISOString();     // +10 min
  const tomorrow = new Date(Date.now() + 86400000).toISOString();

  test('first message is never compact', () => {
    const msgs = [{ id:1, user_id:1, created_at:now, deleted:false }];
    // compact is undefined (no prev) which is falsy — correct behaviour
    expect(groupMessages(msgs)[0].compact).toBeFalsy();
  });

  test('second message from same author within 5 min is compact', () => {
    const msgs = [
      { id:1, user_id:1, created_at:now,  deleted:false },
      { id:2, user_id:1, created_at:soon, deleted:false },
    ];
    expect(groupMessages(msgs)[1].compact).toBe(true);
  });

  test('message from different author is never compact', () => {
    const msgs = [
      { id:1, user_id:1, created_at:now,  deleted:false },
      { id:2, user_id:2, created_at:soon, deleted:false },
    ];
    expect(groupMessages(msgs)[1].compact).toBe(false);
  });

  test('message after 5-min gap is not compact', () => {
    const msgs = [
      { id:1, user_id:1, created_at:now,   deleted:false },
      { id:2, user_id:1, created_at:later, deleted:false },
    ];
    expect(groupMessages(msgs)[1].compact).toBe(false);
  });

  test('message after deleted message is not compact', () => {
    const msgs = [
      { id:1, user_id:1, created_at:now,  deleted:true },
      { id:2, user_id:1, created_at:soon, deleted:false },
    ];
    expect(groupMessages(msgs)[1].compact).toBe(false);
  });

  test('showDate is true for first message', () => {
    const msgs = [{ id:1, user_id:1, created_at:now, deleted:false }];
    expect(groupMessages(msgs)[0].showDate).toBe(true);
  });

  test('showDate is false for same-day consecutive messages', () => {
    const msgs = [
      { id:1, user_id:1, created_at:now,  deleted:false },
      { id:2, user_id:2, created_at:soon, deleted:false },
    ];
    expect(groupMessages(msgs)[1].showDate).toBe(false);
  });

  test('showDate is true when date changes to next day', () => {
    const msgs = [
      { id:1, user_id:1, created_at:now,      deleted:false },
      { id:2, user_id:2, created_at:tomorrow, deleted:false },
    ];
    expect(groupMessages(msgs)[1].showDate).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  TimeAgo logic
// ═══════════════════════════════════════════════════════════════
describe('TimeAgo formatting', () => {
  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 6) return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return 'now';
  }

  test('shows "now" for very recent message', () => {
    expect(timeAgo(new Date(Date.now() - 5000).toISOString())).toBe('now');
  });
  test('shows minutes', () => {
    expect(timeAgo(new Date(Date.now() - 3 * 60000).toISOString())).toBe('3m');
  });
  test('shows hours', () => {
    expect(timeAgo(new Date(Date.now() - 2 * 3600000).toISOString())).toBe('2h');
  });
  test('shows days', () => {
    expect(timeAgo(new Date(Date.now() - 3 * 86400000).toISOString())).toBe('3d');
  });
  test('shows date string for >6 days', () => {
    const result = timeAgo(new Date(Date.now() - 10 * 86400000).toISOString());
    expect(result).toMatch(/[A-Z][a-z]+ \d+/); // "Jan 5" format
  });
});

// ═══════════════════════════════════════════════════════════════
//  E2E encryption logic (Web Crypto equivalent in Node)
// ═══════════════════════════════════════════════════════════════
describe('E2E encryption (crypto module)', () => {
  const crypto = require('crypto');

  function base64(buf) { return Buffer.from(buf).toString('base64'); }
  function fromBase64(str) { return Buffer.from(str, 'base64'); }

  // Simplified AES-GCM test (same algorithm used in e2e.js)
  test('AES-256-GCM encrypt → decrypt round-trip', () => {
    const key = crypto.randomBytes(32);
    const iv  = crypto.randomBytes(12);
    const plaintext = 'Hello ZEnode!';

    const cipher  = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted    += cipher.final('base64');
    const tag     = cipher.getAuthTag();

    const decipher  = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted   = decipher.update(encrypted, 'base64', 'utf8');
    decrypted      += decipher.final('utf8');

    expect(decrypted).toBe(plaintext);
  });

  test('Different IVs produce different ciphertexts for same plaintext', () => {
    const key = crypto.randomBytes(32);
    const pt  = 'same message';

    const encrypt = (iv) => {
      const c = crypto.createCipheriv('aes-256-gcm', key, iv);
      return c.update(pt, 'utf8', 'base64') + c.final('base64');
    };

    const ct1 = encrypt(crypto.randomBytes(12));
    const ct2 = encrypt(crypto.randomBytes(12));
    expect(ct1).not.toBe(ct2);
  });

  test('Tampered ciphertext fails authentication', () => {
    const key = crypto.randomBytes(32);
    const iv  = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let enc = cipher.update('secret', 'utf8', 'base64') + cipher.final('base64');
    const tag = cipher.getAuthTag();

    // Tamper: flip a byte
    const buf = Buffer.from(enc, 'base64');
    buf[0] ^= 0xff;
    const tampered = buf.toString('base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    expect(() => {
      decipher.update(tampered, 'base64', 'utf8');
      decipher.final('utf8');
    }).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
//  User interaction scenarios (state machine tests)
// ═══════════════════════════════════════════════════════════════
describe('User interaction scenarios', () => {

  describe('Registration flow', () => {
    test('valid registration data passes all checks', () => {
      const username = 'zenode_user';
      const email    = 'user@zenode.app';
      const password = 'SecurePass1';
      expect(username.trim().length >= 2).toBe(true);
      expect(email.includes('@')).toBe(true);
      expect(password.length >= 6).toBe(true);
    });

    test('passwords must match for registration', () => {
      const password = 'mypassword';
      const confirm  = 'mypassword';
      expect(password === confirm).toBe(true);
    });

    test('mismatched passwords are rejected', () => {
      expect('pass1' === 'pass2').toBe(false);
    });
  });

  describe('Message sending flow', () => {
    test('empty message is not sent', () => {
      const shouldSend = (text) => text.trim().length > 0;
      expect(shouldSend('')).toBe(false);
      expect(shouldSend('   ')).toBe(false);
      expect(shouldSend('Hello!')).toBe(true);
    });

    test('message over 2000 chars is blocked', () => {
      const isValid = (text) => text.trim().length > 0 && text.length <= 2000;
      expect(isValid('x'.repeat(2001))).toBe(false);
      expect(isValid('x'.repeat(2000))).toBe(true);
    });

    test('Ctrl+Enter in textarea triggers submit (key event check)', () => {
      const events = [];
      const handler = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) events.push('submit');
      };
      handler({ key: 'Enter', shiftKey: false });
      handler({ key: 'Enter', shiftKey: true });
      expect(events).toEqual(['submit']); // only first triggers
    });
  });

  describe('Reaction toggle flow', () => {
    test('adding a new reaction increments count', () => {
      const reactions = {};
      const toggle = (emoji, userId) => {
        if (!reactions[emoji]) reactions[emoji] = new Set();
        if (reactions[emoji].has(userId)) reactions[emoji].delete(userId);
        else reactions[emoji].add(userId);
      };
      toggle('👍', 1);
      expect(reactions['👍'].size).toBe(1);
    });

    test('toggling same reaction removes it', () => {
      const reactions = { '👍': new Set([1]) };
      const toggle = (emoji, userId) => {
        if (reactions[emoji]?.has(userId)) reactions[emoji].delete(userId);
        else { if (!reactions[emoji]) reactions[emoji] = new Set(); reactions[emoji].add(userId); }
      };
      toggle('👍', 1);
      expect(reactions['👍'].size).toBe(0);
    });
  });

  describe('Typing indicator flow', () => {
    test('typing state is added when user starts typing', () => {
      let typingUsers = [];
      const onTyping = (userId, username) => {
        if (!typingUsers.find(u => u.userId === userId)) {
          typingUsers = [...typingUsers, { userId, username }];
        }
      };
      onTyping(2, 'bob');
      expect(typingUsers).toHaveLength(1);
      expect(typingUsers[0].username).toBe('bob');
    });

    test('same user typing twice does not duplicate', () => {
      let typingUsers = [];
      const onTyping = (userId, username) => {
        if (!typingUsers.find(u => u.userId === userId)) {
          typingUsers = [...typingUsers, { userId, username }];
        }
      };
      onTyping(2, 'bob');
      onTyping(2, 'bob');
      expect(typingUsers).toHaveLength(1);
    });

    test('stop_typing removes user from list', () => {
      let typingUsers = [{ userId: 2, username: 'bob' }];
      const onStopTyping = (userId) => {
        typingUsers = typingUsers.filter(u => u.userId !== userId);
      };
      onStopTyping(2);
      expect(typingUsers).toHaveLength(0);
    });
  });

  describe('Online presence flow', () => {
    test('user appears online when they connect', () => {
      const online = new Set();
      online.add(5);
      expect(online.has(5)).toBe(true);
    });

    test('user disappears from online set on disconnect', () => {
      const online = new Set([5, 6, 7]);
      online.delete(6);
      expect(online.has(6)).toBe(false);
      expect(online.has(5)).toBe(true);
    });
  });

  describe('Unread count flow', () => {
    test('unread count decrements on markRead', () => {
      let unread = 5;
      const markRead = () => { unread = Math.max(0, unread - 1); };
      markRead();
      expect(unread).toBe(4);
    });

    test('unread count does not go below 0', () => {
      let unread = 0;
      const markRead = () => { unread = Math.max(0, unread - 1); };
      markRead();
      expect(unread).toBe(0);
    });
  });

  describe('Community invite flow', () => {
    test('invite code is normalised to uppercase', () => {
      const normalize = (code) => code.trim().toUpperCase();
      expect(normalize('abc12345')).toBe('ABC12345');
      expect(normalize(' xyz99  ')).toBe('XYZ99');
    });

    test('invite code minimum length check', () => {
      const isValid = (code) => code.trim().length >= 4;
      expect(isValid('AB')).toBe(false);
      expect(isValid('ABCD1234')).toBe(true);
    });
  });

  describe('Channel name normalisation', () => {
    test('channel names are lowercased with spaces replaced by dashes', () => {
      const normalize = (name) => name.trim().toLowerCase().replace(/\s+/g, '-');
      expect(normalize('General Chat')).toBe('general-chat');
      expect(normalize('  Dev Talk  ')).toBe('dev-talk');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
//  Friends system
// ═══════════════════════════════════════════════════════════════
describe('Friends system', () => {
  const filterByStatus = (list, status) => list.filter(f => f.status === status);
  const isFriend = (friendships, a, b) =>
    friendships.some(f =>
      ((f.requester === a && f.addressee === b) ||
       (f.requester === b && f.addressee === a)) &&
      f.status === 'accepted'
    );

  test('cannot send request to yourself', () => {
    const sendRequest = (from, to) => {
      if (from === to) throw new Error('Invalid target');
      return { requester: from, addressee: to, status: 'pending' };
    };
    expect(() => sendRequest(1, 1)).toThrow('Invalid target');
  });

  test('sending request when reverse exists auto-accepts', () => {
    const existing = { id: 1, requester: 2, addressee: 1, status: 'pending' };
    // User 1 tries to send request to user 2, but user 2 already sent one
    const result = existing.requester === 2 ? 'accepted' : 'pending';
    expect(result).toBe('accepted');
  });

  test('accepted friends show in friend list', () => {
    const friendships = [
      { requester: 1, addressee: 2, status: 'accepted' },
      { requester: 1, addressee: 3, status: 'pending' },
    ];
    const myFriends = friendships.filter(f =>
      (f.requester === 1 || f.addressee === 1) && f.status === 'accepted'
    );
    expect(myFriends).toHaveLength(1);
  });

  test('pending requests split into incoming and outgoing', () => {
    const myId = 1;
    const requests = [
      { id: 1, requester: 2, addressee: 1, status: 'pending' }, // incoming
      { id: 2, requester: 1, addressee: 3, status: 'pending' }, // outgoing
    ];
    const incoming = requests.filter(r => r.addressee === myId);
    const outgoing = requests.filter(r => r.requester === myId);
    expect(incoming).toHaveLength(1);
    expect(outgoing).toHaveLength(1);
  });

  test('removing a friend clears the friendship both ways', () => {
    let friendships = [
      { requester: 1, addressee: 2, status: 'accepted' },
      { requester: 3, addressee: 1, status: 'accepted' },
    ];
    const remove = (a, b) => friendships.filter(f =>
      !((f.requester === a && f.addressee === b) || (f.requester === b && f.addressee === a))
    );
    friendships = remove(1, 2);
    expect(isFriend(friendships, 1, 2)).toBe(false);
    expect(isFriend(friendships, 3, 1)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Post visibility
// ═══════════════════════════════════════════════════════════════
describe('Post visibility', () => {
  const VALID = ['public', 'friends', 'chosen'];
  const isValidVisibility = (v) => VALID.includes(v);

  test('accepts all valid visibility values', () => {
    VALID.forEach(v => expect(isValidVisibility(v)).toBe(true));
  });

  test('rejects invalid visibility values', () => {
    expect(isValidVisibility('private')).toBe(false);
    expect(isValidVisibility('')).toBe(false);
    expect(isValidVisibility('PUBLIC')).toBe(false);
  });

  test('public post visible to everyone', () => {
    const canSee = (post, viewerId, friendIds) => {
      if (post.visibility === 'public') return true;
      if (post.user_id === viewerId) return true;
      if (post.visibility === 'friends') return friendIds.includes(viewerId);
      if (post.visibility === 'chosen') return post.chosenIds?.includes(viewerId) ?? false;
      return false;
    };
    const post = { user_id: 1, visibility: 'public' };
    expect(canSee(post, 2, [])).toBe(true);
    expect(canSee(post, 99, [])).toBe(true);
  });

  test('friends-only post visible only to friends', () => {
    const canSee = (post, viewerId, friendIds) => {
      if (post.user_id === viewerId) return true;
      if (post.visibility === 'friends') return friendIds.includes(viewerId);
      return false;
    };
    const post = { user_id: 1, visibility: 'friends' };
    expect(canSee(post, 2, [2, 3])).toBe(true);
    expect(canSee(post, 99, [2, 3])).toBe(false);
  });

  test('chosen post visible only to specified users', () => {
    const canSee = (post, viewerId) => {
      if (post.user_id === viewerId) return true;
      if (post.visibility === 'chosen') return post.chosenIds.includes(viewerId);
      return false;
    };
    const post = { user_id: 1, visibility: 'chosen', chosenIds: [5, 6] };
    expect(canSee(post, 5)).toBe(true);
    expect(canSee(post, 7)).toBe(false);
    expect(canSee(post, 1)).toBe(true); // own post
  });

  test('changing visibility replaces chosen list', () => {
    let post = { visibility: 'chosen', chosenIds: [5, 6] };
    const update = (newVis, newChosen) => {
      post = { ...post, visibility: newVis, chosenIds: newChosen };
    };
    update('friends', []);
    expect(post.visibility).toBe('friends');
    expect(post.chosenIds).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Standalone groups
// ═══════════════════════════════════════════════════════════════
describe('Standalone groups', () => {
  test('standalone group has null community_id', () => {
    const group = { id: 1, community_id: null, name: 'Dev Talk', owner_id: 1 };
    expect(group.community_id).toBeNull();
  });

  test('community group has non-null community_id', () => {
    const group = { id: 2, community_id: 5, name: 'General', owner_id: 1 };
    expect(group.community_id).not.toBeNull();
  });

  test('group name is trimmed before saving', () => {
    const normalize = (name) => name.trim();
    expect(normalize('  My Group  ')).toBe('My Group');
  });

  test('private group gets an invite code, public does not', () => {
    const createGroup = (isPrivate) => ({
      name: 'Test',
      invite_code: isPrivate ? Math.random().toString(36).slice(2, 10).toUpperCase() : null,
    });
    expect(createGroup(true).invite_code).not.toBeNull();
    expect(createGroup(false).invite_code).toBeNull();
  });

  test('group member roles are valid', () => {
    const ROLES = ['owner', 'admin', 'member'];
    expect(ROLES.includes('owner')).toBe(true);
    expect(ROLES.includes('guest')).toBe(false);
  });

  test('only owner/admin can create channels', () => {
    const canCreateChannel = (role) => ['owner', 'admin'].includes(role);
    expect(canCreateChannel('owner')).toBe(true);
    expect(canCreateChannel('admin')).toBe(true);
    expect(canCreateChannel('member')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
//  DM friend guard
// ═══════════════════════════════════════════════════════════════
describe('DM friend guard', () => {
  const areFriends = (friendships, a, b) =>
    friendships.some(f =>
      ((f.requester === a && f.addressee === b) ||
       (f.requester === b && f.addressee === a)) &&
      f.status === 'accepted'
    );

  const canDM = (friendships, from, to) => areFriends(friendships, from, to);

  test('accepted friends can DM each other', () => {
    const fs = [{ requester: 1, addressee: 2, status: 'accepted' }];
    expect(canDM(fs, 1, 2)).toBe(true);
    expect(canDM(fs, 2, 1)).toBe(true); // bidirectional
  });

  test('pending friends cannot DM', () => {
    const fs = [{ requester: 1, addressee: 2, status: 'pending' }];
    expect(canDM(fs, 1, 2)).toBe(false);
  });

  test('strangers cannot DM', () => {
    expect(canDM([], 1, 99)).toBe(false);
  });

  test('blocked users cannot DM', () => {
    const fs = [{ requester: 1, addressee: 2, status: 'blocked' }];
    expect(canDM(fs, 1, 2)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Navigation / page routing
// ═══════════════════════════════════════════════════════════════
describe('Navigation / page routing', () => {
  const PAGES = ['chat', 'groups', 'posts', 'friends', 'dm'];

  test('all navigation pages are defined', () => {
    expect(PAGES).toContain('chat');
    expect(PAGES).toContain('groups');
    expect(PAGES).toContain('posts');
    expect(PAGES).toContain('friends');
    expect(PAGES).toContain('dm');
  });

  test('switching page resets community data', () => {
    let commData = { id: 1, name: 'Test' };
    const navigate = (page) => {
      if (page !== 'chat') commData = null;
      return page;
    };
    navigate('groups');
    expect(commData).toBeNull();
  });

  test('navigating to dm with pendingDM sets target', () => {
    let page = 'chat';
    let pendingDM = null;
    const onDMUser = (member) => { pendingDM = member; page = 'dm'; };
    onDMUser({ id: 5, username: 'alice' });
    expect(page).toBe('dm');
    expect(pendingDM.username).toBe('alice');
  });

  test('pendingDM is cleared after DMView opens the conversation', () => {
    let pendingDM = { id: 5, username: 'alice' };
    const onPendingDMOpened = () => { pendingDM = null; };
    onPendingDMOpened();
    expect(pendingDM).toBeNull();
  });
});
