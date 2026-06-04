# ZEnode

A full-stack real-time communication platform.

## Features
- **Auth** — register/login (bcrypt + JWT access + refresh tokens)
- **Communities** — invite-code based servers with groups, channels
- **Standalone Groups** — groups without a community, with invite codes
- **Real-time chat** — WebSocket: messages, typing, reactions, edit, delete, pin, bookmark
- **Markdown** — bold, code blocks, lists, syntax highlighting
- **Link previews** — server-side OG metadata fetch
- **Posts** — social feed with public / friends / chosen visibility
- **Friends** — send/accept/decline requests, real-time notifications
- **E2E DMs** — ECDH P-256 + AES-256-GCM, friends-only, server never sees plaintext
- **Browser notifications** — when tab is inactive
- **Gruvbox dark theme** — liquid glass UI

## Setup

### 1. Run schema in Supabase SQL Editor (Run WITHOUT RLS)
```
api/schema.sql
```

### 2. Start the API
```bash
cd api
npm install
cp .env.example .env
# Fill DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
node index.js
```

### 3. Start the web app
```bash
cd web
npm install
npm run dev
# Open http://localhost:5173
```

### 4. Run tests
```bash
cd api && npm test
# 99 passed, 1 skipped, 0 failed
```

## Navigation
| Icon | Page | What it does |
|------|------|-------------|
| 💬 | Communities | Discord-style servers with channels |
| 👥 | Groups | Standalone groups, no community needed |
| 📝 | Posts | Social feed with visibility controls |
| 🤝 | Friends | Add/remove friends, accept requests |
| 🔒 | DMs | End-to-end encrypted direct messages (friends only) |
