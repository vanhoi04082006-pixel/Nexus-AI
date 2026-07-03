# 📋 Changelog

Tất cả thay đổi đáng chú ý của NEXUS AI sẽ được ghi ở đây.

Format dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- 🌐 i18n (Vietnamese / English)
- 📊 Analytics dashboard (task progress, burn-down chart)
- 🧪 Automated tests (Jest + Playwright)
- 📱 PWA (mobile app)
- 🔔 Push notifications

---

## [1.0.0] — 2024-07-02

### 🎉 Initial Release

#### Added

**Core Features**
- 🤖 **8 AI Agents** — Requirement Analyst, HR Planner, Sprint Planner, System Architect, UML Generator, Technical Writer, Git/DevOps, Quality Reviewer
- 🔄 **Multi-Key Rotation** — hỗ trợ không giới hạn số OpenRouter API key, tự luân chuyển khi 1 key bị rate-limit
- 📊 **Live Log Console** — xem realtime agent nào, model nào, API key nào đang chạy (3 chế độ: Pipeline / Init / Refine)
- 🧠 **Long-term Memory** — `ProjectContext` lưu compressed summary, AI nhớ dự án giữa các session
- ⚡ **Parallel Pipeline** — Phase 2 (4 agents) chạy song song → giảm 40% thời gian
- 🎨 **Interactive Diagrams** — React Flow kéo thả cho Class + ERD, Mermaid cho Use Case + Sequence
- 📋 **SMART Kanban** — Task có layer, target file, code snippet, implementation steps, dependencies
- 🔌 **GitHub OAuth** — push 15+ files lên repo mới, tạo branch + PR (không cần PAT)
- 📧 **Email SMTP** — Gmail App Password, gửi lời mời + task assigned + deadline reminder
- 💬 **Real-time Chat** — Socket.io + HTTP polling fallback, AI Assistant, AI Refine
- 📝 **Edit Proposals** — member đề xuất chỉnh sửa, leader approve → AI apply
- 🏠 **Project History** — home page list tất cả projects, reopen workspace
- 🐳 **Docker** — standalone Dockerfile (multi-stage build)

**Technical**
- AsyncLocalStorage cho log context (không传 tham số qua 10 layers)
- globalThis cho in-memory maps (survive Next.js dev recompile)
- In-memory cache (1h TTL) cho low-temperature API calls
- Token-based auth (no session — leaderToken + inviteToken)
- 23 REST API endpoints
- 9 Prisma models (Project, Member, Analysis, Task, ChatMessage, EditProposal, EmailLog, ProjectContext, TokenLog)

**UI/UX**
- Dark theme teal accent
- Responsive (mobile + desktop)
- shadcn/ui (40+ components, New York style)
- Zustand persist (form data across reloads)
- beforeunload warning khi AI đang chạy
- Toast notifications (sonner)
- Custom scrollbar styling

**Documentation**
- README.md — comprehensive overview
- LOCAL_RUN.md — setup + Cloudflare Tunnel + troubleshooting
- docs/ARCHITECTURE.md — system design, data flow, design decisions
- docs/API.md — full REST API reference (23 endpoints)
- docs/CONTRIBUTING.md — dev setup, code style, how to extend
- mini-services/chat-service/README.md — Socket.io protocol
- LICENSE (MIT)
- CODE_OF_CONDUCT.md

### Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes (Node.js runtime)
- **Database:** Prisma 6 + SQLite
- **AI:** OpenRouter (multi-key rotation, multi-model fallback)
- **Real-time:** Socket.io 4 + HTTP polling
- **Diagrams:** Mermaid.js 11 + React Flow 11
- **Kanban:** @hello-pangea/dnd 18
- **State:** Zustand 5 (persisted)
- **Email:** Nodemailer 9 (Gmail SMTP)
- **Runtime:** Bun 1

---

## Version History

| Version | Date | Highlights |
|---|---|---|
| 1.0.0 | 2024-07-02 | Initial release — 8 AI agents + Live Log Console + Multi-Key |

---

[Unreleased]: https://github.com/vanhoi04082006-pixel/Nexus-AI/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/vanhoi04082006-pixel/Nexus-AI/releases/tag/v1.0.0
