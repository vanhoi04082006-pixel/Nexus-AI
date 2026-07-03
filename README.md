<div align="center">

# 🤖 NEXUS AI

### Multi-Agent Project Architect

> Hệ thống AI đa tác tử — Nhập chủ đề dự án → 10 AI Agent tự động phân tích, thiết kế, lập sprint, sinh todolist Kanban, push GitHub, gửi email mời thành viên. Có Live Log Console realtime theo dõi từng model / API key.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi--Key-orange)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Bun](https://img.shields.io/badge/Bun-1-f472b6?logo=bun)
![License](https://img.shields.io/badge/License-MIT-green)

[📖 Documentation](docs/) · [🚀 Cài đặt](#-cài-đặt) · [🔧 Cấu hình](#️-cấu-hình-env) · [📐 Architecture](docs/ARCHITECTURE.md) · [🔌 API](docs/API.md)

</div>

---

## 📖 NEXUS AI là gì?

NEXUS AI là một **trợ lý kiến trúc sư dự án** chạy hoàn toàn local (hoặc Docker) — bạn chỉ cần nhập chủ đề + danh sách thành viên, **10 AI Agent** sẽ tự động:

| # | Agent | Nhiệm vụ |
|---|---|---|
| 01 | **Requirement Analyst** | Phân tích chủ đề → tech stack, features, actors, modules |
| 02 | **HR Planner** | Phân vai trò cho từng thành viên dựa trên ưu/nhược điểm |
| 03 | **Sprint Planner** | Chia sprint 2 tuần, gán task, deadline, milestones |
| 04 | **System Architect** | Thiết kế database schema, API endpoints, folder structure |
| 05 | **UML Generator** | Sinh 4 diagram: Use Case, Class, ERD, Sequence (Mermaid + React Flow) |
| 06 | **Technical Writer** | Viết README, Coding Convention, API Standard |
| 07 | **Git / DevOps** | Git commands, branch strategy, issue template |
| 08 | **Software Tester** ⭐ | Sinh test plan: unit, integration, E2E, API, performance tests + bug report template |
| 09 | **Security Reviewer** ⭐ | Phân tích threats, auth flow, OWASP Top 10 checklist, rate limiting, secrets |
| 10 | **Quality Reviewer** | Tổng hợp + đồng bộ tất cả sections |
| — | **Task Generator** | Sinh SMART tasks (Kanban) với code snippets cho từng thành viên |
| — | **Chat Assistant** | AI Assistant tham gia chat hướng dẫn code |

⭐ = **mới** (theo khuyến nghị đánh giá kiến trúc AI)

**Pipeline:** Phân tích → Nhân sự → Sprint → Thiết kế → UML → Tài liệu → Git → Review → Kanban → GitHub → Email

### 🎯 Điểm nổi bật

- **🔄 Multi-Key Rotation** — hỗ trợ không giới hạn số OpenRouter API key, tự luân chuyển khi 1 key bị rate-limit
- **📊 Live Log Console** — xem realtime agent nào đang chạy, model nào, API key nào, thành công / thất bại (như terminal)
- **🧠 Long-term Memory** — AI nhớ dự án qua `ProjectContext`, retry/refine không cần đọc lại từ đầu
- **⚡ Parallel Pipeline** — Phase 2 (4 agents) chạy song song → giảm 40% thời gian
- **🎨 Interactive Diagrams** — React Flow kéo thả cho Class + ERD, Mermaid cho Use Case + Sequence
- **📋 SMART Kanban** — Task có layer, target file, code snippet, implementation steps, dependencies
- **🔌 GitHub OAuth** — push 15+ files lên repo mới, tạo branch + PR (không cần PAT)
- **📧 Email SMTP thật** — Gmail App Password, gửi lời mời + task assigned + deadline reminder

---

## ✨ Tính năng chi tiết

### 🧠 Multi-Agent Pipeline

| Tính năng | Mô tả |
|---|---|
| **Multi-Key Rotation** | Không giới hạn số `OPENROUTER_API_KEY_N` — tự luân chuyển khi 429 |
| **Multi-Model Fallback** | Mỗi agent có danh sách model ưu tiên (Nemotron → GPT-OSS → Gemma → Cohere → fallback data) |
| **Parallel Execution** | Phase 1 tuần tự (Analyst → HR → Sprint), Phase 2 song song (Design + UML + Docs + Git) |
| **In-memory Cache** | 1h TTL — skip repeated API calls (low-temperature only) |
| **Token Tracking** | Lưu `TokenLog` per agent per key — biết chi phí chính xác |
| **AI Self-Fix** | JSON parse lỗi → AI tự sửa trước khi fallback |
| **Smart Retry** | 429 → wait + retry same model; 5xx → backoff; 4xx → skip to next model |

### 📊 Live Log Console (3 chế độ)

| Chế độ | Khi nào hiện | Nội dung |
|---|---|---|
| **Pipeline Overlay** | Khởi tạo dự án mới | 8 agent board + log console side-by-side |
| **Init Overlay** | Sinh todolist (Kanban) | "AI đang làm gì" panel + log console |
| **Refine Overlay** | AI Refine (ChatTab) | "AI đang sửa section nào" + log console |

Mỗi log line có:
```
14:23:01 [AGENT-01] [OR] [#1] [OpenRouter] Key #1, model: openai/gpt-oss-120b:free
14:23:04 [AGENT-01] [OR] [#1] ✓ Success
14:23:08 [KEY ROTATION] OpenRouter Key #1 rate-limited for 60s
14:23:12 [AGENT-02] ✗ All 5 OpenRouter keys exhausted for nvidia/nemotron-3-ultra-550b-a55b:free
```
→ Biết chính xác model nào, API key nào còn sống / đã chết để refill kịp thời.

### 📋 Kanban Board (Drag & Drop)

- 4 cột: **Cần Làm → Đang Làm → Cần Review → Hoàn Thành**
- Kéo thả (`@hello-pangea/dnd`)
- Real-time polling 5s — nhóm trưởng thấy member cập nhật ngay
- Task card: layer badge (DATABASE/BACKEND/UI/CONFIG/TESTING), priority (P0/P1/P2), target file, deadline, code snippet indicator
- Task detail dialog: implementation steps, code conventions, technical hints (copy-paste), acceptance criteria
- SMART tasks: động từ hành động, nguyên tử, bối cảnh file, gợi ý kỹ thuật

### 💬 Real-time Collaboration

- Chat realtime qua Socket.io (mini-service port 3001) + HTTP polling fallback
- **AI Assistant** — gọi `chatAssistant` để AI phản hồi/tổng hợp ý kiến
- **AI Refine** — đọc chat + edit requests → sinh lại TAT CA sections (có Live Log Console)
- Edit proposals — member đề xuất chỉnh sửa, leader approve → AI apply
- Typing indicator, online users list
- Token verification trước khi join room

### 🔌 GitHub Integration

- **OAuth flow** — không cần Personal Access Token
- **Push to GitHub** — tạo repo private + push 15+ files:
  ```
  README.md
  .gitignore
  PROJECT_SUMMARY.md
  FOLDER_STRUCTURE.txt
  docs/CODING_CONVENTION.md
  docs/API_STANDARD.md
  docs/ARCHITECTURE.md
  docs/DATABASE.md
  docs/API_ENDPOINTS.md
  docs/SPRINT_PLAN.md
  docs/TEAM.md
  docs/TASKS.md
  docs/UML/use-case.mmd
  docs/UML/class-diagram.mmd
  docs/UML/erd.mmd
  docs/UML/sequence.mmd
  .github/ISSUE_TEMPLATE/task.md
  ```
- **Pull Request** — tạo branch `nexus-ai/init` + PR với body markdown
- Dùng GitHub REST API (không cần git CLI)
- Thu hồi quyền GitHub bất cứ lúc nào

### 📧 Email SMTP

- Gửi email thật qua Gmail App Password (Nodemailer)
- SMTP verify trước khi gửi
- 3 loại email: `INVITATION` (lời mời), `TASK_ASSIGNED` (gán task), `REMINDER` (deadline)
- Mailbox UI xem tất cả email đã gửi
- Email link dùng `.public-url` (Cloudflare Tunnel URL) → thành viên click là vào workspace

### 🎨 UI/UX

- Dark theme teal accent, responsive (mobile + desktop)
- Mermaid.js 11 UML + **React Flow interactive canvas** (Class + ERD kéo thả)
- Kanban board (dnd-kit)
- Rendered markdown docs (headings, code blocks, tables, syntax highlight)
- Zustand persist (form data across reloads)
- `beforeunload` warning khi AI đang chạy
- Toast notifications (sonner)

### 🏠 Project History

- Home page hiển thị tất cả dự án đã tạo (cards với status, member count, task count)
- Click để mở lại workspace (data vẫn còn trong SQLite)
- Xóa dự án (xác nhận gõ "Delete")
- Long-term memory (`ProjectContext`) — AI nhớ dự án giữa các session

### 🐳 Docker

- Standalone Dockerfile (multi-stage build: `oven/bun:1.2` → `oven/bun:1.2-slim`)
- SQLite persistent volume (`/data/custom.db`)
- Healthcheck mỗi 30s
- `bunx prisma db push --skip-generate` tự chạy khi container start

---

## 🚀 Cài đặt

### Yêu cầu

| Tool | Version | Link |
|---|---|---|
| [Bun](https://bun.sh) | v1+ | `curl -fsSL https://bun.sh/install \| bash` |
| [Node.js](https://nodejs.org) | v18+ | (cho Prisma CLI) |
| [OpenRouter API key](https://openrouter.ai/keys) | free | Multi-key rotation |
| [GitHub OAuth App](https://github.com/settings/developers) | tùy chọn | Cho push GitHub |
| Gmail App Password | tùy chọn | Cho email SMTP |

### Windows

```cmd
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
copy .env.example .env
:: Điền API keys vào .env
scripts\run-local.bat
```

### macOS / Linux

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
cp .env.example .env
# Điền API keys vào .env
bash scripts/run-local.sh
```

### Docker

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
cp .env.example .env
# Điền API keys vào .env
docker build -t nexus-ai .
docker run -p 3000:3000 -v nexus-data:/data --env-file .env nexus-ai
```

Script `run-local.*` tự động:
1. Kiểm tra `.env` + Bun
2. Install dependencies (`bun install`)
3. Setup database (`bun run db:push`)
4. Tải `cloudflared` (nếu chưa có)
5. Khởi động Next.js (port 3000)
6. Tạo Cloudflare Tunnel → URL public
7. Ghi URL vào `.public-url` → email dùng URL đúng

👉 Chi tiết: [LOCAL_RUN.md](LOCAL_RUN.md)

---

## ⚙️ Cấu hình `.env`

```env
# ===== Database (SQLite) =====
DATABASE_URL=file:./db/custom.db

# ===== OpenRouter API (multi-key rotation) =====
# Hỗ trợ không giới hạn số key — tự luân chuyển khi 1 key bị 429
# Lấy tại: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
OPENROUTER_API_KEY_2=sk-or-v1-xxxxxxxxxxxxx
OPENROUTER_API_KEY_3=sk-or-v1-xxxxxxxxxxxxx
# OPENROUTER_API_KEY_4=sk-or-v1-xxxxxxxxxxxxx
# ... thêm bao nhiêu cũng được

# ===== GitHub OAuth App (tùy chọn — cho push GitHub) =====
GITHUB_CLIENT_ID=Ov23xxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ===== App URL =====
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

> **Mẹo:** Thêm càng nhiều `OPENROUTER_API_KEY_N` thì pipeline càng nhanh (ít phải chờ rate-limit). Khuyến nghị 3-5 key free.

---

## 📖 Hướng dẫn sử dụng

### 1. Tạo dự án mới

1. Vào home page → bấm **"Dự án mới"**
2. Điền form:
   - **Chủ đề** (vd: "Hệ thống quản lý nhân sự")
   - **Mô tả** (người dùng cuối, vấn đề giải quyết, quy mô)
   - **Mục đích** (đồ án tốt nghiệp, hackathon, sản phẩm thực tế)
   - **Thông tin bổ sung** (requirements, tech prefs, lang prefs) — tùy chọn
   - **Nhóm trưởng**: tên + email + Gmail App Password
   - **Thành viên**: tên + email + ưu điểm + nhược điểm (click tag để chọn nhanh)
3. Bấm **"Khởi tạo Dự Án"** → 10 AI Agent chạy (xem Live Log Console)

### 2. Workspace (11 tabs)

| Tab | Nội dung |
|---|---|
| **Phân Tích** | Tech stack, features (P0/P1/P2), actors, modules |
| **Nhân Sự** | Vai trò từng thành viên, workload %, rủi ro + mitigation |
| **Sprint** | Timeline sprints (2 tuần), tasks per sprint, milestones |
| **Thiết Kế** | Architecture desc, DB tables + columns + relations, API endpoints, folder tree |
| **UML** | Use Case + Class (interactive) + ERD (interactive) + Sequence (Mermaid) |
| **Tài Liệu** | README, Coding Convention, API Standard (rendered markdown) |
| **Git & Repo** | Git commands, branch strategy, OAuth + Push + PR |
| **Thảo Luận** | Chat realtime + AI Assistant + AI Refine |
| **Thành Viên** | Danh sách thành viên + invite link |
| **Todolist** | Kanban board (drag-drop) |
| **Mailbox** | Tất cả email đã gửi |

### 3. Edit section + AI Refine

- Mỗi section (Analysis, HR, Sprint, Design, UML, Docs, Git) có nút **"Chỉnh sửa"**
- Leader edit → propose change → bấm **"AI Refine"** trong tab Thảo Luận
- AI đọc chat + edit requests → sinh lại TẤT CẢ sections (xem Live Log Console)
- Version bumped trong DB — có thể rollback

### 4. Khởi tạo Todolist (Kanban)

- Bấm **"Khởi tạo Dự Án"** (sidebar) — chỉ leader, chỉ khi chưa có task
- AI sinh SMART tasks: layer, targetFile, code snippets, dependencies
- Live Log Console hiển thị: `👤 Member A → vai trò: Frontend Developer · module: UI, ...` → `✓ Sinh task cho Member A: Thiết kế layout chính`
- Kéo thả task giữa 4 cột
- Click task → detail dialog với code snippet + Copy button

### 5. Push lên GitHub

1. Tab **Git & Repo** → bấm **"Connect GitHub"** (OAuth popup)
2. Bấm **"Push to GitHub"** → tự tạo repo (private) + push 15+ files
3. Bấm **"Tạo Pull Request"** → tạo branch `nexus-ai/init` + PR
4. Repo URL hiện trong sidebar (chỉ leader)

### 6. Email lời mời

- Khi tạo dự án → tự gửi email `INVITATION` cho tất cả thành viên
- Khi sinh todolist → tự gửi email `TASK_ASSIGNED` (task + deadline)
- Email link dùng `.public-url` (Cloudflare Tunnel URL):
  ```
  https://xxx.trycloudflare.com/?p=PROJECT_ID&token=MEMBER_TOKEN
  ```
- Thành viên click link → vào workspace với quyền member

---

## 📁 Cấu trúc thư mục

```
Nexus-AI/
├── prisma/
│   └── schema.prisma                  # DB schema (Project, Member, Task, TokenLog, ProjectContext...)
├── src/
│   ├── app/
│   │   ├── api/                       # 23 API routes (xem docs/API.md)
│   │   │   ├── projects/              # CRUD + pipeline + refine + tasks + chat + members
│   │   │   ├── github/                # OAuth + push + callback
│   │   │   └── config/                # Public URL config
│   │   ├── layout.tsx                 # Root layout (Mermaid CDN, themes)
│   │   └── page.tsx                   # Main page (home/input/workspace router)
│   ├── components/
│   │   ├── ui/                        # shadcn/ui (40+ components)
│   │   └── nexus/
│   │       ├── tabs/                  # 11 workspace tabs
│   │       │   ├── AnalysisTab.tsx
│   │       │   ├── HRTab.tsx
│   │       │   ├── SprintTab.tsx
│   │       │   ├── DesignTab.tsx
│   │       │   ├── UMLTab.tsx         # React Flow interactive + Mermaid
│   │       │   ├── DocsTab.tsx        # Rendered markdown (MDX editor)
│   │       │   ├── GitTab.tsx         # OAuth + Push + PR
│   │       │   ├── ChatTab.tsx        # Real-time + AI Refine console
│   │       │   ├── MembersTab.tsx
│   │       │   ├── TasksTab.tsx       # Kanban board (dnd-kit)
│   │       │   └── MailboxTab.tsx
│   │       ├── HomeView.tsx           # Project history
│   │       ├── InputView.tsx          # Form nhập dự án
│   │       ├── WorkspaceView.tsx      # Main workspace (sidebar + tabs)
│   │       ├── ProcessingOverlay.tsx  # Pipeline overlay (8 agent board + log)
│   │       ├── TaskProcessingOverlay.tsx  # Init/Refine overlay (thinking + log)
│   │       ├── MermaidRenderer.tsx    # Mermaid.js với extensive fixers
│   │       └── SectionEditor.tsx      # Edit section dialog
│   ├── lib/
│   │   ├── ai.ts                      # 8-agent pipeline (parallel + fallback + refine + task gen)
│   │   ├── openrouter.ts              # OpenRouter multi-key rotation client + cache
│   │   ├── github.ts                  # Push 15+ files + PR creation
│   │   ├── email.ts                   # SMTP (nodemailer) + .public-url
│   │   ├── pipeline-progress.ts       # ALS-based log tracker + progress maps
│   │   ├── access.ts                  # Token resolve + requireLeader
│   │   ├── db.ts                      # Prisma client
│   │   ├── types.ts                   # TypeScript types
│   │   └── utils.ts                   # cn() + helpers
│   └── store/
│       └── useNexus.ts                # Zustand (persisted) — global state
├── mini-services/
│   └── chat-service/                  # Socket.io mini-service (port 3001)
│       ├── index.ts                   # Server (join, send_message, typing, disconnect)
│       └── package.json
├── scripts/
│   ├── run-local.bat                  # Windows: chạy + tunnel
│   ├── run-local.ps1                  # PowerShell
│   ├── run-local.sh                   # macOS/Linux
│   ├── parse-tunnel-url.ps1           # Parse tunnel URL from log
│   ├── push-to-github.js              # Standalone push script (debug)
│   └── auto-restart.sh                # Auto-restart on crash
├── docs/                              # 📚 Documentation (xem bên dưới)
├── prisma/
├── db/
│   └── custom.db                      # SQLite database
├── Dockerfile                         # Standalone Docker (multi-stage)
├── Caddyfile                          # Gateway config (XTransformPort)
├── .env.example
├── LOCAL_RUN.md
├── ARCHITECTURE.md
├── API.md
├── CONTRIBUTING.md
└── package.json
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | Next.js (App Router) | 16 |
| **UI Library** | React | 19 |
| **Language** | TypeScript | 5 |
| **Styling** | Tailwind CSS + shadcn/ui (New York) | 4 |
| **Backend** | Next.js API Routes (Node.js runtime) | — |
| **Database** | Prisma ORM + SQLite | 6 |
| **AI Provider** | OpenRouter (multi-key rotation, multi-model fallback) | — |
| **Real-time** | Socket.io (optional) + HTTP polling | 4 |
| **Diagrams** | Mermaid.js + React Flow (interactive) | 11 / 11 |
| **Kanban DnD** | @hello-pangea/dnd | 18 |
| **Markdown Editor** | MDX Editor | 3 |
| **State** | Zustand (persisted) | 5 |
| **Server State** | TanStack Query | 5 |
| **Email** | Nodemailer (Gmail SMTP) | 9 |
| **Forms** | React Hook Form + Zod | 7 / 4 |
| **Icons** | Lucide React | 0.525 |
| **Notifications** | Sonner | 2 |
| **Runtime** | Bun | 1 |
| **Package Manager** | Bun (lockfile) | — |

---

## 🤖 10 AI Agents — Model Priority (v2)

Mỗi agent có danh sách model ưu tiên riêng (7-9 model), fallback tự động khi model bị 429/404.

| # | Agent | Models (priority order) | Temp |
|---|---|---|---|
| 01 | Requirement Analyst | nemotron-3-ultra → qwen3-next-80b → nemotron-3-super → gpt-oss-120b → hermes-3-405b → gemma-4-31b → gemma-4-26b → llama-3.3-70b → nemotron-3-nano-30b | 0.20 |
| 02 | HR Planner | gemma-4-31b → gemma-4-26b → nemotron-3-ultra → qwen3-next-80b → llama-3.3-70b → gpt-oss-120b → nemotron-3-nano-30b → gpt-oss-20b | 0.25 |
| 03 | Sprint Planner | nemotron-3-ultra → nemotron-3-super → qwen3-next-80b → gpt-oss-120b → hermes-3-405b → gemma-4-31b → nemotron-nano-9b-v2 | 0.20 |
| 04 | System Architect | gpt-oss-120b → qwen3-coder → laguna-m.1 → north-mini-code → nemotron-3-super → gemma-4-31b → gpt-oss-20b | 0.15 |
| 05 | UML Generator | gpt-oss-120b → qwen3-coder → north-mini-code → laguna-xs-2.1 → laguna-xs.2 → gemma-4-31b → gpt-oss-20b | 0.10 |
| 06 | Technical Writer | gemma-4-31b → gemma-4-26b → llama-3.3-70b → qwen3-next-80b → gpt-oss-120b → hermes-3-405b → llama-3.2-3b | 0.35 |
| 07 | Git/DevOps | north-mini-code → laguna-m.1 → qwen3-coder → laguna-xs-2.1 → laguna-xs.2 → gpt-oss-120b → gpt-oss-20b | 0.15 |
| 08 | **Software Tester** ⭐ | qwen3-coder → gpt-oss-120b → north-mini-code → laguna-m.1 → nemotron-3-super → gemma-4-31b → gpt-oss-20b | 0.20 |
| 09 | **Security Reviewer** ⭐ | gpt-oss-120b → qwen3-next-80b → nemotron-3-ultra → hermes-3-405b → llama-3.3-70b → gemma-4-31b → nemotron-3-nano-30b | 0.15 |
| 10 | Quality Reviewer | gpt-oss-120b → qwen3-next-80b → nemotron-3-ultra → gemma-4-31b → hermes-3-405b → llama-3.3-70b → nemotron-3-nano-30b | 0.10 |
| — | Task Generator | qwen3-coder → gpt-oss-120b → laguna-m.1 → north-mini-code → nemotron-3-ultra → gemma-4-31b → nemotron-3-nano-30b | 0.25 |
| — | Chat Assistant | qwen3-next-80b → gpt-oss-120b → gemma-4-31b → llama-3.3-70b → hermes-3-405b → gpt-oss-20b → llama-3.2-3b | 0.50 |

**Fallback chain:** Model 1 → Model 2 → ... → static fallback data (luôn có kết quả, không bao giờ crash)

> **Note:** Mỗi agent thử 2 retries per model với exponential backoff. Khi 1 model bị 429/404, tự skip sang model tiếp theo. Tất cả models đều free tier trên OpenRouter.

---

## 📊 Live Log Console — Ví dụ thực tế

```
14:23:01 [PIPE] ▶ PIPELINE STARTED — topic: "Hệ thống quản lý nhân sự" — 3 member(s)
14:23:01 [01]    ─────────────────────────────────────────────
14:23:01 [01]    [AGENT-01] Requirement Analyst → start (models: 5)
14:23:01 [01]    → [1/2] trying nvidia/nemotron-3-ultra-550b-a55b:free
14:23:01 [OR][#1] [OpenRouter] Key #1, model: nvidia/nemotron-3-ultra-550b-a55b:free
14:23:04 [OR][#1] ✗ [Key #1] → [429] Rate limit exceeded
14:23:04 [OR][#1] [KEY ROTATION] OpenRouter Key #1 rate-limited for 60s
14:23:04 [OR][#2] [OpenRouter] Key #2, model: nvidia/nemotron-3-ultra-550b-a55b:free
14:23:08 [OR][#2] ✓ [Key #2] nvidia/nemotron-3-ultra-550b-a55b:free → Success
14:23:08 [01]    ✓ [AGENT-01] Requirement Analyst → done (nvidia/nemotron-3-ultra-550b-a55b:free)
14:23:08 [02]    [AGENT-02] HR Planner → start (models: 4)
...
14:24:15 [10]    ✓ [AGENT-10] Reviewer → done (gpt-oss-120b, 73.2s total)
14:24:15 [PIPE]  ✅ PIPELINE COMPLETED — all sections saved, invitations sent
```

**Color coding:**
- 🟢 Xanh (success) — thành công
- 🟡 Vàng (warn) — fallback / retry / cache hit
- 🔴 Đỏ (error) — thất bại
- ⚪ Slate (info) — thông tin chung

**Badge:**
- `[01]`...`[08]` — Agent ID
- `[OR]` — OpenRouter
- `[PIPE]` — Pipeline event
- `[TASK]` — Task generation
- `[REFINE]` — AI Refine
- `[CACHE]` — Cache hit
- `[FALLBACK]` — Static fallback
- `[#1]`...`[#5]` — API key index

---

## 🔌 REST API

Toàn bộ 23 API endpoints — xem chi tiết tại [docs/API.md](docs/API.md).

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/projects` | List tất cả projects |
| `POST` | `/api/projects` | Tạo project + chạy pipeline |
| `GET` | `/api/projects/:id` | Get project + sections + members + tasks |
| `DELETE` | `/api/projects/:id` | Xóa project (leader only) |
| `GET` | `/api/projects/:id/progress` | Poll pipeline progress + logs |
| `POST` | `/api/projects/:id/initialize` | Sinh todolist (Kanban) |
| `GET` | `/api/projects/:id/initialize/progress` | Poll init progress + logs |
| `POST` | `/api/projects/:id/refine` | AI Refine sections |
| `GET` | `/api/projects/:id/refine/progress` | Poll refine progress + logs |
| `GET/POST` | `/api/projects/:id/tasks` | List / update tasks |
| `PATCH` | `/api/projects/:id/tasks/:taskId` | Update task status (drag-drop) |
| `GET/POST` | `/api/projects/:id/chat` | List / post chat messages |
| `POST` | `/api/projects/:id/chat/ai` | AI Assistant reply |
| `GET/POST` | `/api/projects/:id/edit-proposals` | List / create edit proposals |
| `PATCH` | `/api/projects/:id/edit-proposals/:pid` | Approve/reject proposal |
| `GET/POST` | `/api/projects/:id/section` | Get / update section content |
| `GET` | `/api/projects/:id/members` | List members |
| `GET` | `/api/projects/:id/mailbox` | List emails sent |
| `GET` | `/api/projects/:id/context` | Get long-term memory |
| `GET` | `/api/projects/:id/tokens` | Token usage logs |
| `GET` | `/api/github/auth` | OAuth redirect |
| `GET` | `/api/github/callback` | OAuth callback |
| `GET` | `/api/github/status` | OAuth status |
| `POST` | `/api/github/push` | Push to GitHub + create PR |
| `GET` | `/api/config` | Public URL config |

---

## 🗄️ Database Schema

9 models — xem chi tiết tại [prisma/schema.prisma](prisma/schema.prisma).

| Model | Mô tả |
|---|---|
| `Project` | Dự án — topic, description, leader, GitHub info |
| `Member` | Thành viên — name, email, strengths, weaknesses, inviteToken |
| `Analysis` | Section versioned (ANALYSIS/HR/SPRINT/DESIGN/UML/DOCS/GIT) |
| `Task` | Kanban task — SMART model + layer + targetFile + code hints |
| `ChatMessage` | Chat message (leader/member/ai) |
| `EditProposal` | Member đề xuất chỉnh sửa → leader approve |
| `EmailLog` | Email đã gửi (INVITATION/TASK_ASSIGNED/REMINDER) |
| `ProjectContext` | Long-term memory — AI nhớ dự án giữa các session |
| `TokenLog` | Token usage per agent per key — track cost |

---

## 🔐 Bảo mật

- **GitHub OAuth** — không cần Personal Access Token, repo tạo private mặc định
- **Token verification** — chat service verify token vs Next.js API trước khi join room
- **Leader vs Member** — chỉ leader có quyền: edit section, AI Refine, push GitHub, xóa project
- **`leaderEmail`, `githubRepoName`, `githubToken`** — chỉ hiện cho leader
- **Thu hồi quyền GitHub** bất cứ lúc nào (clear token)
- **SQLite local** — data không rời máy bạn (trừ khi bạn push lên GitHub)

---

## 🐛 Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| **OpenRouter 429 Rate limit** | Thêm `OPENROUTER_API_KEY_2`, `_3`... vào `.env` (hỗ trợ không giới hạn) |
| **Model 404 unavailable** | Hệ thống tự skip sang model tiếp theo — xem log `⚠ skip to next model` |
| **Mermaid render lỗi** | Bấm nút "Thu lại" — hệ thống tự fix `\\n`, `PK FK`, `class` prefix |
| **Email không gửi** | Kiểm tra Gmail App Password (không phải password thường) + bật 2FA |
| **Chat không realtime** | Chat service (port 3001) tự fallback sang HTTP polling 3s |
| **Pipeline chậm** | Thêm API key, hoặc chờ (pipeline có retry + fallback data) |
| **Dev server 404 trên /progress** | Đã fix bằng `globalThis` — restart `bun run dev` |

👉 Chi tiết: [LOCAL_RUN.md](LOCAL_RUN.md#-troubleshooting)

---

## 🤝 Đóng góp

Xem [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) để biết:
- Setup dev environment
- Code style + conventions
- Cách thêm AI Agent mới
- Cách thêm model mới
- Cách extend tabs

Xem [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) để biết community standards.

Xem [CHANGELOG.md](CHANGELOG.md) để biết version history.

---

## 📚 Documentation

| File | Mô tả |
|---|---|
| [README.md](README.md) | File này — overview |
| [LOCAL_RUN.md](LOCAL_RUN.md) | Hướng dẫn chạy local + Cloudflare Tunnel |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, components |
| [docs/API.md](docs/API.md) | Full REST API reference (23 endpoints) |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev setup, code style, how to extend |
| [mini-services/chat-service/README.md](mini-services/chat-service/README.md) | Socket.io chat service protocol |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [LICENSE](LICENSE) | MIT License |

---

## 📝 License

MIT License — xem [LICENSE](LICENSE).

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org) — React framework
- [OpenRouter](https://openrouter.ai) — AI model gateway (free tier)
- [Prisma](https://prisma.io) — ORM
- [shadcn/ui](https://ui.shadcn.com) — Component library
- [Mermaid.js](https://mermaid.js.org) — Diagrams
- [React Flow](https://reactflow.dev) — Interactive diagrams
- [Socket.io](https://socket.io) — Real-time
- [Nodemailer](https://nodemailer.com) — Email
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) — Public URL

---

<div align="center">

**NEXUS AI** — Multi-Agent Architect

Powered by OpenRouter Multi-Key + 10 AI Agents 🤖

[⬆ Về đầu trang](#-nexus-ai)

</div>
