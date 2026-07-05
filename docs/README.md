# 📚 NEXUS AI Documentation

Tài liệu đầy đủ cho NEXUS AI — Multi-Agent Project Architect.

## 📑 Mục lục

| Document | Mô tả | Audience |
|---|---|---|
| [**README.md**](../README.md) | Overview, features, cài đặt nhanh | Tất cả users |
| [**LOCAL_RUN.md**](../LOCAL_RUN.md) | Hướng dẫn chạy local + Cloudflare Tunnel | Users chạy local |
| [**DEPLOY.md**](../DEPLOY.md) | Deploy Fly.io + Docker | DevOps |
| [**ARCHITECTURE.md**](ARCHITECTURE.md) | System design, data flow, components, design decisions | Developers |
| [**API.md**](API.md) | Full REST API reference (50+ endpoints) | Developers |
| [**CONTRIBUTING.md**](CONTRIBUTING.md) | Dev setup, code style, how to extend | Contributors |
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

### Muốn chạy local + share tạm thời?

Đọc [LOCAL_RUN.md](../LOCAL_RUN.md) để setup Cloudflare Tunnel.

### Muốn deploy?

Đọc [DEPLOY.md](../DEPLOY.md) để deploy lên Fly.io (main app + 2 mini-services) hoặc Docker.

### Developer?

Đọc theo thứ tự:

1. [README.md](../README.md) — overview, features, tech stack
2. [ARCHITECTURE.md](ARCHITECTURE.md) — system design, data flow, design decisions
3. [API.md](API.md) — REST API reference (50+ endpoints)
4. [CONTRIBUTING.md](CONTRIBUTING.md) — code style + cách extend

### Muốn extend?

[CONTRIBUTING.md](CONTRIBUTING.md) có hướng dẫn:
- Thêm AI Agent mới (đã có ví dụ cho Agent-09 Security Reviewer)
- Thêm Model mới vào priority list
- Thêm Workspace Tab mới
- Thêm API Route mới
- Log từ code mới (Live Log Console qua AsyncLocalStorage)
- Thêm Activity event type mới

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                         │
│  React 19 + Next.js 16 (App Router, Turbopack) + Zustand 5     │
│  Tailwind 4 + shadcn/ui (New York) + TanStack Query 5          │
└─────────────────────────────────────────────────────────────────┘
        ↕ HTTP (REST)              ↕ WebSocket (Socket.io)
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  Next.js API Routes      │   │  Mini-services                   │
│  (port 3000, Node.js)    │   │  ├─ chat-service (port 3001)     │
│  50+ REST endpoints      │   │  └─ notification-service (3002)  │
│  + background pipeline   │   │     (HTTP broadcast endpoints)   │
└──────────────────────────┘   └──────────────────────────────────┘
        │                          │
        ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  SQLite (Prisma 6)       │   │  External APIs                   │
│  21 models               │   │  OpenRouter (multi-key, 9 models) │
│                          │   │  GitHub (OAuth + push)            │
│                          │   │  SMTP (nodemailer)                │
└──────────────────────────┘   └──────────────────────────────────┘
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

## 🤖 10 AI Agents

| # | Agent | Section | Mô tả |
|---|---|---|---|
| 01 | Requirement Analyst | `analysis` | Tech stack, features, actors, modules |
| 02 | HR Planner | `hr` | Vai trò, workload, rủi ro |
| 03 | Sprint Planner | `sprint` | Sprints, milestones |
| 04 | System Architect | `design` | DB schema, API, folder structure |
| 05 | UML Generator | `uml` | 4 diagrams (Use Case, Class, ERD, Sequence) |
| 06 | Technical Writer | `docs` | README, Convention, API Standard |
| 07 | Git/DevOps | `git` | Git commands, branch strategy, CI/CD |
| 08 | Software Tester | `test` | Unit/integration/E2E/API/performance tests |
| 09 | Security Reviewer | `security` | Threats, auth flow, OWASP Top 10 |
| 10 | Quality Reviewer | (all) | Tổng hợp + đồng bộ 9 sections |
| — | Task Generator | (Kanban) | SMART tasks + code snippets + dedup |
| — | Chat Assistant | (chat) | AI hội thoại |
| — | AI Refine | (all) | Re-generate sections |

### Pipeline (6 phases)

| Phase | Mô tả |
|---|---|
| **Phase 1** | Analysis sequential (01 → 02 → 03) |
| **Phase 2** | Design parallel/sequential (04 + 05 + 06 + 07) |
| **Phase 3** | Quality gates (08 + 09) |
| **Phase 4** | Retry failed agents (1 lần, sau 5s) |
| **Phase 5** | Fallback cho agent vẫn fail (dữ liệu tĩnh) |
| **Phase 6** | Quality Reviewer (Agent 10) tổng hợp + đồng bộ |

👉 Chi tiết: [ARCHITECTURE.md → Multi-Agent Pipeline](ARCHITECTURE.md#-multi-agent-pipeline)

---

## 📊 Dashboard Widgets

Trang tổng quan (Home view) có 3 widget realtime:

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

21 models (SQLite via Prisma):

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
| **Backend** | Next.js API Routes (Node.js runtime) |
| **Database** | Prisma 6 ORM + SQLite |
| **AI** | OpenRouter (multi-key rotation, 9 free models/agent) |
| **Realtime** | Socket.io (chat 3001 + notifications 3002) |
| **Diagrams** | Mermaid.js 11 + React Flow 11 |
| **Kanban** | @hello-pangea/dnd 18 |
| **Email** | Nodemailer 9 (SMTP), @mdxeditor/editor (rich text) |
| **Forms** | react-hook-form 7 + zod 4 |
| **Runtime** | Bun 1 |

---

## 📞 Support

- **Issues:** https://github.com/vanhoi04082006-pixel/Nexus-AI/issues
- **Docs:** Bạn đang ở đây 👋

---

[← Về README](../README.md)
