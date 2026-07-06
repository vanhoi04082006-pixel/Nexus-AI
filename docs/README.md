# 📚 NEXUS AI Documentation — v6.0

Tài liệu đầy đủ cho NEXUS AI — Multi-Agent Project Architect (kiến trúc modular 24 module + 36 enterprise features).

## 📑 Mục lục

| Document | Mô tả | Audience |
|---|---|---|
| [**README.md**](../README.md) | Overview, 36 features, 24-module architecture, cài đặt nhanh (kèm `bun run run` shortcut) | Tất cả users |
| [**ARCHITECTURE.md**](ARCHITECTURE.md) | System design, **24-module AI structure**, data flow, 36 features chi tiết, design decisions | Developers |
| [**API.md**](API.md) | Full REST API reference (50+ endpoints) | Developers |
| [**CONTRIBUTING.md**](CONTRIBUTING.md) | Dev setup, code style, how to extend (Agent / Plugin / Tab / API / Notification / Activity) | Contributors |
| [**../CODE_OF_CONDUCT.md**](../CODE_OF_CONDUCT.md) | Code of conduct | Tất cả |
| [**chat-service/README.md**](../mini-services/chat-service/README.md) | Socket.io chat service protocol (port 3001) | Developers |
| [**notification-service**](../mini-services/notification-service/index.ts) | Socket.io notification service (port 3002) — xem code comment | Developers |

---

## 🚀 Quick Start

### New user?

Đọc [README.md](../README.md) để biết NEXUS AI là gì + cài đặt:

```bash
bun install
cp .env.example .env   # Điền OPENROUTER_API_KEY
bun run db:push
bun run dev            # → http://localhost:3000
```

### Muốn chạy local + share tạm thời (1 lệnh)?

```bash
bun run run           # Cross-platform: tự detect Windows/Linux/Mac
                      # → Chạy dev + mở Cloudflare Tunnel/ngrok
                      # → Ghi tunnel URL vào .public-url (cho email links)
```

> `scripts/run.js` tự detect OS → Windows chạy `scripts/run-local.bat`, Linux/Mac chạy `scripts/run-local.sh`. Nếu chỉ cần local không tunnel → dùng `bun run dev`.

### Muốn deploy?

