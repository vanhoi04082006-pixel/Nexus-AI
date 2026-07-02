# 💬 NEXUS Chat Service

Standalone **Socket.io** real-time chat mini-service cho NEXUS AI app.

## 📑 Mục lục

- [Overview](#-overview)
- [Run](#-run)
- [How the frontend connects](#-how-the-frontend-connects)
- [Room model](#-room-model)
- [Protocol](#-protocol)
- [Token verification](#-token-verification)
- [Multi-tab support](#-multi-tab-support)
- [Graceful shutdown](#-graceful-shutdown)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

| Property | Value |
|---|---|
| **Port** | `3001` (hardcoded — Caddy gateway forward dựa trên `XTransformPort` query param) |
| **Runtime** | [Bun](https://bun.sh) với `bun --hot` (auto-reload) |
| **Module system** | ESM (`"type": "module"`) |
| **Library** | `socket.io` v4 |
| **Path** | `/` (KHÔNG đổi — Caddy dùng path để forward) |

Chat service là **optional** — nếu không chạy, frontend tự fallback sang HTTP polling 3s (chậm hơn nhưng vẫn nhận được tin nhắn).

---

## 🚀 Run

### Development

```bash
cd mini-services/chat-service
bun install
bun run dev
```

Output:
```
[2024-07-01T10:00:00.000Z] NEXUS chat service listening on port 3001
[2024-07-01T10:00:00.000Z] Frontend should connect with: io("/?XTransformPort=3001")
```

Dev script dùng `bun --hot index.ts` → auto-restart khi file thay đổi.

### Production

```bash
cd mini-services/chat-service
bun install --production
bun run start
# hoặc: bun index.ts
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port to listen on (Fly.io override) |
| `NEXT_APP_URL` | `http://localhost:3000` | Next.js API URL (for token verification) |

---

## 🔌 How the frontend connects

Next.js app sits behind a **Caddy gateway** that only exposes one external port.

> ⚠️ **KHÔNG** connect trực tiếp đến `http://localhost:3001`. Để gateway forward request bằng cách putting port trong `XTransformPort` query parameter và giữ path là `/`:

```typescript
import { io } from 'socket.io-client'

// ✅ Correct — qua Caddy gateway
const socket = io('/?XTransformPort=3001', {
  transports: ['websocket', 'polling'],
})

// ❌ Wrong — không work qua gateway
const socket = io('http://localhost:3001')
```

### Caddyfile config

```
:81 {
  @transform_port_query {
    query XTransformPort=*
  }
  handle @transform_port_query {
    reverse_proxy localhost:{query.XTransformPort}
  }
  handle {
    reverse_proxy localhost:3000
  }
}
```

### Production (Fly.io)

Nếu deploy lên Fly.io, set `NEXT_PUBLIC_CHAT_URL` env var:

```bash
# .env
NEXT_PUBLIC_CHAT_URL=https://chat.yourdomain.com
```

Frontend sẽ connect trực tiếp (không qua gateway):

```typescript
const socket = ioFn(chatServiceUrl, { transports: ['websocket', 'polling'] })
```

---

## 🏠 Room model

Mỗi project maps to một room tên `project:<projectId>`. Tất cả chat events scoped trong room.

```
Project A (projectId: "abc123") → Room: "project:abc123"
  ├─ User 1 (leader) → joins room
  ├─ User 2 (member) → joins room
  └─ User 3 (member) → joins room

Project B (projectId: "xyz789") → Room: "project:xyz789"
  └─ (separate room)
```

Users có thể join nhiều room (nhiều tab nhiều project), nhưng mỗi socket chỉ thuộc 1 project per session.

---

## 📡 Protocol

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join` | `{ projectId, name, role, token }` | Join `project:<projectId>` room. **Token required** — verify via HTTP before allowing join. |
| `send_message` | `{ projectId, name, role, message }` | Broadcast a chat message to everyone in the room (sender adds optimistically on client). |
| `typing` | `{ projectId, name }` | Notify others that user is typing. |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `user_joined` | `{ projectId, name, role, socketId, timestamp }` | A user joined the room (sent to everyone including newcomer). |
| `message` | `{ name, role, message, timestamp }` | A chat message — sent to everyone in the room **EXCEPT sender** (sender adds optimistically). |
| `typing` | `{ projectId, name, timestamp }` | Someone is typing (excludes the typist). |
| `user_left` | `{ projectId, name, role, socketId, timestamp }` | A user left the room (only if no other tab open). |
| `error` | `{ message }` | Malformed event payload / token invalid. |

### Example flow

```
Client A                          Server                          Client B
   │                                │                                │
   │── join { projectId, token }───>│                                │
   │                                │── HTTP verify token ──────────>│ (Next.js API)
   │                                │<── 200 OK ─────────────────────│
   │                                │                                │
   │<── user_joined (A) ────────────│                                │
   │                                │── user_joined (A) ────────────>│
   │                                │                                │
   │── send_message "Hello" ───────>│                                │
   │                                │── message "Hello" ────────────>│
   │                                │                                │
   │── typing ──────────────────────>│                                │
   │                                │── typing ─────────────────────>│
   │                                │                                │
   │── disconnect ─────────────────>│                                │
   │                                │── user_left (A) ──────────────>│
```

---

## 🔐 Token verification

Khi client emit `join`, server verify token trước khi allow join:

```typescript
socket.on('join', async (payload: JoinPayload) => {
  const { projectId, name, role, token } = payload

  if (!token) {
    socket.emit('error', { message: 'Token required for chat access' })
    socket.disconnect()
    return
  }

  // Verify token against Next.js API
  const appUrl = process.env.NEXT_APP_URL || 'http://localhost:3000'
  try {
    const verifyResp = await fetch(`${appUrl}/api/projects/${projectId}?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'User-Agent': 'NEXUS-ChatService' },
      signal: AbortSignal.timeout(5000),
    })
    if (!verifyResp.ok) {
      socket.emit('error', { message: 'Token khong hop le — access denied' })
      socket.disconnect()
      return
    }
  } catch (err) {
    // Fail-open: if Next.js API is down, allow join (avoid blocking all chat)
    console.log(`[${ts()}] [join] Token verify failed (API down?), allowing: ${err}`)
  }

  // Join room
  const room = roomName(projectId)
  socket.join(room)
  // ...
})
```

### Token types

| Token | Source | Permissions |
|---|---|---|
| `leaderToken` | `Project.leaderToken` | Full chat access + leader badge |
| `inviteToken` | `Member.inviteToken` | Member chat access |

### Fail-open policy

Nếu Next.js API không respond (timeout/error), chat service **allow join** (fail-open) để tránh block toàn bộ chat khi API down. Log warning để debug.

---

## 🗂️ Multi-tab support

User mở nhiều tab cùng 1 project → nhiều sockets, cùng `name`.

### Problem

Khi 1 tab đóng → emit `user_left` → other users nghĩ user đã offline (sai).

### Solution

Khi disconnect, check nếu còn socket nào cùng `name` trong room:

```typescript
socket.on('disconnect', (reason: string) => {
  const session = sessions.get(socket.id)

  if (session) {
    for (const room of session.rooms) {
      // Check if any OTHER socket in this room has the same name
      let stillInRoom = false
      for (const [otherId, otherSession] of sessions) {
        if (otherId === socket.id) continue
        if (otherSession.name === session.name && otherSession.rooms.has(room)) {
          stillInRoom = true
          break
        }
      }

      // Only emit user_left if the user has no other tabs open
      if (!stillInRoom) {
        io.to(room).emit('user_left', { projectId, name, role, socketId, timestamp })
      }
    }
    sessions.delete(socket.id)
  }
})
```

→ User chỉ bị `user_left` khi đóng TẤT CẢ tab.

---

## 🛑 Graceful shutdown

Service handle `SIGTERM` + `SIGINT` (Fly.io deploy / Ctrl+C):

```typescript
process.on('SIGTERM', () => {
  console.log(`[${ts()}] SIGTERM received, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log(`[${ts()}] NEXUS chat service stopped`)
      process.exit(0)
    })
  })
})
```

→ Đóng tất cả socket connections cleanly → không mất tin nhắn.

---

## 🚢 Deployment

### Fly.io (production)

`fly.toml`:
```toml
[app]
  name = "nexus-chat-service"

[http_service]
  internal_port = 3001
  force_https = true

[env]
  NEXT_APP_URL = "https://nexus-ai.fly.dev"
```

Deploy:
```bash
cd mini-services/chat-service
fly deploy
```

Set `NEXT_PUBLIC_CHAT_URL` trên Next.js app:
```bash
fly secrets set NEXT_PUBLIC_CHAT_URL=https://nexus-chat-service.fly.dev
```

### Docker

```dockerfile
FROM oven/bun:1.2-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production
COPY . .
EXPOSE 3001
CMD ["bun", "index.ts"]
```

```bash
docker build -t nexus-chat .
docker run -p 3001:3001 -e NEXT_APP_URL=http://host.docker.internal:3000 nexus-chat
```

### PM2 (alternative)

```bash
pm2 start index.ts --name nexus-chat --interpreter bun
pm2 save
pm2 startup
```

---

## 🐛 Troubleshooting

### Chat không realtime

1. Check service running:
   ```bash
   curl http://localhost:3001
   # → {"code":0,"message":"Cannot GET /"} (OK — Socket.io không serve HTTP)
   ```
2. Check Caddy gateway forward:
   ```bash
   curl "http://localhost:81/?XTransformPort=3001"
   # → Same response
   ```
3. Frontend fallback sang polling 3s — check Network tab trong DevTools

### `Token khong hop le — access denied`

- Token sai / expired
- Next.js API không reachable (check `NEXT_APP_URL`)
- Project bị xóa

### `join requires { projectId, name }`

- Payload thiếu field
- Check frontend code: `socket.emit('join', { projectId, name, role, token })`

### Multi-tab: user_left spam

- Đảm bảo `sessions` Map tracking đúng
- Check `stillInRoom` logic không bị race condition

### Connection drops mỗi 25s

- `pingInterval: 25000` (mặc định Socket.io)
- Check network/firewall không block WebSocket
- Try fallback: `transports: ['polling']` (chậm hơn nhưng stable hơn)

### Memory leak

- Check `sessions` Map không delete socket khi disconnect
- Monitor: `sessions.size` trong log

---

## 📊 Metrics (optional)

Add Prometheus metrics (chưa implement):

```typescript
// TODO: add prom-client
// - connections_total
// - messages_total
// - rooms_active
// - token_verify_failures_total
```

---

## 🔗 Related

- [Main README](../../README.md)
- [Architecture](../../docs/ARCHITECTURE.md#real-time-socketio--polling)
- [API: Chat endpoints](../../docs/API.md#chat)

---

<p align="center">
  <strong>NEXUS Chat Service</strong> — Real-time Socket.io 💬
</p>
