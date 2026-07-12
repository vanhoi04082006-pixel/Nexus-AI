# 📋 Changelog

> Tất cả thay đổi đáng chú ý của NEXUS AI sẽ được ghi ở file này.
> Format theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning theo [SemVer](https://semver.org/).

---

## [Unreleased]

### Planned
- Automated tests (Jest + Playwright)
- i18n đa ngôn ngữ (next-intl)
- Vector DB integration (pgvector) cho semantic cache
- Redis cho distributed queue (hiện in-memory)
- PWA (Progressive Web App) support

---

## [0.3.0] — 2026-07-09

### ✨ Added — Split Architecture
- **Split Prompt + Merge Output** — 3 agent phức tạp (`design`, `uml`, `docs`) tách thành **3 sub-task** riêng (Single Responsibility), chạy song song rồi merge kết quả
  - `design` → DB schema + API endpoints + Architecture
  - `uml` → Use Case + Class/ERD + Sequence
  - `docs` → README + Coding Convention + API Standard
- **Sub-task validation** — mỗi sub-task có Zod schema riêng, fail 1 sub-task chỉ fallback sub-task đó (không mất cả agent)
- **Smart Context Retrieval** — `buildCtx()` cải thiện: include analysis + hr + sprint output làm context cho phase 2, giảm hallucination

### ✨ Added — Self-Healing Mermaid
- **`cleanMermaidSyntax()`** — strip markdown fence, fix case-sensitive keywords (`ClassDiagram` → `classDiagram`), normalize whitespace
- **`healUMLData()`** — chạy tự động trong Phase 5.5, repair UML data sau khi Zod pass nhưng Mermaid syntax vẫn lỗi
- **Zod schemas với Mermaid `.refine()`** — reject plain text, require prefix `classDiagram` / `erDiagram` / `sequenceDiagram` / `usecase`

### ✨ Added — 4 New Views
- **KnowledgeBaseView** — browse tất cả project output theo section, full-text search
- **WorkflowView** — visualize pipeline 8 phase realtime (DAG nodes + progress)
- **SettingsView** — config OpenRouter keys, model preference, theme, language
- **IntegrationsView** — manage GitHub OAuth, SMTP, webhook integrations

### ✨ Added — Security
- **Rate limiting** — in-memory token bucket per IP + per route (`src/lib/rate-limit.ts`)
- **OAuth nonce** — GitHub OAuth state nonce chống CSRF (`src/lib/github-oauth.ts`)
- **AES-256-GCM encryption** — GitHub access token encrypt trước khi lưu DB, key từ `GITHUB_TOKEN_ENCRYPTION_KEY`
- **XSS sanitization** — `src/lib/sanitize.ts` strip `<script>`, event handlers, javascript: URLs

### 🔧 Fixed
- **MermaidLoader `removeChild` error** — convert sang Client Component (`"use client"`), load Mermaid.js từ CDN trong `useEffect`, cleanup proper trong unmount
- **Fix all "8 AI Agents" → "10 AI Agents"** UI text — scan toàn bộ components/tabs, sidebar, landing page, docs
- **Rich fallback cho Git + Test agents** — fallback không còn rỗng, sinh git commands + test templates thực dụng từ analysis data
- **UML "quá phức tạp" error** — `cleanMermaidSyntax` + `healUMLData` auto-repair trước khi render, không còn 502

### 🛡️ Anti-rate-limit (preserved)
- Circuit Breaker (3 fails → skip 3 min)
- Dead Model Recovery (cooldown 2 min, auto-recover)
- Health Score (priority sort by success rate — preserved across restarts)
- Multi-key rotation (auto-switch on 429)
- 60s wait cho 429 rate-limit
- In-memory prompt cache (1h TTL)
- Adaptive timeout per model
- Structured Outputs (`response_format: json_object`)
- Response healing plugin

### 🏗️ Architecture (preserved)
- Modular AI: 24 module trong `src/lib/ai/` + hub `src/lib/ai.ts`
- **10 AI Agents** (Phase 0 Planner → Phase 6 Quality Reviewer)
- 23 Prisma models (SQLite)
- 42 API routes (~58 endpoints)
- 2 mini-services (chat 3001, notification 3002)
- DAG Workflow Engine, Multi-Reviewer Consensus, Reflection Agent
- Semantic Cache (cosine similarity), Distributed Queue (in-memory)
- Event Bus, Workflow DSL, Shared Memory

---

## [0.2.0] — 2026-07-08

### ✨ Added
- Lệnh `run` global (Windows) — gõ `run` từ project root để chạy Next.js + tunnel
- **ErrorBoundary** — React class error boundary với retry + home fallback
- **Next.js error pages** — `error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`
- **Reusable states** — `EmptyState`, `RetryState`, `LoadingState` (4 skeleton variants)
- **NotificationProvider** — Sonner toast với typed `notify` API
- **Lazy-loaded tabs** — 13 tabs code splitting + Suspense fallback
- **CSS optimizations** — smooth scroll, thin scrollbar, `prefers-reduced-motion`, content-visibility, GPU hints, skeleton shimmer, focus-visible ring
- Config files — `.editorconfig`, `.nvmrc`, `.prettierrc.json`
- Docs rewrite (README, ARCHITECTURE, API, CONTRIBUTING, CoC, CHANGELOG)

### 🔧 Fixed
- `bun run run` trên Windows — rewrite `scripts/run.js` cross-platform
- Todolist duplicate tasks — apply dedup cho ALL code paths, fuzzy normalize title
- DocsTab trống — fallback `docs` giờ sinh đầy đủ README + Coding Convention + API Standard
- UML "quá phức tạp" error — `fix-mermaid` route return simple fallback diagram khi AI fix fail (429)
- HistoryTab 500 log limit — tăng cap 500 → 2000, lưu full live logs vào `ActivityLog.details`

---

## [0.1.0] — 2026-07-01

### ✨ Added
- **Khởi tạo dự án NEXUS AI** — Multi-Agent Project Architect
- **10 AI Agents** — Requirement Analyst, HR Planner, Sprint Planner, System Architect, UML Generator, Technical Writer, Git/DevOps, Software Tester, Security Reviewer, Quality Reviewer
- **Pipeline 6 phase** — sequential + parallel + retry + fallback + quality review
- **23 Prisma models** — Project, Member, Analysis, Task, ChatMessage, Email, Notification, ActivityLog, etc.
- **OpenRouter multi-key rotation** — anti-rate-limit với dead model cache + circuit breaker
- **13 workspace tabs** — Analysis, HR, Sprint, Design, UML, Docs, Git, Chat, Members, Tasks, Mailbox, History, AgentHub
- **Mail System** — compose + AI rewrite + attachments + SMTP delivery
- **Notification Center** — per-user read tracking, 13 notification types, realtime via Socket.io
- **GitHub integration** — OAuth + push project to repo
- **Live Log Console** — AsyncLocalStorage cho realtime logs trong pipeline
- **Dashboard widgets** — Recent Activity, System Status, Tasks
- **Dark mode** — next-themes
- **Mermaid 11** — UML diagrams (Use Case, Class, ERD, Sequence) qua CDN
- **2 mini-services** — chat-service (Socket.io), notification-service (Socket.io)
- **Deployment** — Docker + Fly.io + Caddy + Cloudflare/ngrok tunnel

### 🛠️ Tech Stack
- Next.js 16.1.3 (App Router, Turbopack) · React 19 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui (48 components) · Prisma 6 (SQLite)
- Zustand + TanStack Query/Table · Framer Motion 12
- mermaid 11 + reactflow · socket.io-client · next-auth + next-intl
- nodemailer (SMTP) · zod 4 (lenient schemas) · z-ai-web-dev-sdk

---

## Versioning

- **MAJOR** — breaking changes (API, schema, UI flow)
- **MINOR** — new features (backward compatible)
- **PATCH** — bug fixes (backward compatible)

## Links

- [GitHub Releases](https://github.com/vanhoi04082006-pixel/Nexus-AI/releases)
- [Compare versions](https://github.com/vanhoi04082006-pixel/Nexus-AI/compare)
