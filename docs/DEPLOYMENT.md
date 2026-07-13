# 🚀 NEXUS AI — Deployment Guide

> Hướng dẫn deploy **NEXUS AI v0.3.0** trên Local, Docker, Fly.io, Caddy + Tunnel.
>
> **Source files:**
> - [`Dockerfile`](../Dockerfile) — Main app (Next.js standalone)
> - [`Dockerfile.chat`](../Dockerfile.chat) — Chat service (Socket.io)
> - [`fly.toml`](../fly.toml) — Fly.io config (main app)
> - [`fly.chat.toml`](../fly.chat.toml) — Fly.io config (chat service)
> - [`Caddyfile`](../Caddyfile) — Reverse proxy
> - [`tunnel.conf`](../tunnel.conf) — Tunnel mode config
> - [`run.cmd`](../run.cmd) / [`scripts/run-local.sh`](../scripts/run-local.sh) — Local + tunnel launcher

---

## 📑 Mục lục

1. [Prerequisites](#-prerequisites)
2. [Local Development](#-local-development)
3. [Tunnel (Public URL)](#-tunnel-public-url)
4. [Docker Deployment](#-docker-deployment)
5. [Fly.io Deployment](#-flyio-deployment)
6. [Caddy Reverse Proxy](#-caddy-reverse-proxy)
7. [Mini-services (chat + notification)](#-mini-services-chat--notification)
8. [Environment Variables](#-environment-variables)
9. [Production Checklist](#-production-checklist)

---

## 📋 Prerequisites

| Tool | Version | Mục đích | Cài tại |
|---|---|---|---|
| **Bun** | 1.x | Runtime + package manager | [bun.sh](https://bun.sh) |
| **Node.js** | 20+ | Cần cho Prisma generate | [nodejs.org](https://nodejs.org) |
| **OpenRouter API key** | — | AI model provider | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **GitHub OAuth App** (optional) | — | Push project → GitHub repo | [GitHub Developer Settings](https://github.com/settings/developers) |
| **Docker** (optional) | 24+ | Container deployment | [docker.com](https://docker.com) |
| **Fly CLI** (optional) | latest | Fly.io deployment | `curl -L https://fly.io/install.sh \| sh` |
| **cloudflared** or **ngrok** | latest | Tunnel public URL | [cloudflare](https://github.com/cloudflare/cloudflared) / [ngrok.com](https://ngrok.com) |

### Quick check

```bash
bun --version    # 1.x
node --version   # v20+
docker --version # Docker version 24+ (optional)
fly version      # fly v0.x (optional)
```

---

## 💻 Local Development

### Cài đặt

```bash
# 1. Clone repo
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI

# 2. Install dependencies
bun install

# 3. Setup environment
cp .env.example .env
# → Edit .env: điền OPENROUTER_API_KEY + GITHUB_TOKEN_ENCRYPTION_KEY

# 4. Setup database (tự tạo db/custom.db)
bun run db:push
bun run db:generate

# 5. Start dev server
bun run dev
```

→ App chạy tại **http://localhost:3000**

### Dev scripts

| Command | Mục đích |
|---|---|
| `bun run dev` | Start Next.js dev server (port 3000) + log to `dev.log` |
| `bun run build` | Build production (`next build` + copy standalone) |
| `bun run start` | Start production server (`bun .next/standalone/server.js`) |
| `bun run lint` | ESLint check |
| `bun run db:push` | Push schema → SQLite (dev) |
| `bun run db:generate` | Generate Prisma Client |
| `bun run db:migrate` | Create migration file (production) |
| `bun run db:reset` | ⚠️ Drop DB + recreate (mất data) |

### Build production local

```bash
bun run build
bun run start
# → http://localhost:3000 (production mode)
```

---

## 🌐 Tunnel (Public URL)

Để member tham gia project qua email invite link, app cần URL public. NEXUS AI hỗ trợ **3 mode** qua [`tunnel.conf`](../tunnel.conf):

### Mode 1: Quick Tunnel (mặc định — URL ĐỔI mỗi lần chạy)

```conf
# tunnel.conf
# TUNNEL_MODE=quick
```

```cmd
:: Windows (từ root project)
run
```

```bash
# Linux/Mac
bash scripts/run-local.sh
```

→ URL random dạng `https://random-words-123.trycloudflare.com` — **đổi mỗi restart**.

### Mode 2: Cloudflare Named Tunnel (URL cố định — miễn phí)

**Setup 1 lần:**

```bash
# 1. Login Cloudflare (mở browser, chọn domain)
cloudflared tunnel login

# 2. Create tunnel
cloudflared tunnel create nexus-ai

# 3. Route DNS
cloudflared tunnel route dns nexus-ai nexus-ai.yourdomain.com
```

**Cấu hình:**

```conf
# tunnel.conf
TUNNEL_MODE=cloudflare-named
TUNNEL_NAME=nexus-ai
TUNNEL_URL=https://nexus-ai.yourdomain.com
```

### Mode 3: ngrok (URL cố định — dễ nhất)

**Setup 1 lần:**

```bash
# 1. Đăng ký tại https://ngrok.com (login GitHub)
# 2. Lấy authtoken tại https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_TOKEN

# 3. Lấy free static domain tại https://dashboard.ngrok.com/domains
#    (vd: clavicle-justify-qualm.ngrok-free.app)
```

**Cấu hình:**

```conf
# tunnel.conf
TUNNEL_MODE=ngrok
NGROK_DOMAIN=clavicle-justify-qualm.ngrok-free.app
```

### Script flow (`scripts/run-local.sh`)

```
1. Kiểm tra Bun + Node + .env
2. bun install
3. bun run db:push
4. Start Next.js server (port 3000) — background
5. Đợi server ready (poll http://localhost:3000)
6. Start tunnel (cloudflared/ngrok) — background
7. Lưu public URL → .public-url (email service đọc file này)
8. Ctrl+C → kill cả 2 process
```

> 💡 `.public-url` file được [`src/lib/email.ts`](../src/lib/email.ts) đọc để generate invite link đúng URL public (không phải `localhost`).

---

## 🐳 Docker Deployment

### Main App — `Dockerfile` (multi-stage)

```dockerfile
# Stage 1: Build
FROM oven/bun:1.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile
COPY . .
RUN bunx prisma generate
RUN bun run build

# Stage 2: Production
FROM oven/bun:1.2-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next/standline ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /data
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/custom.db
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1
CMD ["sh", "-c", "bunx prisma db push --skip-generate && node server.js"]
```

### Build & Run

```bash
# Build image
docker build -t nexus-ai .

# Run container
docker run -d \
  --name nexus-ai \
  -p 3000:3000 \
  --env-file .env \
  -v nexus_data:/data \
  --restart unless-stopped \
  nexus-ai

# Check logs
docker logs -f nexus-ai

# Health check
curl http://localhost:3000/
```

### Volume mapping

| Container path | Host path (recommended) | Mục đích |
|---|---|---|
| `/data/custom.db` | `nexus_data` volume (Docker) hoặc `./db/custom.db` (bind mount) | SQLite database persistent |
| `/app` | — | App code (read-only sau build) |

```bash
# Bind mount (dev — sync DB với host)
docker run -v $(pwd)/db:/data nexus-ai

# Named volume (prod — Docker managed)
docker volume create nexus_data
docker run -v nexus_data:/data nexus-ai
```

### Chat Service — `Dockerfile.chat`

```bash
# Build chat service image
docker build -f Dockerfile.chat -t nexus-ai-chat .

# Run chat service (port 3001)
docker run -d \
  --name nexus-ai-chat \
  -p 3001:3001 \
  -e NEXT_APP_URL=http://nexus-ai:3000 \
  --restart unless-stopped \
  nexus-ai-chat
```

### Docker Compose (recommended)

```yaml
# docker-compose.yml
version: "3.9"
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    volumes:
      - nexus_data:/data
    restart: unless-stopped
    depends_on: [chat]

  chat:
    build:
      context: .
      dockerfile: Dockerfile.chat
    ports: ["3001:3001"]
    environment:
      NEXT_APP_URL: http://app:3000
    restart: unless-stopped

  notification:
    build:
      context: .
      dockerfile: Dockerfile.notification
    ports: ["3002:3002"]
    environment:
      NEXT_APP_URL: http://app:3000
    restart: unless-stopped

volumes:
  nexus_data:
```

```bash
docker compose up -d
docker compose logs -f
```

---

## ✈️ Fly.io Deployment

Fly.io có free tier phù hợp cho NEXUS AI (1 machine, 512MB RAM, 1GB volume).

### Setup (1 lần)

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login + create apps
fly auth login
fly apps create nexus-ai-app
fly apps create nexus-ai-chat

# 3. Create volume cho SQLite
fly volumes create nexus_data --size 1 --app nexus-ai-app

# 4. Set secrets
fly secrets set OPENROUTER_API_KEY=sk-or-v1-xxx --app nexus-ai-app
fly secrets set GITHUB_TOKEN_ENCRYPTION_KEY=random-32-char-string --app nexus-ai-app
fly secrets set DATABASE_URL="file:/data/custom.db" --app nexus-ai-app
```

### Main App — `fly.toml`

```toml
app = "nexus-ai-app"
primary_region = "sin"  # Singapore — gần Việt Nam

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"
  NODE_ENV = "production"
  DATABASE_URL = "file:/data/custom.db"
  CHAT_SERVICE_URL = "http://nexus-ai-chat.internal:3001"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false  # Không sleep — pipeline background cần chạy liên tục
  auto_start_machines = true
  min_machines_running = 1

[[mounts]]
  source = "nexus_data"
  destination = "/data"
  initial_size = "1GB"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"  # Tăng từ 256mb mặc định để AI pipeline không OOM

[[scale]]
  min = 1
  max = 1
```

### Chat Service — `fly.chat.toml`

```toml
app = "nexus-ai-chat"
primary_region = "sin"

[build]
  dockerfile = "Dockerfile.chat"

[env]
  PORT = "3001"
  NODE_ENV = "production"
  NEXT_APP_URL = "http://nexus-ai-app.internal:3000"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = false  # WebSocket cần persistent
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"

[[scale]]
  min = 1
  max = 1
```

### Deploy commands

```bash
# Deploy main app
fly deploy

# Deploy chat service
fly deploy -c fly.chat.toml

# Deploy notification service (nếu có fly.notification.toml)
fly deploy -c fly.notification.toml

# Check status
fly status --app nexus-ai-app
fly status --app nexus-ai-chat

# View logs
fly logs --app nexus-ai-app
fly logs --app nexus-ai-chat

# SSH into machine (debug)
fly ssh console --app nexus-ai-app
```

### Scale commands

```bash
# Scale memory (vertical)
fly scale memory 512 --app nexus-ai-app
fly scale memory 256 --app nexus-ai-chat

# Scale count (horizontal — cần paid plan)
fly scale count 2 --app nexus-ai-app

# Change region
fly regions sin hkg --app nexus-ai-app
```

### Database backup

```bash
# SSH into machine + copy DB ra host
fly ssh console --app nexus-ai-app
# Inside machine:
cp /data/custom.db /tmp/backup.db
exit

# SFTP file ra host
fly sftp get /tmp/backup.db ./backup-$(date +%Y%m%d).db --app nexus-ai-app
```

---

## 🔀 Caddy Reverse Proxy

Caddy dùng cho reverse proxy + auto HTTPS + SSE buffering fix.

### `Caddyfile`

```caddy
:81 {
    # Route có query ?XTransformPort=3001 → proxy đến port đó (chat service)
    @transform_port_query {
        query XTransformPort=*
    }
    handle @transform_port_query {
        reverse_proxy localhost:{query.XTransformPort} {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
            # Flush immediately — SSE events reach client without buffering
            flush_interval -1
            transport http {
                read_timeout 600s   # 10 min — cho AI pipeline SSE
                write_timeout 600s
                dial_timeout 30s
            }
        }
    }

    # Default → main app (port 3000)
    handle {
        reverse_proxy localhost:3000 {
            header_up Host {host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Real-IP {remote_host}
            flush_interval -1
            transport http {
                read_timeout 600s
                write_timeout 600s
                dial_timeout 30s
            }
        }
    }
}
```

### Chạy Caddy

```bash
# Install
sudo apt install caddy  # Linux
brew install caddy       # Mac

# Run (foreground)
caddy run --config Caddyfile

# Run (background, systemd)
sudo systemctl start caddy
sudo systemctl enable caddy

# Reload config (after edit)
sudo systemctl reload caddy
```

### `XTransformPort` — Magic query

Khi app cần kết nối tới chat service (port 3001) qua cùng domain, frontend chỉ cần append `?XTransformPort=3001` → Caddy tự route đến chat service. **Lý do:** Browser Same-Origin Policy → không gọi được `localhost:3001` từ `localhost:3000`. Caddy làm gateway.

---

## 🧩 Mini-services (chat + notification)

| Service | Port | Tech | Vai trò |
|---|:---:|---|---|
| **chat-service** | 3001 | Socket.io | Realtime chat giữa thành viên |
| **notification-service** | 3002 | Socket.io | Realtime notifications broadcast |

### Run separately (dev)

```bash
# Terminal 1 — Main app
bun run dev

# Terminal 2 — Chat service
cd mini-services/chat-service
bun install
bun run dev
# → http://localhost:3001

# Terminal 3 — Notification service
cd mini-services/notification-service
bun install
bun run dev
# → http://localhost:3002
```

### Run via Docker (prod)

```bash
# Build + run chat
docker build -f Dockerfile.chat -t nexus-ai-chat .
docker run -d -p 3001:3001 -e NEXT_APP_URL=http://localhost:3000 nexus-ai-chat

# Notification service (tương tự — cần Dockerfile.notification)
docker build -f Dockerfile.notification -t nexus-ai-notification .
docker run -d -p 3002:3002 -e NEXT_APP_URL=http://localhost:3000 nexus-ai-notification
```

### Environment variables (mini-services)

| Variable | Required | Default | Mục đích |
|---|:---:|---|---|
| `PORT` | ✅ | 3001 / 3002 | Port để listen |
| `NODE_ENV` | ✅ | production | Environment |
| `NEXT_APP_URL` | ✅ | — | URL của Next.js app (để verify token khi join socket) |

### Health check

```bash
# Chat service
curl http://localhost:3001/health
# → { "status": "ok", "uptime": 1234 }

# Notification service
curl http://localhost:3002/health
```

> 📌 Xem thêm: [`mini-services/chat-service/README.md`](../mini-services/chat-service/README.md) và [`mini-services/notification-service/README.md`](../mini-services/notification-service/README.md).

---

## ⚙️ Environment Variables

### Table đầy đủ

| Variable | Required | Default | Mục đích |
|---|:---:|---|---|
| `DATABASE_URL` | ✅ | `file:./db/custom.db` | SQLite path (dev) / `file:/data/custom.db` (prod) |
| `OPENROUTER_API_KEY` | ✅ | — | API key(s) — comma-separated cho multi-key rotation (100+ keys) |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | ✅ (prod) | — | Passphrase cho AES-256-GCM encrypt GitHub token |
| `GITHUB_CLIENT_ID` | ❌ | — | GitHub OAuth App client ID (cho push to repo) |
| `GITHUB_CLIENT_SECRET` | ❌ | — | GitHub OAuth App client secret |
| `NEXT_PUBLIC_APP_URL` | ❌ | — | Public URL — override `.public-url` file |
| `SMTP_HOST` | ❌ | `smtp.gmail.com` | SMTP server cho email |
| `SMTP_PORT` | ❌ | `465` | SMTP port |
| `CHAT_SERVICE_URL` | ❌ | `http://localhost:3001` | URL chat service (main app → chat) |
| `NEXT_APP_URL` | ❌ | `http://localhost:3000` | URL main app (chat service → app, verify token) |
| `PORT` | ❌ | `3000` | Port main app listen |
| `NODE_ENV` | ✅ | `development` | `production` / `development` |

### `.env.example`

```bash
# Database
DATABASE_URL="file:./db/custom.db"

# OpenRouter (AI)
OPENROUTER_API_KEY="sk-or-v1-xxx,sk-or-v1-yyy"  # comma-separated cho multi-key

# GitHub OAuth (optional — push to repo)
GITHUB_TOKEN_ENCRYPTION_KEY="random-32-char-string"
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# Public URL (override .public-url file)
NEXT_PUBLIC_APP_URL=""

# SMTP (optional — send real email)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
```

### Security notes

- `.env` đã có trong `.gitignore` — không commit
- `OPENROUTER_API_KEY` hỗ trợ 100+ keys (comma-separated) → multi-key rotation chống 429
- `GITHUB_TOKEN_ENCRYPTION_KEY` **bắt buộc** trong production (AES-256-GCM)
- `leaderSmtpPassword` lưu DB nhưng **không** persist vào localStorage (Zustand `partialize` strip)
- Xem thêm: [Security Documentation](./SECURITY.md#10-environment-variables-security)

---

## ✅ Production Checklist

### Trước khi deploy

- [ ] **Environment variables** đã set đầy đủ (`.env` / `fly secrets`)
  - [ ] `OPENROUTER_API_KEY` (ít nhất 2 key cho multi-key rotation)
  - [ ] `GITHUB_TOKEN_ENCRYPTION_KEY` (random 32+ char string)
  - [ ] `DATABASE_URL` (`file:/data/custom.db`)
- [ ] **Database** đã setup (`bun run db:push`)
- [ ] **Build** thành công không lỗi (`bun run build`)
- [ ] **Lint** pass (`bun run lint`)
- [ ] **Health check** endpoint trả 200 (`/` hoặc `/api/health`)

### Security checklist

- [ ] `.env` **không** commit lên git (`git status` clean)
- [ ] `db/custom.db` **không** commit (chứa user data)
- [ ] `GITHUB_TOKEN_ENCRYPTION_KEY` đã set (AES-256-GCM)
- [ ] `NODE_ENV=production` → tắt verbose logging
- [ ] HTTPS enabled (Caddy auto HTTPS / Fly `force_https = true`)
- [ ] CORS: chỉ allow domain của app
- [ ] Rate limit headers (`X-RateLimit-*`) trả về client
- [ ] Error response không leak stack trace
- [ ] Xem đầy đủ: [Security Checklist](./SECURITY.md#production-checklist)

### Infrastructure checklist

- [ ] **Volume persistent** cho SQLite (Docker volume / Fly volume)
- [ ] **Backup** DB định kỳ (`cp db/custom.db backup-YYYYMMDD.db`)
- [ ] **Mini-services** chạy (chat 3001 + notification 3002)
- [ ] **Reverse proxy** (Caddy) config đúng — đặc biệt `flush_interval -1` cho SSE
- [ ] **Tunnel** (nếu cần public URL) — Cloudflare Named hoặc ngrok domain cố định
- [ ] **Auto-restart** (`restart: unless-stopped` Docker / `auto_start_machines = true` Fly)
- [ ] **Health check** config (Docker `HEALTHCHECK` / Fly `http_service`)
- [ ] **Logs** có rotation (`tee dev.log` / `fly logs` / Docker `json-file` log driver)

### Post-deploy verification

```bash
# 1. App responds
curl -f https://your-domain.com/
# → 200 OK

# 2. API works
curl -f https://your-domain.com/api/projects
# → 200 OK (JSON response)

# 3. Chat service (if separate)
curl -f https://your-domain.com:3001/health
# → { "status": "ok" }

# 4. Database write works (create test project)
curl -X POST https://your-domain.com/api/projects \
  -H "Content-Type: application/json" \
  -d '{"topic":"Test","leaderName":"Admin","leaderEmail":"admin@test.com"}'
# → 201 Created with project ID

# 5. AI pipeline runs (manual trigger from UI)
# → Check Live Log Console shows all 10 agents

# 6. Email sending (if SMTP configured)
# → Send invite from UI, check Mailbox tab

# 7. GitHub push (if OAuth configured)
# → Push project to repo, check commit appears
```

---

## 🔗 Liên kết

- [README.md — Quick Start](../README.md)
- [Architecture overview](./ARCHITECTURE.md)
- [Database setup](./DATABASE.md)
- [Security hardening](./SECURITY.md)
- [API endpoints](./API.md)
