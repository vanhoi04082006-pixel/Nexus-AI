<div align="center">

# 🤖 NEXUS AI

### Multi-Agent Project Architect — v0.2.0

> Hệ thống AI **đa tác tử (multi-agent)**: Nhập chủ đề dự án + danh sách thành viên → **10 AI Agent** tự động phân tích, thiết kế, lập sprint, sinh todolist, push GitHub và gửi email mời thành viên. Kiến trúc modular: 1 hub 70 dòng + 24 module độc lập trong `src/lib/ai/`.

![Next.js](https://img.shields.io/badge/Next.js-16.1.3-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi--Key-orange)
![Bun](https://img.shields.io/badge/Bun-1-f472b6?logo=bun)
![License](https://img.shields.io/badge/License-MIT-green)

[📖 Documentation](docs/) · [🚀 Cài đặt](#-cài-đặt-quick-start) · [🔧 Cấu hình](#️-cấu-hình-env) · [📐 Architecture](docs/ARCHITECTURE.md) · [🔌 API](docs/API.md) · [🤝 Contributing](docs/CONTRIBUTING.md)

</div>

---

## 📑 Mục lục

- [📖 NEXUS AI là gì?](#-nexus-ai-là-gì)
- [🤖 10 AI Agents](#-10-ai-agents)
- [⚙️ Pipeline xử lý (8 phase)](#️-pipeline-xử-lý-8-phase)
- [✨ Tính năng nổi bật](#-tính-năng-nổi-bật)
- [🧱 Tech Stack](#-tech-stack)
- [🚀 Cài đặt (Quick Start)](#-cài-đặt-quick-start)
- [📜 Scripts](#-scripts)
- [📁 Cấu trúc dự án](#-cấu-trúc-dự-án)
- [⚙️ Cấu hình env](#️-cấu-hình-env)
- [🐳 Deployment](#-deployment)
- [🔌 Mini-services](#-mini-services)
- [🛡️ Anti-rate-limit](#-anti-rate-limit)
- [🗺️ Roadmap](#-roadmap)
- [📄 License](#-license)
- [🔗 Links](#-links)

---

## 📖 NEXUS AI là gì?

**NEXUS AI** là một **trợ lý kiến trúc sư dự án** (Project Architect) chạy hoàn toàn local hoặc triển khai trên Docker / Fly.io. Workflow rất đơn giản:

```
📋 Nhập chủ đề dự án + danh sách thành viên
        ↓
🤖 10 AI Agent chạy pipeline (8 phase)
        ↓
📊 Kết quả: analysis + hr + sprint + design + uml + docs + git + test + security
        ↓
🚀 Push GitHub repo + 📧 Gửi email mời thành viên
```

### 🏗️ Kiến trúc v0.2.0 — Modular AI

- **Hub mỏng** (`src/lib/ai.ts`, 70 dòng) — chỉ re-export
- **24 module độc lập** trong `src/lib/ai/` — dễ test, dễ mở rộng
- **23 Prisma model** (SQLite tại `db/custom.db`)
- **42 route file** (~58 HTTP endpoint) qua Next.js App Router
- **5 view** + **13 workspace tab** cho trải nghiệm dashboard đầy đủ

---

## 🤖 10 AI Agents

Mỗi agent phụ trách một "section" riêng trong output JSON của dự án:

| # | Agent | Section | Vai trò |
|---|-------|---------|---------|
| 1 | 📋 **Requirement Analyst** | `analysis` | Phân tích yêu cầu, user stories, functional/non-functional |
| 2 | 👥 **HR Planner** | `hr` | Vai trò thành viên, phân chia công việc theo skill |
| 3 | 📅 **Sprint Planner** | `sprint` | Chia sprint, backlog, milestone, timeline |
| 4 | 🏛️ **System Architect** | `design` | Kiến trúc tổng thể, tech stack, module diagram |
| 5 | 📊 **UML Generator** | `uml` | Mermaid diagrams (class, sequence, ERD, use-case) |
| 6 | 📝 **Technical Writer** | `docs` | README, API docs, README chuẩn dự án |
| 7 | 🔧 **Git/DevOps** | `git` | Cấu trúc repo, CI/CD, branch strategy, .gitignore |
| 8 | 🧪 **Software Tester** | `test` | Test plan, test cases, chiến lược test |
| 9 | 🔒 **Security Reviewer** | `security` | OWASP, threat model, security checklist |
| 10 | ✅ **Quality Reviewer** | *(merge all)* | Gộp toàn bộ section + Zod validation + feedback loop |

> 🎯 **Quality Reviewer** là agent "cửa cuối" — gộp 9 section phía trước, chạy Zod schema, nếu phát hiện lỗi sẽ **feedback loop** về các agent trước để sửa.

---

## ⚙️ Pipeline xử lý (8 phase)

| Phase | Tên | Mô tả | Agents |
|-------|-----|-------|--------|
| **0** | 🧭 Planner | Pre-plan modules, xác định thứ tự | Planner Agent |
| **1** | 🔁 Sequential | Chạy tuần tự (output của agent trước làm context cho agent sau) | analysis → hr → sprint |
| **2** | ⚡ Parallel 1 | Chạy song song (độc lập) | design + uml + docs + git |
| **3** | ⚡ Parallel 2 | Chạy song song (độc lập) | test + security |
| **4** | 🔁 Retry | Thử lại các agent thất bại (đợi 5s giữa mỗi lần) | Failed agents |
| **5** | 🛟 Fallback | Sinh dữ liệu tĩnh (no crash) cho agent vẫn fail | Static fallback |
| **5.5** | 🧹 Normalizer | Output Normalizer + Consistency Checker | All sections |
| **6** | ✅ Quality | Merge toàn bộ + Zod validation + feedback loop | Quality Reviewer |

> 💡 **Pipeline an toàn**: Ngay cả khi toàn bộ AI fail, phase 5 vẫn đảm bảo output hợp lệ (static data) → UI **không bao giờ crash**.

---

## ✨ Tính năng nổi bật

| Tính năng | Mô tả |
|-----------|-------|
| 📊 **Dashboard Workspace** | 13 tab: Overview, Analysis, HR, Sprint, Design, UML, Docs, Git, Test, Security, Tasks, Chat, Settings |
| 🔔 **Notifications** | Toast realtime + NotificationProvider + db persistent (Notification / NotificationRead) |
| 📧 **Mail System** | Nodemailer SMTP, lưu lịch sử EmailLog, template + attachment |
| 💬 **Chat Service** | Socket.io mini-service (port 3001), ChatMessage lưu DB |
| 🐙 **GitHub Integration** | OAuth push repo tự động (next-auth + GitHub API) |
| 📜 **Live Log Console** | AsyncLocalStorage track log pipeline realtime, AgentStatus + PipelineStatus |
| 🌍 **i18n** | next-intl multi-language |
| 🔐 **Auth** | next-auth, leader/member access control (`src/lib/access.ts`) |
| 🎨 **UI/UX** | 48 shadcn/ui + Radix + framer-motion 12 + mermaid 11 + reactflow |
| 💾 **State** | Zustand persisted store (`src/store/useNexus.ts`) |

---

## 🧱 Tech Stack

| Layer | Tech |
|-------|------|
| **Framework** | Next.js 16.1.3 (App Router, Turbopack) |
| **UI Library** | React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + 48 shadcn/ui + Radix UI |
| **State** | Zustand (persisted) + TanStack Query 5 |
| **Table** | TanStack Table |
| **Database** | Prisma 6 + SQLite (`db/custom.db`) — 23 models |
| **AI** | z-ai-web-dev-sdk + OpenRouter (multi-key, free models) |
| **Validation** | Zod 4 |
| **Charts/Diagrams** | mermaid 11, reactflow |
| **Animation** | framer-motion 12 |
| **Auth** | next-auth |
| **i18n** | next-intl |
| **Email** | nodemailer |
| **Realtime** | socket.io-client |
| **Runtime** | Bun |

---

## 🚀 Cài đặt (Quick Start)

### 📋 Prerequisites

- **Node.js** ≥ 20 hoặc **Bun** ≥ 1.1
- **Git** (để push repo)
- **OpenRouter API key** (free) — lấy tại https://openrouter.ai
- (Tuỳ chọn) GitHub OAuth app — để push repo
- (Tuỳ chọn) SMTP server — để gửi email mời

### 1️⃣ Clone repo

```bash
git clone <repo-url> nexus-ai
cd nexus-ai
bun install   # hoặc npm install
```

### 2️⃣ Cấu hình `.env`

```bash
cp .env.example .env
# sửa .env — xem bảng dưới
```

### 3️⃣ Khởi tạo database

```bash
bun run db:generate    # sinh Prisma client
bun run db:push        # tạo schema SQLite
```

### 4️⃣ Chạy dev

```bash
bun run dev            # Next.js only (localhost:3000, không tunnel)
```

Hoặc chạy kèm tunnel (public URL):

```bash
# Windows
run

# Linux / Mac
bash scripts/run-local.sh
```

> ⚠️ **Lưu ý**: Không còn `bun run run` nữa. Dùng `run` (Windows) hoặc `bash scripts/run-local.sh` (Linux/Mac) cho chế độ tunnel.

---

## 📜 Scripts

| Script | Lệnh | Mô tả |
|--------|------|-------|
| `dev` | `next dev -p 3000 \| tee dev.log` | Next.js dev only, port 3000, log ra `dev.log` |
| `build` | `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/` | Build production + standalone |
| `start` | `NODE_ENV=production bun .next/standalone/server.js \| tee server.log` | Chạy production standalone |
| `lint` | `eslint .` | Kiểm tra lint |
| `db:push` | `prisma db push` | Push schema → SQLite |
| `db:generate` | `prisma generate` | Sinh Prisma client |
| `db:migrate` | `prisma migrate dev` | Tạo migration |
| `db:reset` | `prisma migrate reset` | Reset DB |

### 🚇 Tunnel commands (ngoài package.json)

| Command | OS | Mô tả |
|---------|----|----- |
| `run` | Windows | Gọi `run.cmd` → `scripts/run-local.bat` (Next.js + tunnel) |
| `bash scripts/run-local.sh` | Linux/Mac | Next.js + tunnel (cloudflared / ngrok) |

---

## 📁 Cấu trúc dự án

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 42 route file (~58 endpoint)
│   ├── layout.tsx          # Root layout (Mermaid CDN, ErrorBoundary, Toaster)
│   ├── page.tsx            # Main router (home/input/workspace/all-projects/agent-hub)
│   ├── error.tsx           # Route error boundary
│   ├── global-error.tsx    # Root error boundary
│   ├── loading.tsx         # Route loading
│   ├── not-found.tsx       # 404
│   └── globals.css         # Tailwind + custom CSS (scrollbar, animations)
├── components/
│   ├── ui/                 # 48 shadcn/ui component
│   ├── nexus/              # 14 feature component + tabs/ (13 tab)
│   ├── ErrorBoundary.tsx   # React error boundary
│   ├── providers/          # NotificationProvider
│   └── states/             # EmptyState, RetryState, LoadingState
├── lib/
│   ├── ai.ts               # 70-line hub (re-exports)
│   ├── ai/                 # 24 AI module (modular architecture)
│   ├── openrouter.ts       # AI client (548 dòng, anti-rate-limit)
│   ├── schemas.ts          # Zod lenient validation
│   ├── types.ts            # Shared types
│   ├── db.ts               # Prisma client
│   ├── access.ts           # Leader/member access control
│   ├── activity.ts         # ActivityLog + AgentStatus + PipelineStatus
│   ├── email.ts            # Nodemailer SMTP
│   ├── github.ts           # GitHub OAuth + push
│   ├── notify.ts           # Notification provider (toast API)
│   ├── notifications.ts    # Notification helpers
│   └── pipeline-progress.ts # AsyncLocalStorage log tracker
├── store/useNexus.ts       # Zustand store (persisted)
└── hooks/                  # use-mobile, use-toast
```

### 🗃️ Database models (23)

`Project`, `ProjectContext`, `TokenLog`, `Member`, `Analysis`, `EditProposal`, `ChatMessage`, `Task`, `EmailLog`, `ActivityLog`, `TaskLog`, `AgentStatus`, `SystemStatus`, `PipelineStatus`, `TaskStatistic`, `Notification`, `NotificationRead`, `AgentConfig`, `Template`, `Email`, `EmailAttachment`, `Mailbox`, `MailRead`

---

## ⚙️ Cấu hình env

Sample `.env` (xem `.env.example`):

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `DATABASE_URL` | ✅ | `file:./db/custom.db` (SQLite) |
| `OPENROUTER_API_KEY` | ✅ | `sk-or-v1-xxx` — key chính cho AI |
| `OPENROUTER_API_KEY_2` | ⛔ | Multi-key rotation (tuỳ chọn) |
| `GITHUB_CLIENT_ID` | ⛔ | GitHub OAuth app (để push repo) |
| `GITHUB_CLIENT_SECRET` | ⛔ | GitHub OAuth secret |
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:3000` (client) |
| `APP_URL` | ✅ | `http://localhost:3000` (server) |

> 💡 **Multi-key**: OpenRouter client tự switch key khi gặp lỗi 429 (rate-limit). Thêm `OPENROUTER_API_KEY_2`, `_3`, ... để scale.

---

## 🐳 Deployment

### Docker (local)

```bash
# App chính
docker build -f Dockerfile -t nexus-ai .

# Chat service
docker build -f Dockerfile.chat -t nexus-ai-chat .
```

### Fly.io

```bash
# App chính (fly.toml)
fly deploy

# Chat service (fly.chat.toml)
fly deploy -c fly.chat.toml
```

### Caddy reverse proxy

File `Caddyfile` cấu hình reverse proxy cho app + mini-services. Tuỳ chỉnh domain + upstream port cho phù hợp.

### Tunnel (`tunnel.conf`)

3 chế độ (chọn 1 trong `tunnel.conf`):

| Mode | Công cụ | Mô tả |
|------|---------|-------|
| `quick` | cloudflared (quick tunnel) | Nhanh nhất, URL ngẫu nhiên |
| `cloudflare-named` | cloudflared (named tunnel) | URL cố định, cần CF account |
| `ngrok` | ngrok | Phổ biến, dễ dùng |

---

## 🔌 Mini-services

NEXUS AI tách 2 mini-service ra riêng để scale độc lập:

| Service | Port | Vai trò | Dockerfile |
|---------|------|---------|-----------|
| 💬 **chat-service** | `3001` | Socket.io realtime chat | `Dockerfile.chat` |
| 🔔 **notification-service** | `3002` | Notification queue + dispatch | *(dùng chung app)* |

> 🎯 App chính (port 3000) giao tiếp với 2 service qua HTTP + Socket.io-client.

---

## 🛡️ Anti-rate-limit

Module `src/lib/openrouter.ts` (548 dòng) triển khai **7 cơ chế chống rate-limit** để chạy ổn định với OpenRouter free models:

| # | Cơ chế | Mô tả |
|---|--------|-------|
| 1 | 🔌 **Multi-key rotation** | Tự switch key khi gặp 429 |
| 2 | ⏱️ **60s wait on 429** | Đợi 60s rồi retry khi rate-limit |
| 3 | 🔥 **Circuit Breaker** | 3 fail liên tiếp → skip model 3 phút |
| 4 | 💀 **Dead Model Recovery** | Cooldown 2 phút cho model "chết" |
| 5 | 📊 **Health Score** | Priority sort theo success rate |
| 6 | ⚡ **Adaptive timeout** | Timeout thay đổi theo từng model |
| 7 | 💾 **In-memory cache** | Cache prompt 1h TTL, giảm call API |

> 🎯 Kết quả: Pipeline 10 agent có thể chạy ổn định hàng trăm lần liên tiếp mà không bị block.

---

## 🗺️ Roadmap

- [ ] 🌐 Webhook GitHub realtime (push status, commit log)
- [ ] 🤖 Plugin Agent marketplace (load agent động)
- [ ] 📊 Analytics dashboard (TokenLog + TaskStatistic)
- [ ] 🔄 Multi-project concurrent pipeline
- [ ] 🌍 Web UI i18n đầy đủ (vi / en / ja / zh)
- [ ] 🧠 Vector DB cho long-term memory của agent

---

## 📄 License

Dự án phát hành theo giấy phép **MIT** — xem [LICENSE](LICENSE).

```
MIT License — Copyright (c) 2025 NEXUS AI
```

---

## 🔗 Links

| Link | Mô tả |
|------|-------|
| 📁 [docs/](docs/) | Thư mục documentation đầy đủ |
| 📐 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc modular AI (hub + 24 module) |
| 🔌 [docs/API.md](docs/API.md) | Tài liệu API (~58 endpoint) |
| 🤝 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Hướng dẫn đóng góp |
| 🗄️ [docs/DATABASE.md](docs/DATABASE.md) | Schema 23 Prisma model |
| 🚀 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hướng dẫn deploy Fly.io + Caddy |
| 🤖 [docs/AGENTS.md](docs/AGENTS.md) | Chi tiết 10 AI Agent + pipeline |

---

<div align="center">

**Made with 🤖 by NEXUS AI team**

If this project helps you, please ⭐ the repo!

</div>
