<div align="center">

# 🤖 NEXUS AI

### Multi-Agent Project Architect

> Hệ thống AI đa tác tử — Nhập chủ đề dự án → **10 AI Agent** tự động phân tích, thiết kế, lập sprint, sinh todolist Kanban, push GitHub, gửi email mời thành viên. Có Live Log Console realtime, Notification Center, Mail System, và Dashboard widgets.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi--Key-orange)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Bun](https://img.shields.io/badge/Bun-1-f472b6?logo=bun)
![License](https://img.shields.io/badge/License-MIT-green)

[📖 Documentation](docs/) · [🚀 Cài đặt](#-cài-đặt) · [🔧 Cấu hình](#️-cấu-hình-env) · [📐 Architecture](docs/ARCHITECTURE.md) · [🔌 API](docs/API.md) · [🤝 Contributing](docs/CONTRIBUTING.md)

</div>

---

## 📖 NEXUS AI là gì?

NEXUS AI là một **trợ lý kiến trúc sư dự án** chạy hoàn toàn local (hoặc Docker/Fly.io) — bạn chỉ cần nhập chủ đề + danh sách thành viên, **10 AI Agent** sẽ tự động phân tích, thiết kế, lập kế hoạch, sinh todolist, push GitHub, và gửi email mời thành viên.

### 🤖 10 AI Agents

| # | Agent | Nhiệm vụ |
|---|---|---|
| 01 | **Requirement Analyst** | Phân tích chủ đề → tech stack, features, actors, modules |
| 02 | **HR Planner** | Phân vai trò cho từng thành viên dựa trên ưu/nhược điểm |
| 03 | **Sprint Planner** | Chia sprint 2 tuần, gán task, deadline, milestones |
| 04 | **System Architect** | Thiết kế database schema, API endpoints, folder structure |
| 05 | **UML Generator** | Sinh 4 diagram: Use Case, Class, ERD, Sequence (Mermaid + React Flow) — **enterprise-grade prompt**, đọc analysis/design/sprint, self-validate, no hallucination |
| 06 | **Technical Writer** | Viết README, Coding Convention, API Standard |
| 07 | **Git/DevOps** | Git commands, branch strategy, issue template, CI/CD |
| 08 | **Software Tester** | Unit/integration/E2E/API/performance tests + bug report |
| 09 | **Security Reviewer** | Threats, auth flow, OWASP Top 10, rate limit, secrets |
| 10 | **Quality Reviewer** | Tổng hợp + đồng bộ 9 sections, Zod validation, feedback loop |

### 🔄 Pipeline (6 giai đoạn)

| Phase | Agents | Chế độ |
|---|---|---|
| **Phase 1 — Analysis** | 01 → 02 → 03 | Sequential (mỗi agent phụ thuộc cái trước) |
| **Phase 2 — Design** | 04 + 05 + 06 + 07 | Parallel (mặc định) hoặc Sequential |
| **Phase 3 — Quality Gates** | 08 + 09 | Parallel hoặc Sequential |
| **Phase 4 — Retry** | Các agent thất bại | Retry 1 lần sau 5s |
| **Phase 5 — Fallback** | Agent vẫn fail | Sinh dữ liệu tĩnh (không crash) |
| **Phase 6 — Quality Review** | Agent 10 | Tổng hợp + đồng bộ tất cả sections |

> Mỗi agent có 9 free models OpenRouter với retry 5 lần/model, full-jitter backoff, và fallback tĩnh nếu tất cả model fail. **429 rate-limit** → wait **60s + jitter** rồi retry (áp dụng cho mọi model). Multi-key rotation tự động khi bị 429.

---

## ✨ Tính năng nổi bật

### 📊 Dashboard & Views
- **Trang tổng quan (Home)** — Dashboard với 3 widget realtime (toàn bộ data thật từ DB):
  - **Recent Activity** — Feed hoạt động từ `ActivityLog` (20+ event types)
  - **NEXUS AI Status** — Agent/API key/Pipeline/DB/Redis/Storage status realtime
  - **Tasks đang làm** — Task in_progress/overdue/due_soon của user
- **All Projects** — Premium SaaS dashboard: stats cards, search, filter (priority/status/tag), sort, grid/list toggle, context menu (favorite/archive/duplicate/delete)
- **Input** — Tạo project form (topic, description, purpose, tech prefs, members, deadline, priority, tags, cover color)
- **Workspace** — Project workspace với 13 sidebar tabs
- **Agent Hub** — Dashboard cho 10 AI agents (status, model, skills, stats)

### 🔔 Notification Center
- **Per-user read tracking** (qua `NotificationRead` — 1 row mỗi reader)
- **13 notification types**: `TASK_COMPLETED`, `TASK_STATUS_CHANGED`, `PROPOSAL_CREATED`, `REQUIREMENT_EDITED`, `DOC_UPLOADED`, `COMMENT`, `AI_DONE`, `AI_ERROR`, `DEADLINE_SOON`, `TASK_ASSIGNED`, `MAIL_RECEIVED`, `PROJECT_INVITE`, `APPROVAL_REQUEST`
- **Realtime qua WebSocket** (notification-service, port 3002)
- **Detail modal** với action button click-through
- **Broadcast** (recipientEmail=null) hoặc **targeted** (email cụ thể)
- Bell icon với unread badge, mark-all-read, mark-unread

### 📬 Mail System
- **Compose** với rich text editor (`@mdxeditor/editor`)
- **AI Rewrite** qua OpenRouter — 5 mode: `improve`, `professional`, `friendly`, `concise`, `expand`
- **SMTP send** qua `nodemailer` (dùng leader credentials)
- **7 folders**: `INBOX` / `SENT` / `DRAFT` / `STARRED` / `ARCHIVE` / `SPAM` / `TRASH`
- **Attachments** — upload (max 5MB/file), download, delete
- **Reply / Reply-all / Forward** — threading qua `parentEmailId`
- **Realtime notifications** khi nhận mail mới
- **Per-user state** (Mailbox model: folder, isRead, isStarred, isArchived, isTrashed)

### 📝 Activity Logging
- **20+ event types**: `PROJECT_CREATED/UPDATED/DELETED`, `MEMBER_JOINED/LEFT`, `TASK_CREATED/UPDATED/STATUS_CHANGED/COMPLETED`, `DOC_UPLOADED`, `AI_AGENT_START/DONE/ERROR`, `SPRINT_CREATED`, `DEPLOY`, `GIT_MERGE`, `PROPOSAL_CREATED/APPROVED/REJECTED`, `MAIL_SENT/RECEIVED`, `PIPELINE`, `INIT`, `REFINE`, `TASK_GEN`, `SECTION_EDIT`, `GITHUB_PUSH`, `EMAIL_SENT`
- **Enriched with actor info** (name, email, role, avatar)
- **Relations** (relatedTaskId, relatedMailId, actionUrl) cho click-through

### ✅ Task Generation & Kanban
- **Dedup + comprehensiveness check** — không sinh task trùng lặp, đảm bảo đủ layer (DATABASE/BACKEND/UI/CONFIG/TESTING)
- **Developer-First model** — mỗi task có: `layer` (DATABASE/BACKEND/UI/CONFIG/TESTING), `targetFile`, `implementationSteps[]`, `technicalHints` (snippet + note)
- **Kanban board** — drag & drop 4 cột: `todo` / `in_progress` / `review` / `done` (qua `@hello-pangea/dnd`)
- **Task statistics** cache (`TaskStatistic` model) — completion rate, overdue, due soon

### 📐 Mermaid Rendering (3-tier fix)
1. **`fixMermaid`** — regex fix nhanh (lỗi syntax phổ biến)
2. **`aggressiveFix`** — fix mạnh hơn (node ID normalization, dấu tiếng Việt)
3. **AI Auto-Fix** — gọi `/api/projects/[id]/fix-mermaid` → AI sửa syntax (qua OpenRouter)

### 🐙 GitHub Integration
- **OAuth** flow (`/api/github/auth` → `/api/github/callback`)
- **Push to repo** — sinh 17+ files (README, docs, UML, .github templates) → tạo PR
- **Status check** qua `/api/github/status`

### 💬 Realtime Chat
- **WebSocket** (chat-service, port 3001, Socket.io)
- **AI Assistant** — `/api/projects/[id]/chat/ai` để trigger AI reply
- Fallback HTTP polling nếu chat-service không chạy

### 🧠 UML Enterprise Prompt
- **UML Generator (Agent 05)** dùng enterprise-grade prompt:
  - Đọc dữ liệu từ `analysis` + `design` + `sprint` đã sinh ở Phase 1-2
  - Self-validate tính nhất quán giữa các diagram (Use Case ↔ Class ↔ ERD ↔ Sequence)
  - No hallucination — chỉ vẽ entity/relation có thật trong analysis/design
  - Synchronize actor list, module list, DB tables giữa các diagram

### 🎨 Theme & UX
- **Dark theme only** — teal accent, no light mode
- **Neural background** animation
- **3D AI brain** hero animation
- **Sonner toasts** cho notifications
- **shadcn/ui (New York)** — 50+ components
- **Lenient Zod schemas** — `toString` / `toStringArray` / `toNumber` preprocessors xử lý biến thể output AI (string vs number, single vs array)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4, shadcn/ui (New York), tw-animate-css |
| **State** | Zustand 5 (persisted), TanStack Query 5, TanStack Table 8 |
| **Animation** | Framer Motion 12 |
| **Backend** | Next.js API Routes (Node.js runtime) — 50+ endpoints |
| **Database** | Prisma 6 ORM + SQLite (23 models) |
| **AI** | OpenRouter (multi-key rotation, 9 free models/agent, multi-model fallback, 60s retry cho 429) |
| **Realtime** | Socket.io (chat port 3001 + notifications port 3002) |
| **Diagrams** | Mermaid.js 11 (CDN) + React Flow 11 |
| **Kanban** | @hello-pangea/dnd 18 |
| **Email** | Nodemailer 9 (SMTP), @mdxeditor/editor (rich text) |
| **Forms** | react-hook-form 7 + zod 4 (lenient preprocessors) |
| **Runtime** | Bun 1 (dev + production) |

---

## 🚀 Cài đặt

### Yêu cầu

- [Bun](https://bun.sh) v1+ (runtime + package manager)
- [Node.js](https://nodejs.org) v20+ (cho Prisma CLI + scripts/run.js)
- [OpenRouter API key](https://openrouter.ai/keys) (free)

### Quick start

```bash
# 1. Clone
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI

# 2. Cài dependencies
bun install

# 3. Cấu hình env
cp .env.example .env
# → Điền OPENROUTER_API_KEY vào .env

# 4. Init database (SQLite)
bun run db:push

# 5. Chạy dev server
bun run dev
# → http://localhost:3000
```

### ⚡ Shortcut: `bun run run` (cross-platform)

Lệnh **một bước** để chạy dev server + Cloudflare Tunnel/ngrok (share local ra internet) — tự động detect OS:

```bash
bun run run
```

Cách hoạt động (xem [`scripts/run.js`](scripts/run.js)):
- **Windows** → chạy `scripts/run-local.bat`
- **Linux/Mac** → chạy `scripts/run-local.sh`

Cả 2 script trên đều:
1. Check dependencies (Bun, cloudflared/ngrok)
2. Chạy `bun run dev` (port 3000)
3. Mở tunnel (Quick / Named / Ngrok — cấu hình trong `tunnel.conf`)
4. Parse tunnel URL → ghi vào `.public-url` (dùng cho email links)

> Nếu chỉ muốn chạy local không cần tunnel → dùng `bun run dev`.

### Chạy mini-services (optional, cho realtime)

```bash
# Terminal 1 — Chat service (port 3001)
cd mini-services/chat-service
bun install
bun run dev

# Terminal 2 — Notification service (port 3002)
cd mini-services/notification-service
bun install
bun run dev
```

> Nếu không chạy mini-services, frontend tự fallback sang HTTP polling. Notification Center + Mail vẫn hoạt động qua REST API (chỉ không realtime).

### Scripts có sẵn

| Script | Mô tả |
|---|---|
| `bun run dev` | Chạy dev server (port 3000, Turbopack, log ra `dev.log`) |
| `bun run run` | **Shortcut cross-platform** — chạy dev + tunnel (Win/Mac/Linux) |
| `bun run build` | Build production (standalone output) |
| `bun run start` | Chạy production server (Bun runtime) |
| `bun run lint` | ESLint + Next.js rules |
| `bun run db:push` | Push schema → SQLite (dev) |
| `bun run db:generate` | Regenerate Prisma Client |
| `bun run db:migrate` | Tạo migration (production) |
| `bun run db:reset` | Reset DB (xóa hết data!) |

---

## ⚙️ Cấu hình (.env)

Copy `.env.example` thành `.env` và điền:

```bash
# Database (SQLite)
DATABASE_URL=file:./db/custom.db

# OpenRouter API Keys (multi-key rotation)
# Hỗ trợ không giới hạn số key — tự động luân chuyển khi 1 key bị rate-limit
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
# OPENROUTER_API_KEY_2=sk-or-v1-xxxxxxxxxxxxx
# OPENROUTER_API_KEY_3=sk-or-v1-xxxxxxxxxxxxx
# ... thêm bao nhiêu cũng được

# GitHub OAuth App (tùy chọn — cho push GitHub)
GITHUB_CLIENT_ID=xxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

| Variable | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite path. Dev: `file:./db/custom.db` |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key (free tại https://openrouter.ai/keys) |
| `OPENROUTER_API_KEY_2..N` | ⛔ | Keys dự phòng cho multi-key rotation |
| `GITHUB_CLIENT_ID` | ⛔ | GitHub OAuth App Client ID (cho push GitHub) |
| `GITHUB_CLIENT_SECRET` | ⛔ | GitHub OAuth App Client Secret |
| `NEXT_PUBLIC_APP_URL` | ⛔ | Public URL (cho email links) — mặc định `http://localhost:3000` |
| `APP_URL` | ⛔ | Server-side public URL |

> **SMTP credentials** (Gmail App Password) không lưu trong `.env` — leader nhập khi tạo project, lưu vào `Project.leaderSmtpPassword`.

---

## 📁 Project Structure

```
Nexus-AI/
├── prisma/
│   └── schema.prisma              # DB schema (23 models)
├── src/
│   ├── app/
│   │   ├── api/                   # REST API routes (50+ endpoints)
│   │   │   ├── projects/          # Project CRUD + pipeline + tasks + mailbox + ...
│   │   │   ├── dashboard/         # activity, status, tasks, statistics
│   │   │   ├── activity/logs      # Activity log query
│   │   │   ├── agents/            # 10 AI agents info
│   │   │   ├── notifications/     # Global notifications
│   │   │   ├── templates/         # Project templates
│   │   │   ├── github/            # OAuth + push + status
│   │   │   └── config/            # Public URL config
│   │   ├── layout.tsx             # Root layout (Mermaid CDN, dark theme)
│   │   └── page.tsx               # Main page (router: home/projects/input/workspace)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui (50+ components — KHÔNG sửa)
│   │   └── nexus/
│   │       ├── tabs/              # 13 workspace tabs
│   │       ├── HomeView.tsx       # Dashboard widgets
│   │       ├── AllProjectsView.tsx# Premium SaaS dashboard
│   │       ├── InputView.tsx      # Create project form
│   │       ├── WorkspaceView.tsx  # Project workspace
│   │       ├── AgentHubView.tsx   # 10 AI agents dashboard
│   │       ├── NotificationBell.tsx
│   │       ├── MermaidRenderer.tsx# 3-tier fix
│   │       ├── ProcessingOverlay.tsx       # Pipeline Live Log
│   │       ├── TaskProcessingOverlay.tsx   # Init/Refine Live Log
│   │       ├── NeuralBackground.tsx
│   │       └── AI3DBrain.tsx
│   ├── lib/
│   │   ├── ai.ts                  # 10-agent pipeline + retry + fallback
│   │   ├── openrouter.ts          # Multi-key rotation client
│   │   ├── github.ts              # Push + PR
│   │   ├── email.ts               # SMTP (nodemailer)
│   │   ├── notifications.ts       # Notification service broadcaster
│   │   ├── activity.ts            # Activity log + system/pipeline status
│   │   ├── pipeline-progress.ts   # AsyncLocalStorage log + progress maps
│   │   ├── access.ts              # Token auth (leader/member)
│   │   ├── schemas.ts             # Zod validators (lenient preprocessors)
│   │   ├── db.ts                  # Prisma client
│   │   └── types.ts
│   └── store/
│       └── useNexus.ts            # Zustand store (persisted)
├── mini-services/
│   ├── chat-service/              # Socket.io chat (port 3001)
│   └── notification-service/      # Socket.io notifications (port 3002)
├── scripts/                       # run.js (cross-platform), run-local.{sh,bat}, deploy-fly, push-to-github
├── docs/                          # Documentation
├── db/
│   └── custom.db                  # SQLite (auto-created)
└── package.json
```

---

## 🔌 API Overview

50+ REST endpoints, nhóm theo category:

| Group | Endpoints | Mô tả |
|---|---|---|
| **Projects** | 4 | CRUD + duplicate |
| **Pipeline** | 3 | Initialize, refine, progress polling |
| **Tasks** | 2 | List + update (Kanban drag-drop) |
| **Notifications** | 4 | List, create, mark read, delete |
| **Mail** | 6 | Compose, list, get, patch, attachments, AI rewrite |
| **Dashboard** | 4 | Activity, status, tasks, statistics |
| **Activity** | 2 | Project history + global logs |
| **Agents** | 1 | 10 AI agents info |
| **GitHub** | 4 | OAuth, callback, push, status |
| **Chat** | 3 | List, post, AI reply |
| **Edit Proposals** | 3 | List, create, approve/reject |
| **Sections** | 1 | Edit section content |
| **Members** | 2 | List, add |
| **Context/Tokens** | 2 | Long-term memory + token usage |
| **Fix Mermaid** | 1 | AI fix Mermaid syntax |
| **Config/Templates** | 2 | Public URL + project templates |

👉 **Full reference:** [docs/API.md](docs/API.md)

---

## 🗄️ Database

23 models (SQLite via Prisma) — xem đầy đủ tại [`prisma/schema.prisma`](prisma/schema.prisma):

| Model | Mô tả |
|---|---|
| `Project` | Project + dashboard enrichment (isFavorite, isArchived, priority, deadline, techStack, tags, coverColor) |
| `Member` | Thành viên + inviteToken |
| `Analysis` | Section versioned (analysis/hr/sprint/design/uml/docs/git/test/security) |
| `Task` | SMART task + Kanban fields (layer, targetFile, implementationSteps, technicalHints) |
| `EditProposal` | Member đề xuất edit → leader approve |
| `ChatMessage` | Chat realtime |
| `ProjectContext` | Long-term memory cache (save tokens) |
| `TokenLog` | Token usage per agent per project |
| `ActivityLog` | 20+ event types, enriched with actor + relations |
| `TaskLog` | Audit trail task mutations |
| `Notification` + `NotificationRead` | Notification + per-user read tracking |
| `Email` + `EmailAttachment` + `Mailbox` + `MailRead` | Full mail system |
| `AgentConfig` | AI agent customization |
| `AgentStatus` | Live agent status (online/busy/error/idle) |
| `SystemStatus` | DB/Redis/VectorDB/Storage status |
| `PipelineStatus` | Pipeline run status per project |
| `TaskStatistic` | Cached aggregate per project |
| `Template` | Project template blueprint |
| `EmailLog` | Legacy email log (invitation/task assigned) |

---

## 🚢 Deployment

### Fly.io (recommended)

```bash
# Cài flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly deploy          # Main app (port 3000)
fly deploy -c fly.chat.toml        # Chat service (port 3001)
fly deploy -c fly.notification.toml # Notification service (port 3002)
```

Xem chi tiết: [`DEPLOY.md`](DEPLOY.md)

### Local với Cloudflare Tunnel (share tạm thời)

```bash
bun run run          # Cross-platform shortcut (tự detect Win/Linux/Mac)
# Hoặc chạy trực tiếp:
./scripts/run-local.sh    # Linux/Mac
./scripts/run-local.bat   # Windows
# → Tự động parse tunnel URL → ghi vào .public-url
```

Xem chi tiết: [`LOCAL_RUN.md`](LOCAL_RUN.md)

### Docker

```bash
docker build -t nexus-ai .
docker run -p 3000:3000 -v $(pwd)/db:/app/db nexus-ai
```

---

## 📚 Documentation

| Document | Mô tả | Audience |
|---|---|---|
| [README.md](README.md) | Overview + cài đặt nhanh | Tất cả users |
| [docs/README.md](docs/README.md) | Documentation index | Tất cả |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, design decisions | Developers |
| [docs/API.md](docs/API.md) | Full REST API reference (50+ endpoints) | Developers |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev setup, code style, how to extend | Contributors |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Code of conduct | Tất cả |
| [LOCAL_RUN.md](LOCAL_RUN.md) | Chạy local + Cloudflare Tunnel | Users local |
| [DEPLOY.md](DEPLOY.md) | Deploy Fly.io + Docker | DevOps |

---

## 🤝 Contributing

Xem [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) để biết:
- Setup dev environment
- Code style (TypeScript strict, shadcn/ui, Tailwind)
- Cách thêm AI Agent mới (đã có hướng dẫn từng bước)
- Cách thêm API Route + log qua AsyncLocalStorage
- Pull Request process

---

## 📄 License

[MIT](LICENSE) © Bùi Văn Hội

---

## 📞 Support

- **GitHub Issues:** https://github.com/vanhoi04082006-pixel/Nexus-AI/issues
- **GitHub:** [@vanhoi04082006-pixel](https://github.com/vanhoi04082006-pixel)

---

<p align="center">
  <strong>NEXUS AI</strong> — Multi-Agent Project Architect 🤖
</p>
