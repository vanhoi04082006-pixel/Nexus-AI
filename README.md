# 🤖 NEXUS AI — Multi-Agent Project Architect

> Hệ thống AI đa tác tử (multi-agent) tự động phân tích dự án, thiết kế hệ thống, lập kế hoạch sprint, phân nhân sự, sinh todolist chi tiết và push code lên GitHub.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101)

---

## 📖 Giới thiệu

**NEXUS AI** sử dụng **8 AI Agent** chuyên biệt để tự động hóa toàn bộ quy trình lập kế hoạch dự án phần mềm. Chỉ cần nhập chủ đề dự án + danh sách thành viên, hệ thống sẽ:

1. **Phân tích chủ đề** — tech stack, features, actors, modules
2. **Phân nhân sự** — vai trò, workload, rủi ro
3. **Lập Sprint** — chia sprint, gán task, deadline, milestones
4. **Thiết kế hệ thống** — database schema, API endpoints, folder structure
5. **Vẽ UML** — Use Case, Class Diagram, ERD, Sequence (Mermaid.js)
6. **Viết tài liệu** — README, Coding Convention, API Standard
7. **Git workflow** — git commands, branch strategy, issue template
8. **Quality Review** — reviewer tổng hợp và đồng bộ

Sau đó nhóm trưởng có thể **khởi tạo dự án** để AI sinh **todolist chi tiết** cho từng thành viên — bao gồm vai trò, trách nhiệm, **quy ước code** (để các thành viên đồng bộ với nhau), dependencies, deadline và tiêu chí hoàn thành.

---

## ✨ Tính năng chính

### 🧠 Multi-Agent AI Pipeline
- 8 Agent chuyên biệt, mỗi Agent có danh sách model riêng + fallback
- Dùng **OpenRouter** với nhiều model free (NVIDIA Nemotron, OpenAI GPT-OSS, Google Gemma, Cohere, Poolside)
- JSON fixer 4 bước: parse → fix → extract → AI self-fix
- Retry + exponential backoff khi model bị rate-limit

### 💬 Real-time Collaboration
- **Chat realtime** qua Socket.io (mini-service riêng port 3001)
- **AI Assistant** tham gia chat, tổng hợp ý kiến
- **AI Refine** — nhóm trưởng bấm 1 nút, AI đọc toàn bộ chat + edits → sinh lại tất cả sections
- **Edit Proposals** — thành viên đề xuất chỉnh sửa, nhóm trưởng duyệt

### 📋 Todolist chi tiết
- Mỗi thành viên có 3-5 task với:
  - Vai trò cụ thể (Frontend/Backend/DevOps...)
  - Trách nhiệm chi tiết
  - **Quy ước code** — ví dụ: *"Hàm `validateUser()` phải trả về boolean"*, *"API `POST /api/login` phải trả về `{success, token}`"*
  - Dependencies (task nào phụ thuộc task nào)
  - Deadline + giờ dự kiến + độ ưu tiên
  - Tiêu chí hoàn thành
- Progress tracking: todo → in_progress → review → done

### 🔌 GitHub Integration
- **OAuth Device Flow** — không cần PAT, chỉ nhập code 1 lần
- **Push to GitHub** — tự tạo repo + push tất cả files (README, docs, UML, todolist...)
- Dùng GitHub REST API (không cần git CLI)

### 📧 Email System (Mock)
- Gửi email mời thành viên khi tạo dự án
- Gửi email thông báo task khi khởi tạo dự án
- Mailbox UI xem tất cả email đã gửi

