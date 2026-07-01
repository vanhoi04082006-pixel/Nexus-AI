# 🤖 NEXUS AI

### Multi-Agent Project Architect

> Hệ thống AI đa tác tử (multi-agent) tự động phân tích dự án, thiết kế hệ thống, lập kế hoạch sprint, phân nhân sự, sinh todolist chi tiết và push code lên GitHub.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)
![Bun](https://img.shields.io/badge/Bun-1-f472b6)

---

## 📖 NEXUS AI là gì?

Nhập chủ đề dự án + danh sách thành viên → **8 AI Agent** tự động:

| Agent | Vai trò |
|---|---|
| 01 · Requirement Analyst | Phân tích chủ đề, tech stack, features, actors, modules |
| 02 · HR Planner | Phân vai trò, workload, rủi ro |
| 03 · Sprint Planner | Chia sprint, gán task, deadline, milestones |
| 04 · System Architect | Thiết kế database, API, folder structure |
| 05 · UML Generator | Vẽ 4 biểu đồ Mermaid (Use Case, Class, ERD, Sequence) |
| 06 · Technical Writer | Viết README, Coding Convention, API Standard |
| 07 · Git/DevOps | Git commands, branch strategy, issue template |
| 08 · Quality Reviewer | Tổng hợp, đồng bộ, sửa lỗi 7 Agent trên |

Sau đó nhóm trưởng **khởi tạo dự án** → AI sinh **todolist chi tiết** cho từng thành viên (vai trò, trách nhiệm, quy ước code, deadline).

---

## ✨ Tính năng

### 🧠 Multi-Agent AI Pipeline
- 8 Agent chuyên biệt, mỗi Agent có danh sách model riêng + fallback
- Dùng **OpenRouter** với nhiều model free (NVIDIA Nemotron, OpenAI GPT-OSS, Google Gemma, Cohere, Poolside)
- **Multi-API key rotation** — tự chuyển key khi bị rate limit
- JSON fixer string-aware (không phá URL `https://`)
- Retry + exponential backoff

### 💬 Real-time Collaboration
- Chat realtime (Socket.io + polling fallback)
- AI Assistant tham gia chat, tổng hợp ý kiến
- **AI Refine** — đọc chat + edits → sinh lại tất cả sections
- Edit Proposals — thành viên đề xuất, nhóm trưởng duyệt
- Typing indicator

### 📋 Todolist chi tiết
- Mỗi thành viên 3-5 task với: vai trò, trách nhiệm, **quy ước code**, dependencies, deadline, tiêu chí hoàn thành
- Progress tracking: todo → in_progress → review → done
- Filter "Việc của tôi" cho thành viên
- Rollback optimistic update khi lỗi

### 🔌 GitHub Integration
- **OAuth** — không cần PAT, chỉ bấm "Connect GitHub"
- **Push to GitHub** — tự tạo repo (private) + push tất cả files
- Dùng GitHub REST API (không cần git CLI)
- Repo name unique (append projectId)

### 📧 Email SMTP
- Gửi email thật qua **Gmail App Password** (nodemailer)
- SMTP verify trước khi gửi — log warning nếu auth fail
- Email lời mời, task assigned, deadline reminder
- Mailbox UI xem tất cả email đã gửi
- Link trong email tự động dùng URL tunnel

### 🎨 UI/UX
- Dark theme teal accent
- Mermaid.js UML render + retry button
- Responsive (mobile + desktop)
- Zustand persist (save form across reloads)
- Polling architecture (no 504 gateway timeout)

---

## 🚀 Cài đặt & Chạy

### Yêu cầu
- [Bun](https://bun.sh) v1+
- [Node.js](https://nodejs.org) v18+ (cho Prisma)
- [OpenRouter API key](https://openrouter.ai/keys) (free)
- [GitHub OAuth App](https://github.com/settings/developers) (tùy chọn)
- Gmail App Password (cho email SMTP)

### Cách 1: Chạy Local + Cloudflare Tunnel (FREE, không cần thẻ)

**Windows:**
```cmd
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
copy .env.example .env
:: Điền API keys vào .env
scripts\run-local.bat
```

**macOS / Linux:**
```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
cp .env.example .env
# Điền API keys vào .env
bash scripts/run-local.sh
```

Script tự động: cài deps → setup DB → khởi động server → tạo URL public.

👉 Chi tiết: [LOCAL_RUN.md](LOCAL_RUN.md)

### Cách 2: Chạy thủ công

```bash
bun install
bun run db:push
bun run dev          # http://localhost:3000
```

Chat service (tùy chọn, cho realtime WebSocket):
```bash
cd mini-services/chat-service
bun install
bun run dev          # port 3001
```

---

## ⚙️ Cấu hình Environment

Tạo file `.env` từ `.env.example`:

```env
# Database (SQLite)
DATABASE_URL=file:./db/custom.db

# OpenRouter — hỗ trợ nhiều key để tránh rate limit
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_API_KEY_2=sk-or-v1-xxxxx    # (tùy chọn)
OPENROUTER_API_KEY_3=sk-or-v1-xxxxx    # (tùy chọn)

# GitHub OAuth (tùy chọn)
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx

# App URL (script tự cập nhật khi tunnel chạy)
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

---

## 📖 Hướng dẫn sử dụng

### 1. Tạo dự án
- Nhập chủ đề + mô tả + mục đích
- Nhập email + Gmail App Password (nhóm trưởng)
- Thêm thành viên (tên + email + ưu/nhược điểm)
- Bấm **"Khởi tạo Dự Án"** → 8 AI Agent chạy

### 2. Workspace (7 tabs)
- **Phân Tích Chủ Đề** — tech stack, features, actors, modules
- **Phân Nhân Sự** — vai trò, workload, rủi ro
- **Sprint Planning** — sprint timeline, tasks, milestones
- **Thiết Kế Hệ Thống** — architecture, DB schema, API, folder
- **UML Diagrams** — Use Case, Class, ERD, Sequence (Mermaid)
- **Tài Liệu** — README, Coding Convention, API Standard
- **Git & Repo** — git commands + GitHub OAuth + Push

### 3. Thảo luận & Refine
- Tab **Thảo Luận** — chat + AI Assistant
- Nhóm trưởng bấm **"AI Refine"** → AI sinh lại tất cả sections

### 4. Khởi tạo Todolist
- Nhóm trưởng bấm **"Khởi tạo Dự Án"** (sidebar)
- AI sinh todolist chi tiết cho từng thành viên
- Email thông báo tự gửi

### 5. Push lên GitHub
- Tab **Git & Repo** → **"Connect GitHub"** (OAuth)
- Bấm **"Push to GitHub"** → tạo repo + push files

---

## 📁 Cấu trúc thư mục

```
Nexus-AI/
├── prisma/
│   └── schema.prisma              # Database schema (SQLite)
├── src/
│   ├── app/
│   │   ├── api/                   # API routes
│   │   │   ├── projects/          # Project CRUD + pipeline
│   │   │   ├── github/            # OAuth + push
│   │   │   └── config/            # Public URL config
│   │   ├── layout.tsx
│   │   └── page.tsx               # Main page (router)
│   ├── components/
│   │   ├── nexus/
│   │   │   ├── tabs/              # 11 workspace tabs
│   │   │   ├── InputView.tsx      # Form nhập dự án
│   │   │   ├── WorkspaceView.tsx  # Main workspace
│   │   │   ├── ProcessingOverlay.tsx
│   │   │   ├── MermaidRenderer.tsx
│   │   │   └── SectionEditor.tsx
│   │   └── ui/                    # shadcn/ui components
│   ├── lib/
│   │   ├── ai.ts                  # Multi-agent pipeline
│   │   ├── openrouter.ts          # OpenRouter client + key rotation
│   │   ├── github.ts              # GitHub push logic
│   │   ├── email.ts               # SMTP email service
│   │   ├── access.ts              # Access control
│   │   ├── db.ts                  # Prisma client
│   │   ├── types.ts               # TypeScript types
│   │   └── pipeline-progress.ts   # Background progress tracker
│   └── store/
│       └── useNexus.ts            # Zustand store (persisted)
├── mini-services/
│   └── chat-service/              # Socket.io chat (port 3001, optional)
├── scripts/
│   ├── run-local.bat              # Windows: chạy + tunnel
│   ├── run-local.ps1              # PowerShell alternative
│   ├── run-local.sh               # macOS/Linux: chạy + tunnel
│   └── push-to-github.js          # Push source code lên GitHub
├── .env.example                   # Template environment variables
├── LOCAL_RUN.md                   # Hướng dẫn chạy local chi tiết
└── package.json
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | Prisma ORM + SQLite |
| Real-time | Socket.io (optional) + HTTP polling fallback |
| AI | OpenRouter (multi-key rotation, model fallback) |
| Diagrams | Mermaid.js 11 (via CDN) |
| State | Zustand (persisted) |
| Email | Nodemailer (Gmail SMTP) |
| Icons | Lucide React |

---

## 🤖 8 AI Agents & Models

| # | Agent | Models (fallback order) |
|---|---|---|
| 01 | Requirement Analyst | NVIDIA Nemotron Ultra → Super → OpenAI GPT-OSS |
| 02 | HR Planner | Nemotron Ultra → Google Gemma → GPT-OSS |
| 03 | Sprint Planner | Nemotron Ultra → Super → GPT-OSS |
| 04 | System Architect | Poolside Laguna M.1 → GPT-OSS → Cohere → Laguna XS.2 |
| 05 | UML Generator | Poolside Laguna M.1 → GPT-OSS → Cohere → Laguna XS.2 |
| 06 | Technical Writer | Google Gemma → GPT-OSS |
| 07 | Git/DevOps | Poolside Laguna XS.2 → Cohere |
| 08 | Quality Reviewer | Nemotron Ultra → Super → GPT-OSS → Gemma |

**Key rotation:** Khi 1 API key bị 429/401/403, tự động chuyển sang key tiếp theo (`OPENROUTER_API_KEY` → `_2` → `_3`).

---

## 🔐 Bảo mật

- **GitHub OAuth** — không cần PAT, user authorize 1 lần
- **Chat auth** — Socket.io verify token trước khi join room
- Token lưu trong DB, chỉ nhóm trưởng có quyền đầy đủ
- Thành viên chỉ xem + chat + đề xuất chỉnh sửa
- GitHub repo tạo **private** mặc định
- `leaderEmail`, `githubRepoName` chỉ hiện cho nhóm trưởng
- Thu hồi quyền GitHub bất cứ lúc nào từ GitHub Settings

---

## 📦 Deploy

Xem hướng dẫn chạy local + Cloudflare Tunnel (FREE, không cần thẻ tín dụng): **[LOCAL_RUN.md](LOCAL_RUN.md)**

---

## 📝 License

MIT License — tự do sử dụng, chỉnh sửa và phân phối.

---

<p align="center">
  <strong>NEXUS AI</strong> — Multi-Agent Architect<br>
  Powered by 8 AI Agents 🤖
</p>
