# 📚 NEXUS AI Documentation

Tài liệu đầy đủ cho NEXUS AI — Multi-Agent Project Architect.

## 📑 Mục lục

| Document | Mô tả | Audience |
|---|---|---|
| [**README.md**](../README.md) | Overview, features, cài đặt nhanh | Tất cả users |
| [**LOCAL_RUN.md**](../LOCAL_RUN.md) | Hướng dẫn chạy local + Cloudflare Tunnel | Users chạy local |
| [**ARCHITECTURE.md**](ARCHITECTURE.md) | System design, data flow, components, design decisions | Developers |
| [**API.md**](API.md) | Full REST API reference (23 endpoints) | Developers |
| [**CONTRIBUTING.md**](CONTRIBUTING.md) | Dev setup, code style, how to extend | Contributors |
| [**chat-service/README.md**](../mini-services/chat-service/README.md) | Socket.io chat service protocol | Developers |

---

## 🚀 Quick Start

### New user?

→ Đọc [README.md](../README.md) để biết NEXUS AI là gì + cài đặt.

### Muốn chạy local?

→ Đọc [LOCAL_RUN.md](../LOCAL_RUN.md) để setup + Cloudflare Tunnel.

### Developer?

→ Đọc theo thứ tự:
1. [README.md](../README.md) — overview
2. [ARCHITECTURE.md](ARCHITECTURE.md) — hiểu system design
3. [API.md](API.md) — REST API reference
4. [CONTRIBUTING.md](CONTRIBUTING.md) — code style + extend

### Muốn extend?

→ [CONTRIBUTING.md](CONTRIBUTING.md) có hướng dẫn:
- Thêm AI Agent mới
- Thêm Model mới
- Thêm Workspace Tab mới
- Thêm API Route mới
- Log từ code mới (Live Log Console)

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                         │
│  React 19 + Next.js 16 (App Router) + Zustand              │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTP polling 2.5s + Socket.io
┌─────────────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTES (port 3000)                 │
│  23 REST endpoints + background pipeline                    │
└─────────────────────────────────────────────────────────────┘
              │                          │
              ▼                          ▼
┌──────────────────────────┐  ┌────────────────────────────────┐
│  SQLite (Prisma)         │  │  External APIs                 │
│  9 models                │  │  OpenRouter + GitHub + Gmail   │
└──────────────────────────┘  └────────────────────────────────┘
                                          │
                                          ▼
                              ┌────────────────────────────────┐
                              │  Socket.io Chat Service        │
                              │  (mini-service, port 3001)     │
                              └────────────────────────────────┘
```

👉 Chi tiết: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🔌 API Overview

23 REST endpoints:

| Group | Endpoints | Mô tả |
|---|---|---|
| **Projects** | 4 | CRUD + pipeline trigger |
| **Pipeline Progress** | 1 | Poll pipeline + logs |
| **Initialize** | 2 | Sinh todolist + poll |
| **Refine** | 2 | AI Refine + poll |
| **Tasks** | 2 | List + update status |
| **Chat** | 3 | List + post + AI reply |
| **Edit Proposals** | 3 | List + create + approve |
| **Sections** | 1 | Edit section content |
| **Members** | 2 | List + add |
| **Mailbox** | 1 | List emails sent |
| **Context** | 1 | Long-term memory |
| **Tokens** | 1 | Usage logs |
| **GitHub** | 4 | OAuth + push + PR |
| **Config** | 1 | Public URL |

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
| 07 | Git/DevOps | `git` | Git commands, branch strategy |
| 08 | Software Tester ⭐ | `test` | Unit/integration/E2E/API/performance tests + bug report |
| 09 | Security Reviewer ⭐ | `security` | Threats, auth flow, OWASP Top 10, rate limit, secrets |
| 10 | Quality Reviewer | (all) | Tổng hợp + đồng bộ 9 sections |
| — | Task Generator | (Kanban) | SMART tasks + code snippets |
| — | Chat Assistant | (chat) | AI hội thoại |
| — | AI Refine | (all) | Re-generate sections |

👉 Chi tiết: [ARCHITECTURE.md → Multi-Agent Pipeline](ARCHITECTURE.md#-multi-agent-pipeline)

---

## 📊 Live Log Console

3 chế độ:

| Chế độ | Khi nào | Component |
|---|---|---|
| **Pipeline Overlay** | Tạo project mới | `ProcessingOverlay.tsx` |
| **Init Overlay** | Sinh todolist | `TaskProcessingOverlay.tsx` (mode="init") |
| **Refine Overlay** | AI Refine | `TaskProcessingOverlay.tsx` (mode="refine") |

Mỗi log line:
```
14:23:01 [AGENT-01] [OR] [#1] [OpenRouter] Key #1, model: openai/gpt-oss-120b:free
```

👉 Chi tiết: [ARCHITECTURE.md → Live Log Console](ARCHITECTURE.md#-live-log-console-asynclocalstorage)

---

## 🗄️ Database Schema

9 models (SQLite via Prisma):

```
Project ─┬─ Member
         ├─ Analysis (versioned)
         ├─ Task
         ├─ ChatMessage
         ├─ EditProposal
         ├─ EmailLog
         ├─ ProjectContext (long-term memory)
         └─ TokenLog (cost tracking)
```

👉 Chi tiết: [prisma/schema.prisma](../prisma/schema.prisma) | [ARCHITECTURE.md → Database](ARCHITECTURE.md#-database-schema)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind 4, shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | Prisma 6 + SQLite |
| AI | OpenRouter (multi-key rotation, multi-model fallback) |
| Real-time | Socket.io (optional) + HTTP polling |
| Diagrams | Mermaid.js 11 + React Flow 11 |
| Kanban | @hello-pangea/dnd 18 |
| State | Zustand 5 (persisted) |
| Email | Nodemailer 9 (Gmail SMTP) |
| Runtime | Bun 1 |

---

## 📞 Support

- **Issues:** https://github.com/vanhoi04082006-pixel/Nexus-AI/issues
- **Docs:** Bạn đang ở đây 👋

---

[← Về README](../README.md)
