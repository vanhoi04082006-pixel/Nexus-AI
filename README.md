<div align="center">

# 🤖 NEXUS AI

### Multi-Agent Project Architect — v6.0 Modular Architecture

> Hệ thống AI đa tác tử **modular**: Nhập chủ đề dự án → **10 AI Agent cốt lõi + 5 Agent plugin** tự động phân tích, thiết kế, lập sprint, sinh todolist Kanban, push GitHub, gửi email mời thành viên. Kiến trúc v6.0 modular: 1 file 2291 dòng → 70 dòng hub + 24 module độc lập, 36 enterprise features.

![Version](https://img.shields.io/badge/Version-6.0-blueviolet)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi--Key-orange)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Bun](https://img.shields.io/badge/Bun-1-f472b6?logo=bun)
![Modules](https://img.shields.io/badge/AI_Modules-24-success)
![Features](https://img.shields.io/badge/Enterprise_Features-36-success)
![License](https://img.shields.io/badge/License-MIT-green)

[📖 Documentation](docs/) · [🚀 Cài đặt](#-cài-đặt) · [🔧 Cấu hình](#️-cấu-hình-env) · [📐 Architecture](docs/ARCHITECTURE.md) · [🔌 API](docs/API.md) · [🤝 Contributing](docs/CONTRIBUTING.md)

</div>

---

## 📖 NEXUS AI là gì?

NEXUS AI là một **trợ lý kiến trúc sư dự án** chạy hoàn toàn local (hoặc Docker/Fly.io). Bạn chỉ cần nhập chủ đề + danh sách thành viên, **15 AI Agent** (10 core + 5 plugin) sẽ tự động phân tích, thiết kế, lập kế hoạch, sinh todolist, push GitHub, và gửi email mời thành viên.

### 🏗️ Phiên bản v6.0 — Modular Architecture

Bản v6.0 đã refactor toàn bộ god-file `src/lib/ai.ts` từ **2291 dòng → 70 dòng** (re-export hub) + **24 module độc lập** dưới `src/lib/ai/`. Mỗi module có trách nhiệm đơn nhất, có thể test và phát triển độc lập. Tổng cộng **36 enterprise features** đã được triển khai (xem [danh sách đầy đủ](#-36-enterprise-features)).

---

## 🤖 15 AI Agents

### 10 Core Agents (pipeline chính)

| # | Agent | Section | Nhiệm vụ |
|---|---|---|---|
| 01 | **Requirement Analyst** | `analysis` | Phân tích chủ đề → tech stack, features, actors, modules |
| 02 | **HR Planner** | `hr` | Phân vai trò cho từng thành viên dựa trên ưu/nhược điểm |
| 03 | **Sprint Planner** | `sprint` | Chia sprint 2 tuần, gán task, deadline, milestones |
| 04 | **System Architect** | `design` | Thiết kế database schema, API endpoints, folder structure |
| 05 | **UML Generator** | `uml` | Sinh 4 diagram: Use Case, Class, ERD, Sequence (Mermaid + React Flow) — **enterprise-grade prompt**, đọc analysis/design/sprint, self-validate, no hallucination |
| 06 | **Technical Writer** | `docs` | Viết README, Coding Convention, API Standard |
| 07 | **Git/DevOps** | `git` | Git commands, branch strategy, issue template, CI/CD |
| 08 | **Software Tester** | `test` | Unit/integration/E2E/API/performance tests + bug report |
| 09 | **Security Reviewer** | `security` | Threats, auth flow, OWASP Top 10, rate limit, secrets |
| 10 | **Quality Reviewer** | (all) | Tổng hợp + đồng bộ 9 sections, Zod validation, feedback loop |

### 5 Plugin Agents (mở rộng, đăng ký qua Plugin Registry)

| Plugin | Vai trò |
|---|---|
| **Planner Agent** | Phase 0 — phân rã chủ đề thành modules trước khi Analysis chạy |
| **Business Analyst** | Phân tích business rules, domain logic, workflows độc lập với requirement |
| **Database Designer** | Chuyên viên DB — chỉ thiết kế schema, indexes, relations |
| **API Designer** | Chuyên viên API — REST/GraphQL endpoints, request/response schemas |
| **UI/UX Designer** | Wireframes, screen flows, user journeys, accessibility guidelines |

### Auxiliary Agents (chạy trong pipeline)

| Agent | Module |
|---|---|
| **Task Generator** | `ai/pipeline/taskGen.ts` — sinh SMART todolist (dedup by title+assignee) |
| **Chat Assistant** | `ai/pipeline/taskGen.ts` — AI hội thoại trong project chat |
| **AI Refine** | `ai/pipeline/refine.ts` — tái sinh sections theo yêu cầu leader |
| **Reflection Agent** | `ai/pipeline/reflection.ts` — rule-based quality review (no LLM call) |
| **Memory Agent** | `ai/memory/memoryService.ts` — ghi shared memory sau mỗi agent |
| **Retrieval Agent** | `ai/memory/memoryService.ts` — truy xuất context liên quan trước khi agent chạy |
| **3 Consensus Reviewers** | `ai/pipeline/consensus.ts` — Architect + QA + Security (≥2/3 approve) |

---

## 🔄 Pipeline (8 giai đoạn)

| Phase | Agents | Chế độ |
|---|---|---|
| **Phase 0 — Planner** | Planner Agent | Decompose topic → modules (trước Analysis) |
| **Phase 1 — Analysis** | 01 → 02 → 03 | Sequential (mỗi agent phụ thuộc cái trước) |
| **Phase 2 — Design** | 04 + 05 + 06 + 07 | Parallel (mặc định) hoặc Sequential |
| **Phase 3 — Quality Gates** | 08 + 09 | Parallel hoặc Sequential |
| **Phase 4 — Retry** | Các agent thất bại | Retry 1 lần sau 5s |
| **Phase 5 — Fallback** | Agent vẫn fail | Sinh dữ liệu tĩnh (không crash) |
| **Phase 5.5 — Normalize + Consistency** | Normalizer | Trim, dedup, validate cross-section (HR ↔ members) |
| **Phase 6 — Quality Review** | Agent 10 + Metrics | Tổng hợp + đồng bộ + log per-model success rate |

> Mỗi agent có **3-9 free models** OpenRouter với retry 5 lần/model, full-jitter backoff, và fallback tĩnh nếu tất cả model fail. **429 rate-limit** → wait **60s + jitter** rồi retry (áp dụng cho mọi model). Multi-key rotation tự động khi bị 429.

---

## ✨ Tính năng nổi bật

### 📊 Dashboard & Views
- **Trang tổng quan (Home)** — Dashboard với 3 widget realtime (toàn bộ data thật từ DB):
  - **Recent Activity** — Feed hoạt động từ `ActivityLog` (20+ event types)
  - **NEXUS AI Status** — Agent/API key/Pipeline/DB/Storage status realtime
  - **Tasks đang làm** — Task in_progress/overdue/due_soon của user
- **All Projects** — Premium SaaS dashboard: stats cards, search, filter, sort, grid/list toggle, context menu (favorite/archive/duplicate/delete)
- **Input** — Tạo project form (topic, description, purpose, tech prefs, members, deadline, priority, tags, cover color)
- **Workspace** — Project workspace với **13 sidebar tabs**
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
- **Dedup + comprehensiveness check** — không sinh task trùng lặp (by title+assignee), đảm bảo đủ layer (DATABASE/BACKEND/UI/CONFIG/TESTING)
- **Developer-First model** — mỗi task có: `layer` (DATABASE/BACKEND/UI/CONFIG/TESTING), `targetFile`, `implementationSteps[]`, `technicalHints` (snippet + note)
- **Kanban board** — drag & drop 4 cột: `todo` / `in_progress` / `review` / `done` (qua `@hello-pangea/dnd`)
- **Task statistics** cache (`TaskStatistic` model)

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
- **Sonner toasts** qua unified Notification Provider (`src/lib/notify.ts`)
- **shadcn/ui (New York)** — 48 components
- **Lenient Zod schemas** — `toString` / `toStringArray` / `toNumber` preprocessors xử lý biến thể output AI

---

## 🧠 24-Module AI Architecture

```
src/lib/ai.ts (70 dòng — re-export hub)
│
└── src/lib/ai/  (24 module độc lập)
    │
    ├── config/
    │   └── constants.ts            — Config + helpers (timeout, jitter, compression)
    │
    ├── prompts/
    │   └── index.ts                — 10 agent system prompts (enterprise UML prompt)
    │
    ├── agents/
    │   └── definitions.ts          — AgentDef[] + model priority lists + MIN_KEYS
    │
    ├── utils/
    │   ├── helpers.ts              — buildCtx, buildReviewSummary, isValidSchema
    │   ├── jfix.ts                 — JSON repair utility
    │   ├── diff.ts                 — Change Impact Analyzer (diffSections + analyzeImpact)
    │   ├── versionManager.ts       — Artifact versioning (saveVersion, getVersionHistory)
    │   └── dependencyAnalyzer.ts   — Dependency Analyzer + Artifact Reviewer + Prompt Optimizer
    │
    ├── contracts/
    │   ├── agent.ts                — AgentContract interface (AgentManifest, AgentInput, AgentOutput)
    │   └── registry.ts             — Plugin Registry (singleton, auto-discovery)
    │
    ├── plugins/
    │   └── index.ts                — 15 Agent Plugins (10 core + 5 new) — register via registry
    │
    ├── core/
    │   ├── eventBus.ts             — Event Bus (EventEmitter pub/sub, no Redis)
    │   └── workflow.ts             — Workflow DSL (declarative pipeline, NEXUS_WORKFLOW)
    │
    ├── memory/
    │   └── memoryService.ts        — Shared Memory + Memory Agent + Retrieval Agent (no Vector DB)
    │
    ├── cache/
    │   └── semanticCache.ts        — Semantic Cache (cosine similarity, no Vector DB)
    │
    ├── queue/
    │   └── taskQueue.ts            — Distributed Queue (in-memory worker pool, no Redis)
    │
    └── pipeline/
        ├── runner.ts               — callModel + callAndParse (Priority Sorting + Self-Critic + AI self-fix)
        ├── fallback.ts             — Fallback data generators
        ├── taskGen.ts              — Task generation (dedup) + Chat assistant
        ├── refine.ts               — AI Refine sections
        ├── reflection.ts           — Reflection Agent (rule-based quality review)
        ├── index.ts                — Main pipeline orchestrator (8 phases)
        ├── dag.ts                  — DAG Workflow Engine (dependency graph)
        └── consensus.ts            — Multi-Reviewer Consensus (3 reviewers, ≥2/3 approve)
```

> 📐 **Chi tiết từng module + data flow:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 🏆 36 Enterprise Features

| # | Feature | Module | Mô tả |
|---|---|---|---|
| 1 | **God File Refactor** | `ai.ts` (hub) | 2291 → 70 dòng, 24 module độc lập |
| 2 | **Circuit Breaker** | `lib/openrouter.ts` | 3 failures → open → half-open (3 phút cooldown) |
| 3 | **Dead Model Recovery** | `lib/openrouter.ts` | Auto-mark dead + auto-recovery sau 2 phút |
| 4 | **Health Score** | `lib/openrouter.ts` | `getModelHealth(model)` — success rate + total calls |
| 5 | **Priority Model** | `pipeline/runner.ts` | Sort models by success rate (best first) |
| 6 | **Adaptive Timeout** | `config/constants.ts` | Per-model timeout (90s–300s) |
| 7 | **Context Compression** | `config/constants.ts` | Truncate long JSON (head 60% + tail 30%) |
| 8 | **Self-Critic** | `pipeline/runner.ts` | Empty data check (`length < 20`) → retry |
| 9 | **Few-shot Examples** | `config/constants.ts` | `FEW_SHOT_NOTE` — ví dụ DUNG cho AI |
| 10 | **Negative Examples** | `config/constants.ts` | `FEW_SHOT_NOTE` — ví dụ SAI cho AI tránh |
| 11 | **Prompt Cache** | `lib/openrouter.ts` | Cache system prompt per agent+model (save tokens) |
| 12 | **Planner Agent** | `pipeline/index.ts` | Phase 0 — decompose topic thành modules |
| 13 | **Output Normalizer** | `pipeline/index.ts` | Trim strings + dedup arrays + strip null bytes |
| 14 | **Consistency Checker** | `pipeline/index.ts` | Cross-section validation (HR ↔ members) |
| 15 | **DAG Workflow Engine** | `pipeline/dag.ts` | Dependency graph scheduler (max parallelism) |
| 16 | **Multi-Reviewer Consensus** | `pipeline/consensus.ts` | 3 reviewers (Architect + QA + Security), ≥2/3 approve |
| 17 | **Observability/Metrics** | `pipeline/index.ts` | Per-model success rate logging ở cuối pipeline |
| 18 | **Enterprise UML Prompt** | `prompts/index.ts` | Đọc project context, self-validate, no hallucination |
| 19 | **Lenient Zod Schemas** | `lib/schemas.ts` | `toString` / `toStringArray` / `toNumber` preprocessors |
| 20 | **60s Retry for 429** | `pipeline/runner.ts` | 429 → wait 60s + jitter → retry |
| 21 | **Mermaid AI Auto-Fixer** | `nexus/MermaidRenderer.tsx` | 3-tier: regex → aggressive → AI |
| 22 | **Task Dedup** | `pipeline/taskGen.ts` | By `title + assignee` (no duplicates) |
| 23 | **Notification Provider** | `lib/notify.ts` | Unified toast system (success/error/info/copy/promise) |
| 24 | **`bun run run`** | `scripts/run.js` | Cross-platform shortcut (Win/Mac/Linux auto-detect) |
| 25 | **Agent Contract** | `contracts/agent.ts` | TypeScript interface cho mọi agent |
| 26 | **Plugin Registry** | `contracts/registry.ts` | Auto-discovery + register/getById/getByKey/getSorted |
| 27 | **Plugin System** | `plugins/index.ts` | 15 agents (10 core + 5 new), register via `registry.register()` |
| 28 | **Change Impact Analyzer** | `utils/diff.ts` | `diffSections` + `analyzeImpact` (severity low/med/high) |
| 29 | **Version Manager** | `utils/versionManager.ts` | Artifact versioning per section |
| 30 | **Event Bus** | `core/eventBus.ts` | EventEmitter pub/sub (no Redis) |
| 31 | **Workflow DSL** | `core/workflow.ts` | Declarative pipeline (sequential/parallel/conditional/retry/fallback) |
| 32 | **Shared Memory** | `memory/memoryService.ts` | In-memory + DB persistence (no Vector DB) |
| 33 | **Reflection Agent** | `pipeline/reflection.ts` | Rule-based quality review (no LLM, fast + free) |
| 34 | **Dependency Analyzer** | `utils/dependencyAnalyzer.ts` | Orphan / missing / circular detection |
| 35 | **Semantic Cache** | `cache/semanticCache.ts` | Cosine similarity (no Vector DB) |
| 36 | **Distributed Queue** | `queue/taskQueue.ts` | In-memory worker pool + dead letter queue (no Redis) |

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
| **AI** | OpenRouter (multi-key rotation, 3-9 free models/agent, multi-model fallback, 60s retry cho 429) |
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
│   │   ├── ui/                    # shadcn/ui (48 components — KHÔNG sửa)
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
│   │   ├── ai.ts                  # 70-line re-export hub (v6.0 modular)
│   │   ├── ai/                    # 24 AI modules (config, prompts, agents, utils, contracts, plugins, core, memory, cache, queue, pipeline)
│   │   ├── openrouter.ts          # Multi-key rotation + Circuit Breaker + Dead Model + Health Score
│   │   ├── github.ts              # Push + PR
│   │   ├── email.ts               # SMTP (nodemailer)
│   │   ├── notifications.ts       # Notification service broadcaster
│   │   ├── notify.ts              # Unified Notification Provider (toasts)
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
fly deploy                              # Main app (port 3000)
fly deploy -c fly.chat.toml             # Chat service (port 3001)
# Notification service có thể chạy cùng main app hoặc tách riêng
```

> Deploy script tự động: `bash scripts/deploy-fly.sh` — tạo apps + persistent volume + set secrets + build + verify.

### Local với Cloudflare Tunnel (share tạm thời)

```bash
bun run run          # Cross-platform shortcut (tự detect Win/Linux/Mac)
# Hoặc chạy trực tiếp:
./scripts/run-local.sh    # Linux/Mac
./scripts/run-local.bat   # Windows
# → Tự động parse tunnel URL → ghi vào .public-url
```

### Docker

```bash
docker build -t nexus-ai .
docker run -p 3000:3000 -v $(pwd)/db:/app/db nexus-ai
```

> Docker mode KHÔNG chạy chat service (port 3001). Frontend tự fallback sang HTTP polling.

---

## 📚 Documentation

| Document | Mô tả | Audience |
|---|---|---|
| [README.md](README.md) | Overview + cài đặt nhanh + 36 features | Tất cả users |
| [docs/README.md](docs/README.md) | Documentation index | Tất cả |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design + 24-module AI structure + data flow + design decisions | Developers |
| [docs/API.md](docs/API.md) | Full REST API reference (50+ endpoints) | Developers |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev setup, code style, how to extend (Agent / Plugin / Tab / API) | Contributors |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Code of conduct | Tất cả |

---

## 🤝 Contributing

Xem [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) để biết:
- Setup dev environment
- Code style (TypeScript strict, shadcn/ui, Tailwind, lenient Zod)
- Cách thêm AI Agent mới (đã có hướng dẫn từng bước)
- Cách đăng ký Agent Plugin qua `registry.register()`
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
  <strong>NEXUS AI v6.0</strong> — Modular Multi-Agent Project Architect 🤖
</p>
