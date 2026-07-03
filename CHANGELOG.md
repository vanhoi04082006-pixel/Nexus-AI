# 📋 Changelog

Tất cả thay đổi đáng chú ý của NEXUS AI sẽ được ghi ở đây.

Format dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 🆕 **Agent 08: Software Tester** — sinh test plan (unit/integration/E2E/API/performance tests + bug report template). Models: qwen3-coder → gpt-oss-120b → north-mini-code → laguna-m.1 → nemotron-3-super → gemma-4-31b → gpt-oss-20b (temp 0.20)
- 🆕 **Agent 09: Security Reviewer** — phân tích threats, auth flow, OWASP Top 10 checklist, rate limiting, secrets management. Models: gpt-oss-120b → qwen3-next-80b → nemotron-ultra → hermes-3-405b → llama-3.3-70b → gemma-4-31b → nemotron-3-nano-30b (temp 0.15)
- 📄 **docs/TEST_PLAN.md** + **docs/SECURITY.md** — được push lên GitHub repo khi leader bấm "Push to GitHub"

### Changed
- 🔢 **Renumber Reviewer 08 → 10** — Quality Reviewer giờ là Agent 10, chạy cuối cùng sau 9 section agents
- 🏗️ **Pipeline Phase 3 mới** — test + security chạy song song SAU Phase 2 (design/uml/docs/git) vì cần DB tables + API endpoints từ design
- 📊 Cập nhật model priority table trong README.md + ARCHITECTURE.md cho 10 agents
- 🤖 Reviewer prompt giờ nhận 9 sections (thêm test + security) thay vì 7

### Planned
- 🌐 i18n (Vietnamese / English)
- 📊 Analytics dashboard (task progress, burn-down chart)
- 🧪 Automated tests (Jest + Playwright)
- 📱 PWA (mobile app)
- 🔔 Push notifications

---

## [1.2.0] — 2026-07-02

### Added
- 🤖 **Agent Model Priority v2** — mở rộng danh sách model cho mỗi agent từ 3-5 lên 7-9 model free trên OpenRouter, tối ưu fallback khi rate-limit

### Changed
- 🧹 **Xóa hoàn toàn DeepSeek** khỏi codebase (openrouter.ts: xóa `callDeepSeek`, `DEEPSEEK_KEYS`, `DEEPSEEK_MODEL_MAP`, `dsRateLimited`; pipeline-progress.ts: xóa `dsRateLimited` khỏi GlobalStore; types: xóa `"deepseek"` khỏi provider union)
- 📊 Cập nhật model priority table trong README.md + ARCHITECTURE.md theo v2

### Planned
- 🌐 i18n (Vietnamese / English)
- 📊 Analytics dashboard (task progress, burn-down chart)
- 🧪 Automated tests (Jest + Playwright)
- 📱 PWA (mobile app)
- 🔔 Push notifications

---

## [1.1.0] — 2026-07-02

### Added
- 📊 **Live Log Console cho Init + Refine** — `TaskProcessingOverlay` component mới, hiển thị "AI đang làm gì" panel + live log console khi sinh todolist và AI Refine
- 🔧 **AsyncLocalStorage multi-context** — `runWithProjectLog` / `runWithInitLog` / `runWithRefineLog` route log tự động đến đúng tracker (pipeline/init/refine)
- 🌍 **globalThis fix** — lưu `progressMap` / `initMap` / `refineMap` / `rateLimitedKeys` / `aiCache` trên `globalThis` để survive Next.js dev recompile (fix 404 trên /progress)
- 📝 Documentation đầy đủ: README.md (rewrite), LOCAL_RUN.md (rewrite), docs/ARCHITECTURE.md, docs/API.md, docs/CONTRIBUTING.md, docs/README.md, CHANGELOG.md, CODE_OF_CONDUCT.md, LICENSE
- 🤖 **8 AI Agents model priority** — mỗi agent có danh sách model riêng (Nemotron, GPT-OSS, Gemma, Cohere, etc.)
- 🔄 **Multi-key rotation** — hỗ trợ không giới hạn số OpenRouter API key
- 🧠 **Long-term Memory** — `ProjectContext` lưu compressed summary
- ⚡ **Parallel Pipeline** — Phase 2 (4 agents) chạy song song
- 🎨 **Interactive Diagrams** — React Flow + Mermaid
- 📋 **SMART Kanban** — task có layer, targetFile, code snippets
- 🔌 **GitHub OAuth** — push 15+ files + PR (không cần PAT)
- 📧 **Email SMTP** — Gmail App Password
- 💬 **Real-time Chat** — Socket.io + polling fallback
- 🐳 **Docker** — standalone multi-stage build

### Removed
- ❌ **DeepSeek** — xóa khỏi README, LOCAL_RUN.md, .env.example, và toàn bộ code (v2)

---

## [1.0.0] — 2024-07-02

### 🎉 Initial Release

#### Added

**Core Features**
- 🤖 **8 AI Agents** — Requirement Analyst, HR Planner, Sprint Planner, System Architect, UML Generator, Technical Writer, Git/DevOps, Quality Reviewer
- 📊 **Live Log Console** — xem realtime agent nào, model nào, API key nào đang chạy
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
| Unreleased | — | +Agent 08 Software Tester, +Agent 09 Security Reviewer, Reviewer renumber 08→10, Phase 3 pipeline |
| 1.2.0 | 2026-07-02 | Agent Model Priority v2 + xóa DeepSeek khỏi codebase |
| 1.1.0 | 2026-07-02 | Live Log Console (Init + Refine) + docs đầy đủ + multi-context ALS + globalThis fix |
| 1.0.0 | 2024-07-02 | Initial release — 8 AI agents + Live Log Console + Multi-Key |

---

[Unreleased]: https://github.com/vanhoi04082006-pixel/Nexus-AI/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/vanhoi04082006-pixel/Nexus-AI/releases/tag/v1.2.0
[1.1.0]: https://github.com/vanhoi04082006-pixel/Nexus-AI/releases/tag/v1.1.0
[1.0.0]: https://github.com/vanhoi04082006-pixel/Nexus-AI/releases/tag/v1.0.0
