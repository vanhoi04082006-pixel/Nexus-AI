# 🏠 Chạy NEXUS AI Local + Cloudflare Tunnel

> FREE, không cần thẻ tín dụng, không cần deploy. Chạy từ máy bạn, có URL public cho thành viên truy cập từ bất kỳ đâu.

## 📑 Mục lục

- [Cách hoạt động](#-cách-hoạt-động)
- [Yêu cầu](#-yêu-cầu)
- [Cài đặt nhanh](#-cài-đặt-nhanh)
- [Cấu hình `.env`](#️-cấu-hình-env)
- [Script tự động làm gì?](#-script-tự-động-làm-gì)
- [Chạy thủ công (không tunnel)](#-chạy-thủ-công-không-tunnel)
- [Cloudflare Tunnel thủ công](#-cloudflare-tunnel-thủ-công)
- [Email link](#️-email-link)
- [Chat Service (Socket.io)](#-chat-service-socketio)
- [Lưu ý](#-lưu-ý)
- [Troubleshooting](#-troubleshooting)
- [Docker](#-docker)

---

## 🔄 Cách hoạt động

```
┌─────────────────────────────────────────────────────────┐
│  Máy bạn (Next.js + SQLite + Socket.io)                 │
│  ├─ http://localhost:3000  (Next.js app)                │
│  └─ http://localhost:3001  (Socket.io chat service)     │
└─────────────────────────────────────────────────────────┘
              ↓ Cloudflare Tunnel (FREE)
┌─────────────────────────────────────────────────────────┐
│  URL public: https://xxx.trycloudflare.com              │
│  ├─ /                  → Next.js                        │
│  └─ /?XTransformPort=3001 → Socket.io                   │
└─────────────────────────────────────────────────────────┘
              ↓ Thành viên truy cập
┌─────────────────────────────────────────────────────────┐
│  Browser thành viên (mở qua link email)                 │
└─────────────────────────────────────────────────────────┘
```

**Tại sao lại dùng Cloudflare Tunnel?**
- FREE, không cần thẻ tín dụng
- Không cần mở port router
- HTTPS tự động
- URL public thay đổi mỗi lần chạy (đủ cho demo/dev)

---

## ✅ Yêu cầu

| Tool | Version | Cài |
|---|---|---|
| [Bun](https://bun.sh) | v1+ | `curl -fsSL https://bun.sh/install \| bash` (macOS/Linux) hoặc `powershell -c "irm bun.sh/install.ps1 \| iex"` (Windows) |
| [Node.js](https://nodejs.org) | v18+ | Cần cho Prisma CLI |
| [OpenRouter API key](https://openrouter.ai/keys) | free | Multi-key rotation (thêm nhiều key để nhanh hơn) |
| [GitHub OAuth App](https://github.com/settings/developers) | tùy chọn | Cho push GitHub |
| Gmail App Password | tùy chọn | Cho email SMTP (lời mời + task assigned) |
| [cloudflared](https://github.com/cloudflare/cloudflared/releases) | auto-download | Script tự tải nếu chưa có |

---

## 🚀 Cài đặt nhanh

### Windows

```cmd
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
copy .env.example .env
:: Mở .env điền API keys
scripts\run-local.bat
```

### macOS / Linux

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
cp .env.example .env
# Mở .env điền API keys
bash scripts/run-local.sh
```

### PowerShell (Windows)

```powershell
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
copy .env.example .env
# Mở .env điền API keys
.\scripts\run-local.ps1
```

Script chạy xong sẽ hiện:

```
========================================================

   NEXUS AI DANG CHAY

      Local:  http://localhost:3000
      Public: https://random-name.trycloudflare.com

      Da cap nhat .public-url
      Email se dung URL nay.

      Chia se URL public cho thanh vien:
      https://random-name.trycloudflare.com

      Nhan Ctrl+C de dung.

========================================================
```

---

## ⚙️ Cấu hình `.env`

```env
# ===== Database (SQLite) =====
DATABASE_URL=file:./db/custom.db

# ===== OpenRouter API (multi-key rotation) =====
# Hỗ trợ không giới hạn số key — tự luân chuyển khi 1 key bị 429
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
OPENROUTER_API_KEY_2=sk-or-v1-xxxxxxxxxxxxx
OPENROUTER_API_KEY_3=sk-or-v1-xxxxxxxxxxxxx
# OPENROUTER_API_KEY_4=sk-or-v1-xxxxxxxxxxxxx
# ... thêm bao nhiêu cũng được

# ===== GitHub OAuth App (tùy chọn) =====
GITHUB_CLIENT_ID=Ov23xxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ===== App URL =====
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

### Tạo GitHub OAuth App

1. Vào https://github.com/settings/developers → **"New OAuth App"**
2. Điền:
   - **Application name**: `NEXUS AI (local)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/github/callback`
3. Sau khi tạo → **"Generate a new client secret"**
4. Copy `Client ID` + `Client Secret` → paste vào `.env`

### Tạo Gmail App Password

1. Vào https://myaccount.google.com → bật **2-Step Verification**
2. Vào https://myaccount.google.com/apppasswords
3. Chọn app "Mail" → tạo → copy 16 ký tự password
4. Dán vào form "Khởi tạo Dự Án" (field "App Password SMTP")

---

## 📋 Script tự động làm gì?

`run-local.bat` / `run-local.sh` / `run-local.ps1` thực hiện 6 bước:

| Bước | Hành động | Output |
|---|---|---|
| 0 | Kiểm tra `.env` tồn tại | Nếu thiếu → copy từ `.env.example` + exit |
| 1 | Kiểm tra Bun đã cài | Nếu thiếu → hướng dẫn cài |
| 2 | `bun install` | Dependencies installed |
| 3 | `bun run db:push` | Database ready (SQLite at `db/custom.db`) |
| 4 | Tải `cloudflared` (nếu chưa có) | `cloudflared.exe` (Windows) hoặc `cloudflared` (macOS/Linux) |
| 5 | Khởi động Next.js | `bun run dev` → `http://localhost:3000` |
| 6 | Tạo Cloudflare Tunnel | URL `https://xxx.trycloudflare.com` → ghi vào `.public-url` |

Sau khi script chạy xong, **đừng tắt terminal** (Ctrl+C để dừng).

---

## 🔧 Chạy thủ công (không tunnel)

Nếu chỉ cần chạy local (không cần URL public):

```bash
# Terminal 1: Next.js
bun install
bun run db:push
bun run dev
```

Mở http://localhost:3000. Email sẽ dùng `http://localhost:3000` làm link (chỉ hoạt động trong mạng local).

---

## 🌐 Cloudflare Tunnel thủ công

Nếu script tự động lỗi, chạy thủ công 2 terminal:

**Terminal 1 — Next.js:**
```bash
bun run dev
```

**Terminal 2 — Cloudflare Tunnel:**
```bash
# Windows
cloudflared.exe tunnel --url http://localhost:3000

# macOS/Linux
cloudflared tunnel --url http://localhost:3000
```

Copy URL `https://xxx.trycloudflare.com` từ output → dán vào file `.public-url`:

```bash
echo "https://xxx.trycloudflare.com" > .public-url
```

Email lời mời sẽ tự động dùng URL này.

### Tải cloudflared

- **Windows**: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
- **macOS**: `brew install cloudflared`
- **Linux**: https://github.com/cloudflare/cloudflared/releases/latest (chọn `cloudflared-linux-amd64`)

---

## ✉️ Email link

Khi tunnel chạy, script ghi URL vào `.public-url`. Email lời mời dùng URL này:

```
Subject: NEXUS AI — Lời mời tham gia dự án "Hệ thống quản lý nhân sự"

Chào Nguyen Van A,

Bạn được mời tham gia dự án "Hệ thống quản lý nhân sự" bởi Bùi Văn Hội.

Vai trò: Frontend Developer
Module: UI, Notification, Employee

Click link để vào workspace:
https://xxx.trycloudflare.com/?p=cmr3abc123&token=cmr3xyz456

Link này cá nhân hóa cho bạn — không chia sẻ với người khác.
```

Thành viên click link → vào workspace với quyền member (xem + chat + kéo thả task).

---

## 💬 Chat Service (Socket.io)

Chat realtime chạy như **mini-service riêng** trên port 3001:

```bash
cd mini-services/chat-service
bun install
bun run dev
# → NEXUS chat service listening on port 3001
```

**Frontend connect qua Caddy gateway** (KHÔNG connect trực tiếp):

```ts
import { io } from 'socket.io-client'

const socket = io('/?XTransformPort=3001', {
  transports: ['websocket', 'polling'],
})
```

> ⚠️ **KHÔNG** dùng `io('http://localhost:3001')` — Caddy gateway sẽ không forward được.

Nếu chat service không chạy, frontend tự fallback sang HTTP polling 3s (chậm hơn nhưng vẫn hoạt động).

👉 Chi tiết protocol: [mini-services/chat-service/README.md](mini-services/chat-service/README.md)

---

## 💡 Lưu ý

| Vấn đề | Giải thích |
|---|---|
| **Máy phải bật** | URL chỉ hoạt động khi máy đang chạy + tunnel đang mở |
| **URL đổi mỗi lần** | Mỗi lần chạy script → URL khác (Cloudflare Tunnel free) |
| **Chat dùng polling** | Nếu chat service (port 3001) không chạy → HTTP polling 3s |
| **Data trên máy** | SQLite tại `db/custom.db` — backup bằng cách copy file |
| **Đóng terminal = dừng** | Ctrl+C hoặc đóng terminal → server + tunnel đều tắt |
| **Multi-tab OK** | Mở nhiều tab cùng 1 user → chat service tự detect (không spam user_left) |

---

## 🆘 Troubleshooting

### `bun: command not found`

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash
# Restart terminal

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
# Restart terminal
```

### `node: command not found`

Tải từ https://nodejs.org (LTS version).

### OpenRouter rate limit (429)

- Thêm `OPENROUTER_API_KEY_2`, `_3`, `_4`... vào `.env` (hỗ trợ không giới hạn số key)
- Hệ thống tự luân chuyển khi 1 key bị 429
- Xem **Live Log Console** trong UI để biết key nào còn sống / đã chết
- Log line ví dụ: `[KEY ROTATION] OpenRouter Key #4 rate-limited for 35623s`

### Model 404 unavailable

- Một số model free bị remove khỏi OpenRouter
- Hệ thống tự skip sang model tiếp theo — xem log `⚠ skip to next model (HTTP 404)`

### Pipeline chạy quá chậm

- Thêm nhiều API key hơn (5-10 key)
- Xem Live Log Console — nếu tất cả key đều 429 → phải đợi reset (thường 24h)
- Pipeline có static fallback data → luôn có kết quả (kém chất lượng hơn)

### Email không gửi được

1. Kiểm tra Gmail App Password (16 ký tự, có khoảng cách cũng OK)
   - **KHÔNG phải password thường** — phải là App Password
   - Tạo tại https://myaccount.google.com/apppasswords
2. Bật 2FA trên Google account trước khi tạo App Password
3. Xem log trong terminal: tìm `[EMAIL]` hoặc `[EMAIL] ⚠ SMTP AUTH FAILED`
4. Nếu SMTP fail → email vẫn được log vào DB (xem tab Mailbox) nhưng không gửi thật

### Mermaid render lỗi

- Bấm nút **"Thu lại"** trên diagram
- Hệ thống tự fix `\\n`, `PK FK`, `class` prefix, ERD brackets, markdown blocks
- Nếu vẫn lỗi → copy raw Mermaid code → test tại https://mermaid.live

### Chat không realtime

- Kiểm tra chat service (port 3001) đang chạy:
  ```bash
  curl http://localhost:3001
  # → {"code":0,"message":"Cannot GET /"} (OK)
  ```
- Nếu không chạy → khởi động lại:
  ```bash
  cd mini-services/chat-service
  bun run dev
  ```
- Frontend tự fallback sang HTTP polling 3s (vẫn nhận được tin nhắn, chậm hơn)

### Cloudflare Tunnel không tạo URL

1. Kiểm tra `tunnel.log`:
   ```bash
   cat tunnel.log
   ```
2. Tải cloudflared thủ công (xem [Cloudflare Tunnel thủ công](#-cloudflare-tunnel-thủ-công))
3. Chạy 2 terminal riêng (Next.js + cloudflared)
4. Copy URL → dán vào `.public-url`

### Dev server crash

- Xem `dev.log`:
  ```bash
  tail -100 dev.log
  ```
- Thường là do:
  - `.env` thiếu `OPENROUTER_API_KEY` → thêm vào
  - DB chưa push → `bun run db:push`
  - Port 3000 đang dùng → kill process: `lsof -i :3000` (macOS/Linux) hoặc `netstat -ano | findstr :3000` (Windows)

### Database reset

```bash
# Xóa DB + tạo lại
rm db/custom.db
bun run db:push
```

> ⚠️ Mất tất cả dữ liệu (projects, members, tasks, chat, emails).

---

## 🐳 Docker

```bash
# Build
docker build -t nexus-ai .

# Run (SQLite persist qua volume)
docker run -d \
  --name nexus-ai \
  -p 3000:3000 \
  -v nexus-data:/data \
  --env-file .env \
  nexus-ai

# View logs
docker logs -f nexus-ai

# Stop
docker stop nexus-ai && docker rm nexus-ai
```

Container tự chạy `bunx prisma db push --skip-generate` khi start → tạo SQLite tại `/data/custom.db`.

**Healthcheck:** `curl http://localhost:3000/` mỗi 30s.

> ⚠️ Docker mode KHÔNG chạy chat service (port 3001). Frontend tự fallback sang HTTP polling.

---

<p align="center">
  <strong>NEXUS AI</strong> — Chạy local, chia sẻ toàn cầu 🌍
</p>
