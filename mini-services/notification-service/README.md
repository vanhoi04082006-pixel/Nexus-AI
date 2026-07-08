# 🔔 NEXUS AI — Notification Service

> Mini-service realtime notifications qua Socket.io. Chạy trên port **3002**.

---

## 🎯 Mục đích

Notification-service nhận notifications từ main app (HTTP POST) và broadcast realtime tới tất cả client đã subscribe project đó qua Socket.io.

## 🏗️ Architecture

```
Main App (Next.js, port 3000)
    │
    │ HTTP POST /broadcast
    ↓
Notification Service (port 3002)
    │
    │ Socket.io emit
    ↓
Browser clients (subscribed to project room)
```

## 🚀 Cách chạy

### Standalone
```bash
cd mini-services/notification-service
bun install
bun run index.ts
```

### Tự động (qua `run` command)
Khi chạy `run` (Windows) hoặc `bash scripts/run-local.sh` (Linux/Mac), main script tự khởi động notification-service ở background.

## 🔌 Socket.io Events

### Server → Client

| Event | Payload | Mô tả |
|---|---|---|
| `notification` | `{ id, projectId, type, title, message, senderName, ... }` | Notification mới |
| `connected` | `{ status: "ok" }` | Client đã kết nối |

### Client → Server

| Event | Payload | Mô tả |
|---|---|---|
| `subscribe` | `{ projectId, userEmail }` | Subscribe notifications cho 1 project |
| `unsubscribe` | `{ projectId }` | Hủy subscribe |

## 📡 HTTP Endpoints (internal)

| Method | Path | Body | Mô tả |
|---|---|---|---|
| `POST` | `/broadcast` | `{ projectId, notification }` | Broadcast notification tới project room |
| `GET` | `/health` | — | Health check |

## 🔧 Cấu hình

| Biến | Mặc định | Mô tả |
|---|---|---|
| `PORT` | `3002` | Port (hardcoded trong code) |
| `CORS_ORIGIN` | `*` | CORS origin |

## 🐳 Deploy

### Fly.io
```bash
fly deploy -c fly.toml
```

### Docker
```bash
docker build -f Dockerfile.notification -t nexus-notification .
docker run -p 3002:3002 nexus-notification
```

## 🔗 Tích hợp với main app

Main app gọi notification-service qua gateway Caddy:

```ts
// Main app (Next.js API route)
await fetch(`/api/notify?XTransformPort=3002`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ projectId, notification }),
});
```

Client (browser) kết nối Socket.io:
```ts
import { io } from "socket.io-client";
const socket = io("/?XTransformPort=3002");
socket.emit("subscribe", { projectId, userEmail: "user@example.com" });
socket.on("notification", (notif) => {
  // Show toast / update bell icon
});
```

## 📁 Files

```
mini-services/notification-service/
├── index.ts         # Socket.io server + HTTP endpoints
├── package.json     # Dependencies (socket.io)
└── README.md        # ← bạn đang ở đây
```

## 🐛 Troubleshooting

### Client không nhận notification
- Kiểm tra đã `subscribe` đúng `projectId`
- Kiểm tra Socket.io kết nối thành công (tab Network)
- Verify notification-service đang chạy: `curl http://localhost:3002/health`

### CORS error
- Code đã set `cors: { origin: "*" }` — nếu cần restrict, sửa trong `index.ts`

---

**License:** MIT · **Port:** 3002 · **Part of:** NEXUS AI v0.2.0