- **Fly.io:** `fly deploy` (main app port 3000) + `fly deploy -c fly.chat.toml` (chat port 3001) — có script `bash scripts/deploy-fly.sh`
- **Docker:** `docker build -t nexus-ai . && docker run -p 3000:3000 -v $(pwd)/db:/app/db nexus-ai`
- Chi tiết xem mục [Deployment trong README](../README.md#-deployment)

### Developer?

Đọc theo thứ tự:

1. [README.md](../README.md) — overview, features, tech stack, 24-module structure
2. [ARCHITECTURE.md](ARCHITECTURE.md) — system design, 24 AI modules, data flow, 36 enterprise features, design decisions
3. [API.md](API.md) — REST API reference (50+ endpoints)
4. [CONTRIBUTING.md](CONTRIBUTING.md) — code style + cách extend

### Muốn extend?

[CONTRIBUTING.md](CONTRIBUTING.md) có hướng dẫn:
- Thêm AI Agent mới (đã có ví dụ cho Agent-11 Performance Engineer)
- Đăng ký Agent Plugin qua `registry.register()`
- Thêm Model mới vào priority list
- Thêm Workspace Tab mới
- Thêm API Route mới
- Log từ code mới (Live Log Console qua AsyncLocalStorage)
- Thêm Activity event type mới
- Thêm Notification type mới

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                         │
│  React 19 + Next.js 16 (App Router, Turbopack) + Zustand 5     │
│  Tailwind 4 + shadcn/ui (New York) + TanStack Query 5          │
│  Framer Motion 12 + Mermaid 11 (CDN) + React Flow 11           │
└─────────────────────────────────────────────────────────────────┘
        ↕ HTTP (REST)              ↕ WebSocket (Socket.io)
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│  Next.js API Routes              │   │  Mini-services                   │
│  (port 3000, Node.js)            │   │  ├─ chat-service (port 3001)     │
│  50+ REST endpoints              │   │  └─ notification-service (3002)  │
│  + background pipeline           │   │     (HTTP broadcast endpoints)   │
└──────────────────────────────────┘   └──────────────────────────────────┘
        │                                       │
        ▼                                       ▼
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│  src/lib/ai.ts (70-line hub)     │   │  External APIs                   │
│  └── src/lib/ai/ (24 modules)    │   │  OpenRouter (multi-key, 3-9 model)│
│      • config / prompts / agents │   │  GitHub (OAuth + push)            │
│      • utils / contracts / plugins│  │  SMTP (nodemailer)                │
│      • core / memory / cache     │   └──────────────────────────────────┘
│      • queue / pipeline (8 file) │
│      → 36 enterprise features    │
└──────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│  SQLite (Prisma 6)               │
│  23 models                       │
└──────────────────────────────────┘
```

👉 Chi tiết: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🔌 API Overview

50+ REST endpoints, nhóm theo 16 category:

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

👉 Chi tiết: [API.md](API.md)

---

## 🤖 15 AI Agents

### 10 Core Agents (pipeline chính)

| # | Agent | Section | Mô tả |
|---|---|---|---|
| 01 | Requirement Analyst | `analysis` | Tech stack, features, actors, modules |
| 02 | HR Planner | `hr` | Vai trò, workload, rủi ro |
| 03 | Sprint Planner | `sprint` | Sprints, milestones |
| 04 | System Architect | `design` | DB schema, API, folder structure |
| 05 | UML Generator | `uml` | 4 diagrams (Use Case, Class, ERD, Sequence) — **enterprise prompt** |
| 06 | Technical Writer | `docs` | README, Convention, API Standard |
| 07 | Git/DevOps | `git` | Git commands, branch strategy, CI/CD |
| 08 | Software Tester | `test` | Unit/integration/E2E/API/performance tests |
| 09 | Security Reviewer | `security` | Threats, auth flow, OWASP Top 10 |
| 10 | Quality Reviewer | (all) | Tổng hợp + đồng bộ 9 sections |

### 5 Plugin Agents (đăng ký qua `registry.register()`)

| Plugin | Vai trò |
|---|---|
| Planner Agent | Phase 0 — decompose topic thành modules |
| Business Analyst | Business rules, domain logic, workflows |
| Database Designer | DB schema, indexes, relations |
| API Designer | REST/GraphQL endpoints, request/response |
| UI/UX Designer | Wireframes, screen flows, accessibility |

### Auxiliary Agents

| Agent | Mô tả |
|---|---|
| Task Generator | SMART tasks + code snippets + dedup (by title+assignee) |
| Chat Assistant | AI hội thoại trong project chat |
| AI Refine | Re-generate sections theo yêu cầu leader |
| Reflection Agent | Rule-based quality review (no LLM call) |
| Memory Agent | Ghi shared memory sau mỗi agent |
| Retrieval Agent | Truy xuất context liên quan trước khi agent chạy |
| 3 Consensus Reviewers | Architect + QA + Security (≥2/3 approve) |

### Pipeline (8 phases)

| Phase | Mô tả |
|---|---|
| **Phase 0** | Planner Agent — decompose topic thành modules |
| **Phase 1** | Analysis sequential (01 → 02 → 03) |
| **Phase 2** | Design parallel/sequential (04 + 05 + 06 + 07) |
| **Phase 3** | Quality gates (08 + 09) |
| **Phase 4** | Retry failed agents (1 lần, sau 5s) |
| **Phase 5** | Fallback cho agent vẫn fail (dữ liệu tĩnh — không crash) |
| **Phase 5.5** | Output Normalizer + Consistency Checker (HR ↔ members) |
| **Phase 6** | Quality Reviewer (Agent 10) tổng hợp + đồng bộ + Metrics log |

> **429 rate-limit retry:** Trong một model call, nếu bị 429 → wait **60s + jitter** rồi retry (áp dụng cho mọi model, mọi agent).

👉 Chi tiết: [ARCHITECTURE.md → Multi-Agent Pipeline](ARCHITECTURE.md#-multi-agent-pipeline-8-phases)

---

## 🏆 36 Enterprise Features

| # | Feature | Module |
|---|---|---|
| 1 | God File Refactor (2291→70 dòng, 24 module) | `ai.ts` |
| 2 | Circuit Breaker (3 failures → open) | `lib/openrouter.ts` |
| 3 | Dead Model Recovery (auto-recovery sau 2 phút) | `lib/openrouter.ts` |
| 4 | Health Score (getModelHealth per model) | `lib/openrouter.ts` |
| 5 | Priority Model (sort by success rate) | `pipeline/runner.ts` |
| 6 | Adaptive Timeout (per-model 90s-300s) | `config/constants.ts` |
| 7 | Context Compression (truncate long JSON) | `config/constants.ts` |
| 8 | Self-Critic (empty data check) | `pipeline/runner.ts` |
| 9 | Few-shot Examples | `config/constants.ts` |
| 10 | Negative Examples | `config/constants.ts` |
| 11 | Prompt Cache (per agent+model) | `lib/openrouter.ts` |
| 12 | Planner Agent (Phase 0) | `pipeline/index.ts` |
| 13 | Output Normalizer (trim + dedup) | `pipeline/index.ts` |
| 14 | Consistency Checker (HR ↔ members) | `pipeline/index.ts` |
| 15 | DAG Workflow Engine (dependency graph) | `pipeline/dag.ts` |
| 16 | Multi-Reviewer Consensus (3 reviewers, ≥2/3) | `pipeline/consensus.ts` |
| 17 | Observability/Metrics (per-model success rate) | `pipeline/index.ts` |
| 18 | Enterprise UML Prompt (self-validate) | `prompts/index.ts` |
| 19 | Lenient Zod Schemas (toString/Array/Number) | `lib/schemas.ts` |
| 20 | 60s Retry for 429 | `pipeline/runner.ts` |
| 21 | Mermaid AI Auto-Fixer (3-tier) | `nexus/MermaidRenderer.tsx` |
| 22 | Task Dedup (by title+assignee) | `pipeline/taskGen.ts` |
| 23 | Notification Provider (unified toast) | `lib/notify.ts` |
| 24 | `bun run run` (cross-platform) | `scripts/run.js` |
| 25 | Agent Contract (TypeScript interface) | `contracts/agent.ts` |
| 26 | Plugin Registry (auto-discovery) | `contracts/registry.ts` |
| 27 | Plugin System (15 agents) | `plugins/index.ts` |
| 28 | Change Impact Analyzer | `utils/diff.ts` |
| 29 | Version Manager | `utils/versionManager.ts` |
| 30 | Event Bus (EventEmitter pub/sub) | `core/eventBus.ts` |
| 31 | Workflow DSL (declarative) | `core/workflow.ts` |
| 32 | Shared Memory (in-memory + DB) | `memory/memoryService.ts` |
| 33 | Reflection Agent (rule-based) | `pipeline/reflection.ts` |
| 34 | Dependency Analyzer (orphan/circular) | `utils/dependencyAnalyzer.ts` |
| 35 | Semantic Cache (cosine similarity) | `cache/semanticCache.ts` |
| 36 | Distributed Queue (worker pool) | `queue/taskQueue.ts` |

👉 Chi tiết: [ARCHITECTURE.md → 36 Enterprise Features](ARCHITECTURE.md#-36-enterprise-features)

---

## 📊 Dashboard Widgets

Trang tổng quan (Home view) có 3 widget realtime (toàn bộ data thật từ DB):

| Widget | Data source | Refresh |
|---|---|---|
| **Recent Activity** | `ActivityLog` (20+ event types) | WebSocket `activity:new` |
| **NEXUS AI Status** | `AgentStatus`, `PipelineStatus`, `SystemStatus` + env keys | WebSocket `status:update` |
| **Tasks đang làm** | `Task` (in_progress/overdue/due_soon của user) | WebSocket `task:update` |

👉 Chi tiết: [ARCHITECTURE.md → Dashboard Widgets](ARCHITECTURE.md#-dashboard-widgets)

---

## 🔔 Notification & Mail System

| System | Port | Cơ chế |
|---|---|---|
| **Notification Center** | 3002 (notification-service) | 13 types, per-user read, realtime broadcast |
| **Mail System** | SMTP + REST | Compose + AI rewrite + 7 folders + attachments + reply/forward |
| **Realtime Chat** | 3001 (chat-service) | Socket.io, fallback HTTP polling |
| **Notification Provider** | — | `lib/notify.ts` — unified toast (success/error/info/copy/promise) |

👉 Chi tiết: [ARCHITECTURE.md → Notification & Mail](ARCHITECTURE.md#-notification--mail-system)

---

## 📐 Mermaid Rendering (3-tier fix)

Khi render Mermaid diagram gặp lỗi syntax:

1. **`fixMermaid()`** — regex fix nhanh (lỗi phổ biến)
2. **`aggressiveFix()`** — fix mạnh (node ID normalization, dấu tiếng Việt → ASCII)
3. **AI Auto-Fix** — POST `/api/projects/[id]/fix-mermaid` → AI sửa syntax qua OpenRouter

👉 Chi tiết: [ARCHITECTURE.md → Mermaid Rendering](ARCHITECTURE.md#-mermaid-rendering-3-tier-fix)

---

## 🗄️ Database Schema

23 models (SQLite via Prisma):

```
Project ─┬─ Member
         ├─ Analysis (versioned, 9 section types)
         ├─ Task (Kanban + developer-first fields)
         ├─ ChatMessage
         ├─ EditProposal
         ├─ EmailLog (legacy)
         ├─ Email → EmailAttachment
         │        → Mailbox (per-user state)
         │        → MailRead (audit)
         ├─ Notification → NotificationRead (per-user)
         ├─ ActivityLog (enriched with actor + relations)
         ├─ TaskLog (audit trail)
         ├─ AgentConfig
         ├─ ProjectContext (long-term memory)
         ├─ TokenLog (cost tracking)
         ├─ AgentStatus (live agent state)
         ├─ PipelineStatus (per project)
         └─ TaskStatistic (cached aggregate)

SystemStatus (singleton per subsystem)
Template (project blueprints)
```

👉 Chi tiết: [prisma/schema.prisma](../prisma/schema.prisma) | [ARCHITECTURE.md → Database](ARCHITECTURE.md#-database-schema)

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
| **AI** | OpenRouter (multi-key rotation, 3-9 free models/agent, 60s retry cho 429) |
| **Realtime** | Socket.io (chat 3001 + notifications 3002) |
| **Diagrams** | Mermaid.js 11 (CDN) + React Flow 11 |
| **Kanban** | @hello-pangea/dnd 18 |
| **Email** | Nodemailer 9 (SMTP), @mdxeditor/editor (rich text) |
| **Forms** | react-hook-form 7 + zod 4 (lenient preprocessors) |
| **Runtime** | Bun 1 |

---

## 📞 Support

- **Issues:** https://github.com/vanhoi04082006-pixel/Nexus-AI/issues
- **Docs:** Bạn đang ở đây 👋

---

[← Về README](../README.md)
