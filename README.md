<div align="center">

# 🤖 NEXUS AI

### Multi-Agent Project Architect — v0.3.0

> **10 AI Agents — Split Prompt + Merge Output architecture**
>
> Nhập chủ đề dự án + danh sách thành viên → 10 AI Agent tự động phân tích, thiết kế, lập sprint, sinh UML, viết docs, push GitHub và gửi email mời. Pipeline 8 phase với kháng rate-limit mạnh mẽ, tự hồi phục khi lỗi.

![Next.js](https://img.shields.io/badge/Next.js-16.1.3-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi--Key-orange)
![Bun](https://img.shields.io/badge/Bun-1-f472b6?logo=bun)
![License](https://img.shields.io/badge/License-MIT-green)

[📖 Giới thiệu](#-nexus-ai-là-gì) · [🤖 Agents](#-10-ai-agents) · [⚙️ Pipeline](#️-pipeline-8-phase) · [🧬 Split Architecture](#-split-agent-architecture) · [🛡️ Anti-rate-limit](#-anti-rate-limit-8-cơ-chế) · [🚀 Quick Start](#-quick-start) · [🔐 Security](#-security)

</div>

---

## 📑 Mục lục

1. [📖 NEXUS AI là gì?](#-nexus-ai-là-gì)
2. [🤖 10 AI Agents](#-10-ai-agents)
3. [⚙️ Pipeline (8 phase)](#️-pipeline-8-phase)
4. [🧬 Split Agent Architecture](#-split-agent-architecture)
5. [🛡️ Anti-rate-limit (8 cơ chế)](#-anti-rate-limit-8-cơ-chế)
6. [🖥️ Views (5 main + 4 new)](#️-views-5-main--4-new)
7. [🧱 Tech Stack](#-tech-stack)
8. [🚀 Quick Start](#-quick-start)
9. [📜 Scripts](#-scripts)
10. [📁 Project Structure](#-project-structure)
11. [⚙️ Env vars](#️-env-vars)
12. [🐳 Deployment](#-deployment)
13. [🔌 Mini-services](#-mini-services)
14. [🔐 Security](#-security)
15. [📄 License](#-license)
16. [🔗 Links](#-links)

---

## 📖 NEXUS AI là gì?

**NEXUS AI** là một **trợ lý kiến trúc sư dự án** (Project Architect) chạy local hoặc triển khai trên Docker / Fly.io. Workflow:

```
📋 Nhập chủ đề dự án + danh sách thành viên
        ↓
🤖 10 AI Agent chạy pipeline 8 phase (Split Prompt + Merge Output)
        ↓
📊 Output: analysis + hr + sprint + design + uml + docs + git + test + security
        ↓
🚀 Push GitHub repo + 📧 Gửi email mời thành viên
```

### 🏗️ Kiến trúc v0.3.0 — Có gì mới?

- **10 AI Agent** (split prompt + merge output) — Single Responsibility
- **8 phase pipeline** từ Phase 0 Planner → Phase 6 Quality Reviewer
- **5 main view + 4 view mới** (KnowledgeBase, Workflow, Settings, Integrations)
- **2 mini-service** chạy độc lập: chat (3001) + notification (3002)
- **23 Prisma model** (SQLite) · **42+ API route** · **48 shadcn/ui component** · **13 workspace tab**
- **Smart Context Retrieval** — `buildCtx` nạp full dbTables + API endpoints cho UML
- **Zod schema** với `.refine()` validate Mermaid syntax
- **Security hardening**: XSS, IDOR, SMTP injection, OAuth nonce, AES-256-GCM token encryption

---

## 🤖 10 AI Agents

Mỗi agent phụ trách một section riêng trong output JSON. Ba agent Design / UML / Docs dùng **Split Prompt** (chia 3 sub-task) rồi **Merge Output**:

| # | Agent | Section | Vai trò |
|---|-------|---------|---------|
| 1 | 📋 **Requirement Analyst** | `analysis` | Phân tích yêu cầu, user stories, functional / non-functional requirements |
| 2 | 👥 **HR Planner** | `hr` | Vai trò thành viên, phân chia công việc theo skill matrix |
| 3 | 📅 **Sprint Planner** | `sprint` | Chia sprint, backlog, milestone, timeline Gantt |
| 4 | 🏛️ **System Architect** | `design` | Kiến trúc tổng thể, tech stack, module diagram *(split 3 sub-task)* |
| 5 | 📊 **UML Generator** | `uml` | Mermaid diagrams (class, sequence, ERD, use-case) *(split 3 sub-task)* |
| 6 | 📝 **Technical Writer** | `docs` | README, API docs, chuẩn dự án *(split 3 sub-task)* |
| 7 | 🔧 **Git/DevOps** | `git` | Cấu trúc repo, CI/CD, branch strategy, .gitignore |
| 8 | 🧪 **Software Tester** | `test` | Test plan, test cases, chiến lược test |
| 9 | 🔒 **Security Reviewer** | `security` | OWASP, threat model, security checklist |
| 10 | ✅ **Quality Reviewer** | *(merge all)* | Gộp 9 section + Zod validation + feedback loop |

> 🎯 **Quality Reviewer** là "cửa cuối" — gộp 9 section phía trước, chạy Zod schema, nếu phát hiện lỗi sẽ **feedback loop** về các agent trước để sửa.

---

## ⚙️ Pipeline (8 phase)

| Phase | Tên | Mô tả | Agents |
|-------|-----|-------|--------|
| **0** | 🧭 Planner | Pre-plan modules, xác định thứ tự chạy | Planner Agent |
| **1** | 🔁 Sequential | Chạy tuần tự — output agent trước làm context agent sau | analysis → hr → sprint |
| **2** | ⚡ Parallel 1 | Chạy song song (độc lập) | design + uml + docs + git |
| **3** | ⚡ Parallel 2 | Chạy song song (độc lập) | test + security |
| **4** | 🔁 Retry | Thử lại agent thất bại (đợi 5s giữa mỗi lần) | Failed agents |
| **5** | 🛟 Fallback | Sinh dữ liệu tĩnh (no crash) cho agent vẫn fail | Static fallback |
| **5.5** | 🧹 Normalizer | Output Normalizer + Consistency Checker | All sections |
| **6** | ✅ Quality | Merge toàn bộ + Zod validation + feedback loop | Quality Reviewer |

> 💡 **Pipeline an toàn**: Ngay cả khi toàn bộ AI fail, phase 5 vẫn đảm bảo output hợp lệ (static data) → UI **không bao giờ crash**.

---

## 🧬 Split Agent Architecture

Ba agent **Design / UML / Docs** áp dụng nguyên lý **Single Responsibility** — chia prompt thành **3 sub-task** nhỏ, chạy song song rồi **merge** lại. Giảm tải context, tăng chất lượng output, dễ retry từng phần.

### 🏛️ System Architect (`design`) — 3 sub-task

| Sub-task | Trách nhiệm |
|----------|-------------|
| 1️⃣ Architecture Overview | Kiến trúc tổng thể, layer diagram, data flow |
| 2️⃣ Tech Stack Selection | Chọn framework, DB, cache, queue + lý do |
| 3️⃣ Module Diagram | Module breakdown, dependency graph, boundary |

### 📊 UML Generator (`uml`) — 3 sub-task

| Sub-task | Trách nhiệm |
|----------|-------------|
| 1️⃣ Class + ERD Diagram | Class diagram, entity relationship, attribute |
| 2️⃣ Sequence Diagram | Flow user → system, API sequence, async flow |
| 3️⃣ Use-case + Component | Use-case diagram, component diagram, deployment |

> 🧠 **Smart Context Retrieval**: `buildCtx` nạp **full dbTables** + **API endpoints** làm context cho UML → diagram khớp 100% với schema thật. Zod `.refine()` validate Mermaid syntax trước khi lưu.

### 📝 Technical Writer (`docs`) — 3 sub-task

| Sub-task | Trách nhiệm |
|----------|-------------|
| 1️⃣ README.md | Project overview, install, usage, badges |
| 2️⃣ API Documentation | Endpoint list, request / response sample, auth |
| 3️⃣ Architecture Doc | Diagram reference, design decision, ADR |

> 🔁 **Merge Output**: 3 sub-task gộp bằng Quality Reviewer — Zod validate + dedupe + format consistency.

---

## 🛡️ Anti-rate-limit (8 cơ chế)

Module `src/lib/openrouter.ts` triển khai **8 cơ chế** để chạy ổn định với OpenRouter free models:

| # | Cơ chế | Mô tả |
|---|--------|-------|
| 1 | 🔌 **Multi-key rotation** | Tự switch key khi gặp 429 (thêm `OPENROUTER_API_KEY_2`, `_3`...) |
| 2 | ⏱️ **60s wait on 429** | Đợi đúng 60s rồi retry khi rate-limit |
| 3 | 🔥 **Circuit Breaker** | 3 fail liên tiếp → skip model 3 phút |
| 4 | 💀 **Dead Model Recovery** | Cooldown 2 phút cho model "chết" rồi revive |
| 5 | 📊 **Health Score** | Priority sort theo success rate từng model |
| 6 | 🩺 **Self-Healing Mermaid** | Khi Mermaid render lỗi → auto-fix + retry render |
| 7 | 🔍 **Self-Critic** | Agent tự đánh giá output, regenerate nếu chưa đạt |
| 8 | ✅ **Sub-task validation** | Validate từng sub-task trong split prompt trước khi merge |

> 🎯 Kết quả: Pipeline 10 agent chạy ổn định hàng trăm lần liên tiếp mà không bị block.

---

## 🖥️ Views (5 main + 4 new)

### 5 Main views

| View | Route | Vai trò |
|------|-------|---------|
| 🏠 **Home** | `/` | Landing page, giới thiệu + CTA |
| 📝 **Input** | `/input` | Nhập chủ đề + thành viên, kickoff pipeline |
| 🛠️ **Workspace** | `/workspace` | Dashboard 13 tab — toàn bộ output của dự án |
| 📂 **AllProjects** | `/all-projects` | Danh sách project đã tạo, filter + search |
| 🤖 **AgentHub** | `/agent-hub` | Cấu hình 10 AI agent, model + prompt + nhiệt độ |

### 4 New views (v0.3.0)

| View | Route | Vai trò |
|------|-------|---------|
| 📚 **KnowledgeBase** | `/knowledge-base` | Template, doc, playbook tái sử dụng |
| 🔄 **Workflow** | `/workflow` | Visual pipeline editor, kéo thả phase |
| ⚙️ **Settings** | `/settings` | API key, theme, i18n, notification pref |
| 🔌 **Integrations** | `/integrations` | GitHub, SMTP, OpenRouter, webhook config |

### 13 Workspace tabs

`Overview` · `Analysis` · `HR` · `Sprint` · `Design` · `UML` · `Docs` · `Git` · `Test` · `Security` · `Tasks` · `Chat` · `Settings`

---

## 🧱 Tech Stack

| Layer | Tech |
|-------|------|
| **Framework** | Next.js 16.1.3 (App Router, Turbopack) |
| **UI Library** | React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + 48 shadcn/ui + Radix UI |
| **State** | Zustand (persisted) + TanStack Query 5 |
| **Table** | TanStack Table 8 |
| **Database** | Prisma 6 + SQLite (`db/custom.db`) — 23 models |
| **AI** | z-ai-web-dev-sdk + OpenRouter (multi-key, free models) |
| **Validation** | Zod 4 (`.refine()` Mermaid) |
| **Diagrams** | mermaid 11 + reactflow 11 |
| **Animation** | framer-motion 12 |
| **Auth** | next-auth (GitHub OAuth + nonce + AES-256-GCM) |
| **i18n** | next-intl |
| **Email** | nodemailer 9 |
| **Realtime** | socket.io-client |
| **Sanitize** | DOMPurify (XSS protection) |
| **Toast** | Sonner (NotificationProvider typed API) |
| **Runtime** | Bun |

---

## 🚀 Quick Start

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
# sửa .env — xem bảng Env vars bên dưới
```

### 3️⃣ Khởi tạo database

```bash
bun run db:generate    # sinh Prisma client
bun run db:push        # push schema → SQLite
```

### 4️⃣ Chạy dev

```bash
# Localhost only (không tunnel)
bun run dev            # Next.js dev, port 3000
```

Hoặc chạy kèm tunnel (public URL cho team test):

```bash
# Windows
run

# Linux / Mac
bash scripts/run-local.sh
```

> ⚠️ **Lưu ý**: Không còn `bun run run` nữa. Dùng `run` (Windows) hoặc `bash scripts/run-local.sh` (Linux/Mac) cho chế độ tunnel (Cloudflare / ngrok).

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

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 42+ route file (~58 endpoint)
│   ├── (views)/            # 5 main + 4 new view
│   │   ├── home/           # 🏠 Home
│   │   ├── input/          # 📝 Input
│   │   ├── workspace/      # 🛠️ Workspace (13 tab)
│   │   ├── all-projects/   # 📂 AllProjects
│   │   ├── agent-hub/      # 🤖 AgentHub
│   │   ├── knowledge-base/ # 📚 KnowledgeBase (NEW)
│   │   ├── workflow/       # 🔄 Workflow (NEW)
│   │   ├── settings/       # ⚙️ Settings (NEW)
│   │   └── integrations/   # 🔌 Integrations (NEW)
│   ├── layout.tsx          # Root layout (Mermaid CDN, ErrorBoundary, Toaster)
│   ├── error.tsx           # Route error boundary
│   ├── global-error.tsx    # Root error boundary
│   ├── loading.tsx         # Route loading
│   └── not-found.tsx       # 404
├── components/
│   ├── ui/                 # 48 shadcn/ui component
│   ├── nexus/              # Feature component + tabs/ (13 tab)
│   ├── ErrorBoundary.tsx   # React error boundary
│   ├── MermaidLoader.tsx   # Client Component (no DOM conflict)
│   ├── providers/          # NotificationProvider (Sonner typed notify)
│   └── states/             # EmptyState, RetryState, LoadingState
├── lib/
│   ├── ai.ts               # Thin hub (re-exports)
│   ├── ai/                 # AI module (modular, split prompt)
│   ├── openrouter.ts       # AI client + 8 anti-rate-limit cơ chế
│   ├── schemas.ts          # Zod schema + .refine() Mermaid
│   ├── buildCtx.ts         # Smart Context Retrieval (dbTables + endpoints)
│   ├── db.ts               # Prisma client
│   ├── access.ts           # Leader/member access control (IDOR)
│   ├── email.ts            # Nodemailer SMTP (CRLF strip)
│   ├── github.ts           # GitHub OAuth + AES-256-GCM token
│   ├── notify.ts           # NotificationProvider typed API
│   └── pipeline-progress.ts # AsyncLocalStorage log tracker
├── store/useNexus.ts       # Zustand store (persisted)
└── hooks/                  # use-mobile, use-toast
```

### 🗃️ Database models (23 Prisma)

`Project` · `ProjectContext` · `TokenLog` · `Member` · `Analysis` · `EditProposal` · `ChatMessage` · `Task` · `EmailLog` · `ActivityLog` · `TaskLog` · `AgentStatus` · `SystemStatus` · `PipelineStatus` · `TaskStatistic` · `Notification` · `NotificationRead` · `AgentConfig` · `Template` · `Email` · `EmailAttachment` · `Mailbox` · `MailRead`

---

## ⚙️ Env vars

Sample `.env` (xem `.env.example`):

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `DATABASE_URL` | ✅ | `file:./db/custom.db` (SQLite) |
| `OPENROUTER_API_KEY` | ✅ | `sk-or-v1-xxx` — key chính cho AI |
| `OPENROUTER_API_KEY_2` | ⛔ | Multi-key rotation (tuỳ chọn, scale chống 429) |
| `GITHUB_CLIENT_ID` | ⛔ | GitHub OAuth app (để push repo) |
| `GITHUB_CLIENT_SECRET` | ⛔ | GitHub OAuth secret |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | ⛔ | AES-256-GCM key mã hoá token OAuth |
| `SMTP_HOST` | ⛔ | SMTP server (gửi email mời) |
| `SMTP_PORT` | ⛔ | SMTP port (465 / 587) |
| `SMTP_USER` | ⛔ | SMTP username |
| `SMTP_PASS` | ⛔ | SMTP password |
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:3000` (client) |
| `APP_URL` | ✅ | `http://localhost:3000` (server) |

> 💡 **Multi-key**: OpenRouter client tự switch key khi gặp 429. Thêm `OPENROUTER_API_KEY_2`, `_3`, ... để scale.

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

File `Caddyfile` cấu hình reverse proxy cho app + 2 mini-service. Tuỳ chỉnh domain + upstream port cho phù hợp.

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

## 🔐 Security

### 🛡️ Security features

| # | Feature | Mô tả |
|---|---------|-------|
| 1 | 🦠 **XSS protection** | `DOMPurify sanitizeHtml` cho DocsTab + MailboxTab — strip script tag, event handler |
| 2 | 🚪 **IDOR prevention** | `src/lib/access.ts` — leader / member access control, check ownership mọi API |
| 3 | 📧 **SMTP header injection** | Structured `from` field + CRLF strip — chống inject header BCC / CC |
| 4 | 🔑 **GitHub OAuth nonce** | State nonce + PKCE-like flow — chống CSRF / replay attack |
| 5 | 🔐 **AES-256-GCM token** | Token GitHub mã hoá AES-256-GCM trước khi lưu DB |
| 6 | ⏱️ **Rate limiting** | `fix-mermaid` 5/min · `chat-ai` 10/min · `ai-rewrite` 10/min |
| 7 | 🧼 **Zod input validation** | Mọi API route validate Zod schema trước khi xử lý |
| 8 | 🩺 **Self-Healing Mermaid** | Mermaid render lỗi → auto-fix → retry (no XSS bypass) |

### 🧩 Resilience UI

| Component | Vai trò |
|-----------|---------|
| `ErrorBoundary.tsx` | React error boundary — catch render error |
| `error.tsx` | Route-level error fallback |
| `global-error.tsx` | Root error fallback (layout crash) |
| `loading.tsx` | Route loading skeleton |
| `not-found.tsx` | 404 page |
| `EmptyState` | Trạng thái rỗng tái sử dụng |
| `RetryState` | Trạng thái lỗi + retry button |
| `LoadingState` | Trạng thái loading tái sử dụng |
| `MermaidLoader` | Client Component — tránh DOM conflict với SSR |
| `NotificationProvider` | Sonner toast + typed `notify` API |

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
| 📐 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc modular AI + split prompt |
| 🔌 [docs/API.md](docs/API.md) | Tài liệu API (~58 endpoint) |
| 🤝 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Hướng dẫn đóng góp |
| 🗄️ [docs/DATABASE.md](docs/DATABASE.md) | Schema 23 Prisma model |
| 🚀 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hướng dẫn deploy Fly.io + Caddy |
| 🤖 [docs/AGENTS.md](docs/AGENTS.md) | Chi tiết 10 AI Agent + pipeline |

---

<div align="center">

**Made with 🤖 by NEXUS AI team — v0.3.0**

If this project helps you, please ⭐ the repo!

</div>
