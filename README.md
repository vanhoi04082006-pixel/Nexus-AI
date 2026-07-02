# 🤖 NEXUS AI

### Multi-Agent Project Architect

> Hệ thống AI đa tác tử tự động phân tích dự án, thiết kế hệ thống, lập kế hoạch sprint, phân nhân sự, sinh todolist chi tiết (Kanban board), push code lên GitHub và gửi email mời thành viên.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi--Key-orange)
![Bun](https://img.shields.io/badge/Bun-1-f472b6)

---

## 📖 NEXUS AI là gì?

Nhập chủ đề dự án + danh sách thành viên → **8 AI Agent** (OpenRouter multi-key rotation) tự động:

1. **Phân tích chủ đề** — tech stack, features, actors, modules
2. **Phân nhân sự** — vai trò, workload, rủi ro
3. **Lập Sprint** — chia sprint, gán task, deadline
4. **Thiết kế hệ thống** — database schema, API endpoints, folder structure (tree format)
5. **Vẽ UML** — Use Case, Class Diagram (interactive), ERD (interactive), Sequence
6. **Viết tài liệu** — README, Coding Convention, API Standard (rendered markdown)
7. **Git workflow** — git commands, branch strategy, issue template
8. **Quality Review** — reviewer tổng hợp + đồng bộ

Sau đó → **Kanban Todolist** (SMART tasks + code snippets + drag-drop) → **Push GitHub** (tạo repo + PR) → **Email mời thành viên**.

---

## ✨ Tính năng

### 🧠 Multi-Agent Pipeline (OpenRouter Multi-Key)
- **OpenRouter multi-key rotation** — hỗ trợ không giới hạn số API key, tự luân chuyển khi 1 key bị rate-limit
- **Live Log Console** — xem realtime model nào, agent nào, API key nào đang chạy, thành công hay thất bại
- **Multi-model fallback** — mỗi agent có danh sách model ưu tiên (NVIDIA Nemotron, GPT-OSS, Gemma, Cohere…)
- Parallel execution: Phase 2 (4 agents) chạy song song → giảm 40% thời gian
- In-memory cache (1h TTL) — skip repeated API calls
- Token usage tracking per agent per key

### 📋 Kanban Board (Drag & Drop)
- 4 cột: Cần Làm → Đang Làm → Cần Review → Hoàn Thành
- Kéo thả task giữa các cột (dnd-kit)
- Real-time polling 5s — nhóm trưởng thấy member cập nhật ngay
- Task cards: layer, priority, target file, deadline, code snippet indicator
- Task detail dialog: implementation steps, code conventions, technical hints (copy-paste), acceptance criteria
- SMART tasks: động từ hành động, nguyên tử, bối cảnh file, gợi ý kỹ thuật

### 💬 Real-time Collaboration
- Chat realtime (Socket.io + polling fallback)
- AI Assistant tham gia chat
- **AI Refine** — đọc chat + edits → sinh lại tất cả sections (có live console log)
- Edit proposals tự động post vào chat
- Typing indicator

### 🔌 GitHub Integration
- **OAuth** — không cần PAT
- **Push to GitHub** — tạo repo (private) + push 15+ files
- **Pull Request** — tạo branch + PR với body markdown
- Dùng GitHub REST API (không cần git CLI)

### 📧 Email SMTP
- Gửi email thật qua Gmail App Password
- SMTP verify trước khi gửi
- Email lời mời, task assigned, deadline reminder
- Mailbox UI xem tất cả email

### 🎨 UI/UX
- Dark theme teal accent
- Mermaid.js UML + **React Flow interactive canvas** (Class + ERD kéo thả)
- Kanban board (dnd-kit)
- Rendered markdown docs (headings, code blocks, tables)
- Zustand persist (form data across reloads)
- beforeunload warning khi AI đang chạy

### 🏠 Project History
- Home page hiển thị tất cả dự án đã tạo
- Click để mở lại workspace (data vẫn còn)
- Xóa dự án (xác nhận "Delete")
- Long-term memory (ProjectContext) — AI nhớ dự án

### 🐳 Docker
- Standalone Dockerfile (multi-stage build)
- SQLite persistent volume
- Healthcheck

---

## 🚀 Cài đặt & Chạy

### Yêu cầu
- [Bun](https://bun.sh) v1+
- [Node.js](https://nodejs.org) v18+
- [OpenRouter API key](https://openrouter.ai/keys) (free, multi-key rotation)
- [GitHub OAuth App](https://github.com/settings/developers) (tùy chọn)
- Gmail App Password (cho email)

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

Script tự động: cài deps → setup DB → khởi động server → tạo Cloudflare Tunnel URL.

👉 Chi tiết: [LOCAL_RUN.md](LOCAL_RUN.md)

---

## ⚙️ Cấu hình `.env`

```env
# Database
DATABASE_URL=file:./db/custom.db

# OpenRouter API (multi-key rotation — thêm bao nhiêu key cũng được)
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_API_KEY_2=sk-or-v1-xxxxx
OPENROUTER_API_KEY_3=sk-or-v1-xxxxx
# ... thêm OPENROUTER_API_KEY_4, _5... tùy ý

# GitHub OAuth
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

---

## 📖 Hướng dẫn sử dụng

### 1. Tạo dự án
- Nhập chủ đề + mô tả + mục đích
- Nhập email + Gmail App Password (nhóm trưởng)
- Thêm thành viên (tên + email + ưu/nhược điểm)
- Bấm **"Khởi tạo Dự Án"** → 8 AI Agent chạy song song với OpenRouter multi-key

### 2. Workspace (7 tabs)
- **Phân Tích** — tech stack, features, actors, modules
- **Nhân Sự** — vai trò, workload, rủi ro
- **Sprint** — timeline, tasks, milestones (ngày hiện tại)
- **Thiết Kế** — architecture, DB schema, API, folder tree
- **UML** — Use Case + Class (interactive) + ERD (interactive) + Sequence
- **Tài Liệu** — README, Convention, API Standard (rendered markdown)
- **Git & Repo** — commands + GitHub OAuth + Push + PR

### 3. Thảo luận & Refine
- Tab **Thảo Luận** — chat + AI Assistant
- **AI Refine** — live console log, sinh lại tất cả sections

### 4. Khởi tạo Todolist (Kanban)
- Bấm **"Khởi tạo Dự Án"** (sidebar)
- AI sinh SMART tasks: layer, targetFile, code snippets, dependencies
- Kéo thả task giữa các cột
- Click task → detail dialog với code snippet + Copy button

### 5. Push lên GitHub
- Tab **Git & Repo** → **"Connect GitHub"** → **"Push to GitHub"**
- Tự tạo repo (private) + branch + Pull Request

---

## 📁 Cấu trúc thư mục

```
Nexus-AI/
├── prisma/
│   └── schema.prisma              # DB schema (Project, Member, Task, TokenLog...)
├── src/
│   ├── app/
│   │   ├── api/                   # API routes (projects, github, chat, tasks)
│   │   ├── layout.tsx             # Root layout (Mermaid CDN)
│   │   └── page.tsx               # Main page (home/input/workspace router)
│   ├── components/
│   │   └── nexus/
│   │       ├── tabs/              # 11 workspace tabs
│   │       │   ├── AnalysisTab.tsx
│   │       │   ├── HRTab.tsx
│   │       │   ├── SprintTab.tsx
│   │       │   ├── DesignTab.tsx
│   │       │   ├── UMLTab.tsx     # React Flow interactive + Mermaid
│   │       │   ├── DocsTab.tsx    # Rendered markdown
│   │       │   ├── GitTab.tsx     # OAuth + Push + PR
│   │       │   ├── ChatTab.tsx    # Real-time + AI Refine console
│   │       │   ├── MembersTab.tsx
│   │       │   ├── TasksTab.tsx   # Kanban board (dnd-kit)
│   │       │   └── MailboxTab.tsx
│   │       ├── HomeView.tsx       # Project history
│   │       ├── InputView.tsx      # Form nhập dự án
│   │       ├── WorkspaceView.tsx  # Main workspace
│   │       ├── ProcessingOverlay.tsx   # Agent board + live log console
│   │       ├── MermaidRenderer.tsx
│   │       └── SectionEditor.tsx
│   ├── lib/
│   │   ├── ai.ts                  # 8-agent pipeline (parallel + fallback)
│   │   ├── openrouter.ts          # OpenRouter multi-key rotation client
│   │   ├── github.ts              # Push + PR creation
│   │   ├── email.ts               # SMTP (nodemailer)
│   │   ├── pipeline-progress.ts   # Background progress + log tracker
│   │   └── types.ts
│   └── store/
│       └── useNexus.ts            # Zustand (persisted)
├── mini-services/
│   └── chat-service/              # Socket.io (port 3001, optional)
├── scripts/
│   ├── run-local.bat              # Windows: chạy + tunnel
│   ├── run-local.ps1              # PowerShell
│   ├── run-local.sh               # macOS/Linux
│   └── parse-tunnel-url.ps1
├── Dockerfile                     # Standalone Docker
├── .env.example
├── LOCAL_RUN.md
└── package.json
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | Prisma ORM + SQLite |
| AI Provider | **OpenRouter** (multi-key rotation, multi-model fallback) |
| Real-time | Socket.io (optional) + HTTP polling |
| Diagrams | Mermaid.js 11 + React Flow (interactive) |
| Kanban | @hello-pangea/dnd |
| State | Zustand (persisted) |
| Email | Nodemailer (Gmail SMTP) |
| Icons | Lucide React |

---

## 🤖 8 AI Agents

| # | Agent | Model (priority) | Vai trò |
|---|---|---|---|
| 01 | Requirement Analyst | GPT-OSS 120B → Nemotron Ultra | Phân tích, tech stack, features |
| 02 | HR Planner | Nemotron Ultra → Gemma 4 | Vai trò, workload, rủi ro |
| 03 | Sprint Planner | Nemotron Ultra → GPT-OSS 120B | Sprint, tasks, milestones |
| 04 | System Architect | GPT-OSS 120B → North-Mini-Code | DB schema, API, folder tree |
| 05 | UML Generator | GPT-OSS 120B → North-Mini-Code | 4 diagrams + relationships |
| 06 | Technical Writer | Gemma 4 → GPT-OSS 120B | README, Convention, API Standard |
| 07 | Git/DevOps | GPT-OSS 120B → North-Mini-Code | Git commands, branch, issue template |
| 08 | Quality Reviewer | GPT-OSS 120B → Gemma 4 | Tổng hợp, đồng bộ |
| - | Task Generator | GPT-OSS 120B → Nemotron | SMART tasks + code snippets |
| - | Chat Assistant | GPT-OSS 120B → Gemma 4 | Hội thoại hướng dẫn code |

**Fallback:** OpenRouter model 1 → model 2 → ... → fallback data (luôn có kết quả)

---

## 📊 Live Log Console

Trong quá trình chạy pipeline, màn hình **ProcessingOverlay** hiển thị **2 bảng song song**:

| Bảng Agent (trái) | Bảng Log Console (phải) |
|---|---|
| Trạng thái 8 agent (pending/running/done/failed) | Realtime log line-by-line |
| Icon + tên agent | Mỗi line: timestamp + provider + model + key# + status |
| Tổng tiến độ % | Color-coded: xanh = success, đỏ = fail, vàng = warn |

Ví dụ log line:
```
14:23:01 [AGENT-01] Requirement Analyst → start
14:23:01 [OpenRouter] Key #1, model: openai/gpt-oss-120b:free
14:23:04 ✓ [AGENT-01] openai/gpt-oss-120b:free (1/2)
14:23:04 [AGENT-02] HR Planner → start
14:23:04 [OpenRouter] Key #1, model: nvidia/nemotron-3-ultra-550b-a55b:free
14:23:08 [KEY ROTATION] OpenRouter Key #1 rate-limited for 60s
14:23:08 [OpenRouter] Key #2, model: nvidia/nemotron-3-ultra-550b-a55b:free
14:23:12 ✓ [AGENT-02] nvidia/nemotron-3-ultra-550b-a55b:free
14:23:12 ✗ [1] cohere/north-mini-code:free → [429] Rate limit exceeded
```

→ Biết chính xác model nào, API key nào còn sống / đã chết để refill kịp thời.

---

## 🔐 Bảo mật

- GitHub OAuth (không cần PAT)
- Chat service verify token trước khi join
- Token lưu DB, chỉ nhóm trưởng có quyền đầy đủ
- GitHub repo tạo private mặc định
- `leaderEmail`, `githubRepoName` chỉ hiện cho nhóm trưởng
- Thu hồi quyền GitHub bất cứ lúc nào

---

## 📝 License

MIT License

---

<p align="center">
  <strong>NEXUS AI</strong> — Multi-Agent Architect<br>
  Powered by OpenRouter Multi-Key + 8 AI Agents 🤖
</p>