### 🎨 UI/UX
- Dark theme với accent teal (#00d4aa)
- Mermaid.js render UML diagrams
- Responsive (mobile + desktop)
- SSE → Background+polling (không bị 504 gateway timeout)

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Input    │ │ Workspace│ │ Todolist │ │ Mailbox    │ │
│  │ View     │ │ (7 tabs) │ │ View     │ │ View       │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │ Next.js   │ │ Socket.io │ │ Prisma    │
   │ API Routes│ │ Chat Svc  │ │ + SQLite  │
   │ (port 3000)│ │ (port 3001)│ │           │
   └─────┬─────┘ └───────────┘ └───────────┘
         │
         ▼
   ┌───────────────────────────┐
   │     OpenRouter API         │
   │  (8 AI Agents pipeline)    │
   └───────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| **Backend** | Next.js API Routes (Node.js runtime) |
| **Database** | Prisma ORM + SQLite |
| **Real-time** | Socket.io (mini-service riêng) |
| **AI** | OpenRouter (NVIDIA Nemotron, OpenAI GPT-OSS, Google Gemma, Cohere, Poolside) |
| **Diagrams** | Mermaid.js 11 (via CDN) |
| **State** | Zustand |
| **Icons** | Lucide React |

---

## 🚀 Cài đặt & Chạy

### Yêu cầu
- Node.js 18+ / Bun
- OpenRouter API Key ([lấy miễn phí](https://openrouter.ai/keys))
- GitHub OAuth App (Client ID + Secret) — tùy chọn, cho tính năng push GitHub

### Bước 1: Clone & cài dependencies

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
bun install
```

### Bước 2: Cấu hình environment

Tạo file `.env`:

```env
DATABASE_URL=file:./db/custom.db

# OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# GitHub OAuth (tùy chọn)
GITHUB_CLIENT_ID=xxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxx
```

### Bước 3: Khởi tạo database

```bash
bun run db:push
```

### Bước 4: Chạy dev server

```bash
bun run dev          # Next.js trên port 3000
```

Chat service chạy riêng (port 3001):

```bash
cd mini-services/chat-service
bun install
bun run dev
```

Mở http://localhost:3000 để dùng ứng dụng.

---

## 📖 Hướng dẫn sử dụng

### 1. Tạo dự án
- Nhập **chủ đề dự án** (vd: "Hệ thống quản lý nhân sự")
- Nhập **mô tả**, **mục đích**, **thông tin bổ sung** (requirements, tech prefs, lang prefs)
- Thêm **thành viên** (tên + email + ưu/nhược điểm)
- Nhấn **"Khởi tạo Dự Án"** — 8 AI Agent sẽ chạy

### 2. Workspace
Sau khi pipeline hoàn thành, bạn vào workspace với 7 tab:
- **Phân Tích Chủ Đề** — tech stack, features, actors, modules
- **Phân Nhân Sự** — vai trò, workload, rủi ro
- **Sprint Planning** — sprint timeline, tasks, milestones
- **Thiết Kế Hệ Thống** — architecture, DB schema, API endpoints, folder structure
- **UML Diagrams** — Use Case, Class, ERD, Sequence (Mermaid)
- **Tài Liệu** — README, Coding Convention, API Standard
- **Git & Repo** — git commands, branch strategy, issue template + **GitHub integration**

### 3. Thảo luận & Refine
- Tab **Thảo Luận** — chat realtime với thành viên + AI Assistant
- Nhóm trưởng bấm **"AI Refine"** — AI đọc chat + edits → sinh lại tất cả sections

### 4. Khởi tạo Todolist
- Nhóm trưởng bấm **"Khởi tạo Dự Án"** ở sidebar
- AI sinh todolist chi tiết cho từng thành viên (vai trò, quy ước code, deadline...)
- Email thông báo tự động gửi cho thành viên

### 5. Push lên GitHub
- Tab **Git & Repo** → **"Connect GitHub"** (OAuth Device Flow)
- Bấm **"Push to GitHub"** — tự tạo repo + push tất cả files

---

## 📁 Cấu trúc thư mục

```
Nexus-AI/
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── app/
│   │   ├── api/                   # API routes
│   │   │   ├── projects/          # Project CRUD + pipeline
│   │   │   └── github/            # OAuth + push
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Main page (router)
│   │   └── globals.css
│   ├── components/
│   │   ├── nexus/
│   │   │   ├── tabs/              # 11 workspace tabs
│   │   │   ├── InputView.tsx
│   │   │   ├── WorkspaceView.tsx
│   │   │   ├── ProcessingOverlay.tsx
│   │   │   ├── MermaidRenderer.tsx
│   │   │   └── SectionEditor.tsx
│   │   └── ui/                    # shadcn/ui components
│   ├── lib/
│   │   ├── ai.ts                  # Multi-agent pipeline
│   │   ├── openrouter.ts          # OpenRouter client
│   │   ├── github.ts              # GitHub push logic
│   │   ├── email.ts               # Mock email service
│   │   ├── access.ts              # Access control
│   │   ├── db.ts                  # Prisma client
│   │   ├── types.ts               # TypeScript types
│   │   └── pipeline-progress.ts   # Background progress tracker
│   └── store/
│       └── useNexus.ts            # Zustand store
├── mini-services/
│   └── chat-service/              # Socket.io chat (port 3001)
├── package.json
├── next.config.ts
├── tsconfig.json
└── Caddyfile                      # Gateway config
```

---

## 🤖 8 AI Agents

| # | Agent | Vai trò | Models |
|---|---|---|---|
| 01 | **Requirement Analyst** | Phân tích chủ đề, tech stack, features, actors, modules | NVIDIA Nemotron Ultra/Super, OpenAI GPT-OSS |
| 02 | **HR Planner** | Phân vai trò, workload, rủi ro | NVIDIA Nemotron Ultra, Google Gemma, GPT-OSS |
| 03 | **Sprint Planner** | Chia sprint, gán task, deadline | NVIDIA Nemotron Ultra/Super, GPT-OSS |
| 04 | **System Architect** | Thiết kế DB, API, folder structure | Poolside Laguna, GPT-OSS, Cohere |
| 05 | **UML Generator** | Vẽ 4 biểu đồ Mermaid (Use Case, Class, ERD, Sequence) | Poolside Laguna, GPT-OSS, Cohere |
| 06 | **Technical Writer** | Viết README, Convention, API Standard | Google Gemma, GPT-OSS |
| 07 | **Git/DevOps** | Git commands, branch strategy, issue template | Poolside Laguna, Cohere |
| 08 | **Quality Reviewer** | Tổng hợp, đồng bộ, sửa lỗi 7 Agent trên | NVIDIA Nemotron, GPT-OSS, Gemma |

---

## 🔐 Bảo mật

- **Không cần PAT** — GitHub OAuth Device Flow, user chỉ nhập code 1 lần
- Token lưu trong database, chỉ nhóm trưởng có quyền truy cập
- Thành viên chỉ xem (không sửa) + chat + đề xuất chỉnh sửa
- Có thể thu hồi quyền GitHub bất cứ lúc nào từ GitHub Settings

---

## 📝 License

MIT License — tự do sử dụng, chỉnh sửa và phân phối.

---

## 🙏 Credits

- **OpenRouter** — cung cấp API multi-model AI
- **Mermaid.js** — render UML diagrams
- **shadcn/ui** — UI component library
- **Socket.io** — real-time communication

---

<p align="center">
  <strong>NEXUS AI</strong> — Multi-Agent Architect<br>
  Powered by 8 AI Agents 🤖
</p>
