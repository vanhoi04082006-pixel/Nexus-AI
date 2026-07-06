# 📐 NEXUS AI — Architecture

> System design, data flow, components, và design decisions.

## 📑 Mục lục

- [Overview](#-overview)
- [High-Level Architecture](#-high-level-architecture)
- [Component Diagram](#-component-diagram)
- [Multi-Agent Pipeline](#-multi-agent-pipeline)
- [Data Flow](#-data-flow)
- [Dashboard Widgets](#-dashboard-widgets)
- [Notification & Mail System](#-notification--mail-system)
- [Mermaid Rendering (3-tier fix)](#-mermaid-rendering-3-tier-fix)
- [Live Log Console (AsyncLocalStorage)](#-live-log-console-asynclocalstorage)
- [Multi-Key Rotation](#-multi-key-rotation)
- [Database Schema](#-database-schema)
- [Real-time (Socket.io + Polling)](#-real-time-socketio--polling)
- [GitHub Integration](#-github-integration)
- [State Management](#-state-management)
- [Design Decisions](#-design-decisions)

---

## 🎯 Overview

NEXUS AI là một **single-page Next.js application** chạy hoàn toàn local (hoặc Docker/Fly.io). Backend là Next.js API Routes (Node.js runtime), database là SQLite qua Prisma ORM, real-time qua 2 Socket.io mini-services.

**Design principles:**

1. **Background + Polling** thay vì SSE (fix 504 gateway timeout)
2. **Multi-provider fallback** — không bao giờ crash, luôn có kết quả (5 retries/model × 9 models/agent × multi-key)
3. **Multi-key rotation** — tối ưu free tier, auto-switch khi 429
4. **AsyncLocalStorage** cho log context (không truyền tham số qua 10 layers)
5. **Long-term memory** — AI nhớ dự án qua `ProjectContext`
6. **Parallel execution** — Phase 2 + Phase 3 agents chạy song song (mặc định)
7. **3-tier Mermaid fix** — regex → aggressive → AI (luôn render được diagram)
8. **Per-user state** — notifications và mail có read tracking riêng cho mỗi user
9. **Dark theme only** — single theme, teal accent, no light mode

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  React 19 + Next.js 16 (App Router, Turbopack)             │ │
│  │  Tailwind 4 + shadcn/ui (New York)                         │ │
│  │  Zustand 5 (persisted) + TanStack Query 5                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        ↕ HTTP (REST)                  ↕ WebSocket (Socket.io)
┌──────────────────────────────────────┐   ┌──────────────────────────────┐
│  Next.js API Routes (port 3000)      │   │  Mini-services               │
│  ┌────────────────────────────────┐  │   │  ┌────────────────────────┐ │
│  │  50+ REST endpoints           │  │   │  │ chat-service (3001)    │ │
│  │  + 10-agent pipeline (bg)     │──┼───┼─→│  Socket.io realtime    │ │
│  │  + Mermaid AI fixer           │  │   │  │  chat                   │ │
│  │  + Mail SMTP sender           │  │   │  └────────────────────────┘ │
│  │  + Notification broadcaster   │──┼───┼─→┌────────────────────────┐ │
│  │  + Activity logger            │  │   │  │ notification-service   │ │
│  └────────────────────────────────┘  │   │  │  (port 3002)           │ │
│                                      │   │  │  Socket.io notifications│ │
│                                      │   │  │  + HTTP /broadcast*    │ │
│                                      │   │  └────────────────────────┘ │
└──────────────────────────────────────┘   └──────────────────────────────┘
        │                                              │
        ▼                                              ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────┐
│  SQLite (Prisma 6)                   │   │  External APIs               │
│  21 models                           │   │  OpenRouter (multi-key,      │
│  ┌────────────────────────────────┐  │   │   9 free models/agent)      │
│  │ Project + Member + Analysis    │  │   │  GitHub (OAuth + push)       │
│  │ Task + TaskLog                 │  │   │  SMTP (nodemailer)           │
│  │ Email + Mailbox + Attachment   │  │   └──────────────────────────────┘
│  │ Notification + NotificationRead│  │
│  │ ActivityLog (enriched)         │  │
│  │ AgentStatus + SystemStatus     │  │
│  │ PipelineStatus + TaskStatistic │  │
│  │ ProjectContext + TokenLog      │  │
│  │ Template + AgentConfig         │  │
│  │ ChatMessage + EditProposal     │  │
│  │ EmailLog (legacy) + MailRead   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

## 🧩 Component Diagram

### Frontend Views

```
src/components/nexus/
├── HomeView.tsx              ← Trang tổng quan (dashboard widgets)
│   ├── Recent Activity widget
│   ├── NEXUS AI Status widget
│   └── Tasks đang làm widget
├── AllProjectsView.tsx       ← Premium SaaS dashboard
│   ├── Stats cards
│   ├── Search + Filter + Sort
│   ├── Grid/List toggle
│   └── Context menu (favorite/archive/duplicate/delete)
├── InputView.tsx             ← Create project form
├── WorkspaceView.tsx         ← Project workspace (13 tabs)
│   └── tabs/
│       ├── AnalysisTab       (Agent 01 — analysis section)
│       ├── HRTab             (Agent 02 — hr section)
│       ├── SprintTab         (Agent 03 — sprint section)
│       ├── DesignTab         (Agent 04 — design section)
│       ├── UMLTab            (Agent 05 — uml section, Mermaid + React Flow)
│       ├── DocsTab           (Agent 06 — docs section)
│       ├── GitTab            (Agent 07 — git section)
│       ├── ChatTab           (realtime chat)
│       ├── MembersTab        (member management)
│       ├── TasksTab          (Kanban board, drag-drop)
│       ├── MailboxTab        (mail compose/list/read)
│       ├── HistoryTab        (activity log)
│       └── AgentHubTab       (10 AI agents dashboard)
├── AgentHubView.tsx          ← Standalone agent hub
├── NotificationBell.tsx      ← Bell + dropdown + detail modal
├── MermaidRenderer.tsx       ← 3-tier fix (regex → aggressive → AI)
├── ProcessingOverlay.tsx     ← Pipeline Live Log
├── TaskProcessingOverlay.tsx ← Init/Refine Live Log
├── NeuralBackground.tsx      ← Animated neural network bg
└── AI3DBrain.tsx             ← 3D hero brain animation
```

### Backend libs

```
src/lib/
├── ai.ts                  ← 10-agent pipeline + retry + fallback + task gen
├── openrouter.ts          ← Multi-key rotation + multi-model fallback
├── github.ts              ← Push 17+ files + create PR
├── email.ts               ← SMTP send via nodemailer
├── notifications.ts       ← createNotification + broadcast to mini-service
├── activity.ts            ← logActivity + updateSystemStatus + updatePipelineStatus
├── pipeline-progress.ts   ← AsyncLocalStorage + progress maps (pipeline/init/refine)
├── access.ts              ← resolveAccess + requireLeader
├── schemas.ts             ← Zod validators per section type
├── db.ts                  ← Prisma client singleton
├── types.ts               ← ProjectResult, TaskItem, SectionType, ...
└── utils.ts               ← cn() helper
```

---

## 🤖 Multi-Agent Pipeline

### 6 Phases

```
┌────────────────────────────────────────────────────────────────┐
│ PHASE 1 — Analysis (Sequential, mỗi agent phụ thuộc cái trước) │
│   Agent 01 (Requirement Analyst) → Agent 02 (HR Planner)      │
│   → Agent 03 (Sprint Planner)                                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ PHASE 2 — Design (Parallel mặc định, hoặc Sequential)          │
│   Agent 04 (System Architect)  ┐                               │
│   Agent 05 (UML Generator)     │ → Promise.all()               │
│   Agent 06 (Technical Writer)  │                               │
│   Agent 07 (Git/DevOps)        ┘                               │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ PHASE 3 — Quality Gates (Parallel hoặc Sequential)             │
│   Agent 08 (Software Tester)   ┐                               │
│   Agent 09 (Security Reviewer) ┘ → Promise.all()               │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ PHASE 4 — Retry (cho agent thất bại)                          │
│   failed.forEach(agent => retry 1 lần sau 5s)                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ PHASE 5 — Fallback (cho agent vẫn fail sau retry)             │
│   if (agent.required) → fallback(key, input, results)          │
│   (sinh dữ liệu tĩnh — pipeline KHÔNG BAO GIỜ crash)           │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ PHASE 6 — Quality Review (Agent 10)                           │
│   Nhận 9 sections → Zod validate → fix conflicts → sync       │
│   → final ProjectResult                                        │
└────────────────────────────────────────────────────────────────┘
```

### Per-agent retry strategy

Mỗi agent có **9 free models** OpenRouter. Mỗi model có **5 retries** với:

- **Full-jitter backoff** — random delay trong window `[0, base × 2^attempt]`, max 60s
- **429 rate-limit** — wait 60s + jitter, retry same model
- **5xx/timeout** — wait 60s, retry same model (model có thể chậm, không hỏng)
- **Network error** — try next model ngay
- **Concurrency limit** — max 3 parallel LLM calls (`p-limit`) để tránh memory blowup + rate-limit spikes

### Pipeline modes

| Mode | Cấu hình | Khi nào dùng |
|---|---|---|
| `parallel` (default) | `input.parallel = true` | Khi OpenRouter không bị rate-limit, chạy nhanh hơn |
| `sequential` | `input.parallel = false` | Khi bị 429 liên tục, tránh spike requests |

---

## 📊 Data Flow

### Tạo project mới

```
User submit form
      │
      ▼
POST /api/projects
      │
      ├─→ db.project.create()
      ├─→ db.member.createMany()
      ├─→ runWithProjectLog(projectId, () => runPipeline(input, onProgress))
      │         │ (background, không block response)
      │         │
      │         ├─→ PHASE 1: analysis → hr → sprint (sequential)
      │         ├─→ PHASE 2: design + uml + docs + git (parallel)
      │         ├─→ PHASE 3: test + security (parallel)
      │         ├─→ PHASE 4: retry failed agents
      │         ├─→ PHASE 5: fallback for still-failed
      │         ├─→ PHASE 6: Quality Reviewer
      │         ├─→ db.analysis.upsert() per section
      │         ├─→ db.projectContext.upsert() (long-term memory)
      │         ├─→ db.tokenLog.create() per agent call
      │         ├─→ db.activityLog.create() per phase
      │         └─→ db.project.update({ status: "WORKSPACE" })
      │
      └─→ Response 200 { projectId, leaderToken }  ← trả ngay

Client polls GET /api/projects/:id/progress?token=xxx mỗi 2.5s
      │
      ├─→ getProgress(projectId) ← in-memory map (expire 5 phút)
      │     { status, agents[], logs[], startedAt }
      │
      └─→ Khi status === "done" → stop polling → load workspace
```

### Initialize todolist

```
User click "Sinh Todolist" trong Tasks tab
      │
      ▼
POST /api/projects/:id/initialize?token=xxx  (leader only)
      │
      ├─→ db.task.deleteMany({ projectId })  (clean slate)
      ├─→ runWithInitLog(projectId, () => generateTasks(project, results, members))
      │         │ (background)
      │         │
      │         ├─→ For each member (parallel):
      │         │     - build context (role, skills, modules)
      │         │     - call AI with TASK prompt (multi-model fallback)
      │         │     - parse JSON → TaskItem[]
      │         │     - DEDUP: check trùng title/description với task đã có
      │         │     - COMPREHENSIVENESS check: đảm bảo đủ layer (DB/BACKEND/UI/CONFIG/TESTING)
      │         │     - db.task.createMany()
      │         │     - db.taskLog.create() per task
      │         │     - db.activityLog.create() (TASK_GEN)
      │         │
      │         └─→ refreshTaskStatistics(projectId)
      │
      └─→ Response 200 { started: true }

Client polls GET /api/projects/:id/initialize/progress mỗi 2.5s
```

### AI Refine

```
User submit edit requests + chat discussion
      │
      ▼
POST /api/projects/:id/refine?token=xxx  (leader only)
      │
      ├─→ runWithRefineLog(projectId, () => refineSections(project, editRequests, chatDiscussion))
      │         │ (background)
      │         │
      │         ├─→ For each section (parallel):
      │         │     - read current content (from Analysis hoặc ProjectContext)
      │         │     - build refine prompt (current + edit request + chat context)
      │         │     - call AI (multi-model fallback)
      │         │     - Zod validate
      │         │     - db.analysis.update() with version bump
      │         │     - mark sections[section] = true trong progress map
      │         │
      │         └─→ db.activityLog.create() (REFINE)
      │
      └─→ Response 200 { started: true }

Client polls GET /api/projects/:id/refine/progress mỗi 2.5s
```

---

## 📊 Dashboard Widgets

Trang tổng quan (Home view) có 3 widget realtime:

### 1. Recent Activity

- **Data source:** `ActivityLog` (20+ event types)
- **API:** `GET /api/dashboard/activity?token=xxx&limit=20`
- **Realtime:** WebSocket `activity:new` event từ notification-service
- **UI:** List timeline với icon (lucide), actor avatar, action button click-through

### 2. NEXUS AI Status

- **Data source:** `AgentStatus` (10 agents) + `PipelineStatus` + `SystemStatus` + env keys
- **API:** `GET /api/dashboard/status?token=xxx`
- **Realtime:** WebSocket `status:update` event
- **UI:** Grid cards cho:
  - AI Agents (total/online/offline/busy/idle/error)
  - API Keys (total/active/expired/near-quota)
  - Pipeline (status + current agent + progress)
  - Database / Redis / Vector DB / Storage (connected/disconnected/...)

### 3. Tasks đang làm

- **Data source:** `Task` (in_progress/overdue/due_soon của user)
- **API:** `GET /api/dashboard/tasks?token=xxx&filter=in_progress|overdue|due_soon|assigned|all`
- **Realtime:** WebSocket `task:update` event
- **UI:** List tasks với priority badge, deadline countdown, project topic

### WebSocket connection

Frontend kết nối notification-service (port 3002) khi mount HomeView:

```typescript
const socket = io("/?XTransformPort=3002");
socket.emit("join", { dashboard: true, userEmail, token });
socket.on("activity:new", (data) => refreshActivity());
socket.on("task:update", (data) => refreshTasks());
socket.on("status:update", (data) => refreshStatus());
```

> Nếu notification-service không chạy, frontend tự fallback sang HTTP polling (refresh mỗi 10s).

---

## 🔔 Notification & Mail System

### Notification Center

```
┌────────────────────────────────────────────────────────────┐
│ Component: NotificationBell.tsx                            │
│   - Bell icon với unread badge                             │
│   - Dropdown list (10 items gần nhất)                      │
│   - Detail modal (full message + action button)            │
│   - Mark read / Mark all read / Mark unread                │
└────────────────────────────────────────────────────────────┘
                          ↕
┌────────────────────────────────────────────────────────────┐
│ API: /api/projects/[id]/notifications                      │
│   - GET: list visible to user (broadcast OR recipientEmail)│
│   - POST: create (internal) / mark_all_read                │
│   - PATCH /:notifId: mark read/unread                      │
│   - DELETE /:notifId: delete (leader only)                 │
└────────────────────────────────────────────────────────────┘
                          ↕
┌────────────────────────────────────────────────────────────┐
│ DB:                                                        │
│   - Notification (broadcast OR targeted via recipientEmail)│
│   - NotificationRead (per-user read tracking, unique constraint)
│   - 13 types: TASK_COMPLETED, TASK_STATUS_CHANGED,         │
│     PROPOSAL_CREATED, REQUIREMENT_EDITED, DOC_UPLOADED,    │
│     COMMENT, AI_DONE, AI_ERROR, DEADLINE_SOON,             │
│     TASK_ASSIGNED, MAIL_RECEIVED, PROJECT_INVITE,          │
│     APPROVAL_REQUEST                                       │
└────────────────────────────────────────────────────────────┘
                          ↕
┌────────────────────────────────────────────────────────────┐
│ Realtime: notification-service (port 3002)                 │
│   - createNotification() → POST /broadcast                 │
│   - Socket.io rooms: project:ID + user:EMAIL + dashboard   │
│   - Event: notification:new                                │
│   - Per-user unread badge sync (notification_read echo)    │
└────────────────────────────────────────────────────────────┘
```

### Mail System

```
┌────────────────────────────────────────────────────────────┐
│ Component: MailboxTab.tsx                                  │
│   - 7 folders: INBOX / SENT / DRAFT / STARRED /            │
│     ARCHIVE / SPAM / TRASH                                 │
│   - Compose modal (rich text editor @mdxeditor)            │
│   - AI Rewrite button (5 modes: improve/professional/      │
│     friendly/concise/expand)                               │
│   - Attachments upload (max 5MB/file)                      │
│   - Reply / Reply-all / Forward (threading via parentEmailId)
│   - Star / Archive / Trash / Move folder                   │
└────────────────────────────────────────────────────────────┘
                          ↕
┌────────────────────────────────────────────────────────────┐
│ API: /api/projects/[id]/mailbox                            │
│   - GET: list mails in folder (with pagination + search)   │
│   - POST: compose + send SMTP (leader only)                │
│   - GET /:mailId: single mail with body + attachments      │
│   - PATCH /:mailId: per-user state (read/star/archive/trash)
│   - DELETE /:mailId: permanent (leader) / soft (member)    │
│   - /ai-rewrite: POST → rewritten HTML                     │
│   - /attachments: POST (multipart) / GET :attId / DELETE   │
└────────────────────────────────────────────────────────────┘
                          ↕
┌────────────────────────────────────────────────────────────┐
│ DB:                                                        │
│   - Email (1 row per mail sent — from/to/cc/bcc/body/type) │
│   - EmailAttachment (base64 content)                       │
│   - Mailbox (per-user state: folder/isRead/isStarred/...)  │
│   - MailRead (audit log per user)                          │
└────────────────────────────────────────────────────────────┘
                          ↕
┌────────────────────────────────────────────────────────────┐
│ External: SMTP via nodemailer (leader credentials)         │
│   - leaderSmtpPassword lưu trong Project                   │
│   - Gmail App Password format: "xxxx xxxx xxxx xxxx"       │
│   - smtpStatus: pending | sent | failed | logged_only      │
└────────────────────────────────────────────────────────────┘
                          ↕
┌────────────────────────────────────────────────────────────┐
│ Realtime: notification-service (port 3002)                 │
│   - Khi mail gửi → POST /broadcast-mail                    │
│   - Socket.io event: mail:new (badge increment on Mail icon)
│   - Per-user mail_read echo (sync giữa các tab)            │
└────────────────────────────────────────────────────────────┘
```

---

## 📐 Mermaid Rendering (3-tier fix)

Mermaid diagram đôi khi bị syntax error (đặc biệt với node ID tiếng Việt). NEXUS AI có 3-tier fix để **luôn render được diagram**:

### Tier 1: `fixMermaid()` (regex)

Fix nhanh các lỗi phổ biến:
- Thiếu space giữa `graph` và `TD`
- Node ID có dấu tiếng Việt → giữ nguyên (không ASCII hóa)
- Thiếu quote cho label có ký tự đặc biệt
- Sửa `|label|` thành `:label` cho classDiagram

### Tier 2: `aggressiveFix()` (stronger regex)

Fix mạnh hơn:
- **Node ID normalization**: `Bệnh nhân` → `BenhNhan`, `Dược sĩ` → `DuocSi` (remove dấu tiếng Việt)
- **Quote labels**: `BenhNhan["Bệnh nhân"]` thay vì `BenhNhan[Bệnh nhân]`
- **Special chars escape**: escape `[`, `]`, `(`, `)`, `{`, `}` trong labels

### Tier 3: AI Auto-Fix (OpenRouter)

Nếu 2 tier trên vẫn không render được:

```
MermaidRenderer.tsx
      │
      ├─→ Try render với mermaid.render()
      │
      ├─→ If error:
      │     ├─→ Try fixMermaid(code)
      │     ├─→ Try render again
      │     │
      │     ├─→ If still error:
      │     │     ├─→ Try aggressiveFix(code)
      │     │     ├─→ Try render again
      │     │     │
      │     │     ├─→ If still error:
      │     │     │     ├─→ POST /api/projects/[id]/fix-mermaid
      │     │     │     │     { code, error, diagramType }
      │     │     │     │
      │     │     │     │     └─→ OpenRouter AI sửa syntax:
      │     │     │     │          - System prompt với 7 quy tắc
      │     │     │     │          - 4 models fallback: gpt-oss-120b, nemotron-ultra, gemma-4-31b, qwen3-coder
      │     │     │     │          - Trả về fixed Mermaid code
      │     │     │     │
      │     │     │     ├─→ Try render again với fixed code
      │     │     │     │
      │     │     │     └─→ If still error: show error + raw code
```

> **Design decision:** 3-tier thay vì chỉ AI để:
> 1. **Tiết kiệm tokens** — regex fix nhanh, không tốn API call
> 2. **Độ tin cậy cao** — AI có thể fail (rate-limit, model chết), regex luôn deterministic
> 3. **UX tốt hơn** — AI fix mất 2-5s, regex fix < 10ms

---

## 📊 Live Log Console (AsyncLocalStorage)

Live Log Console hiện realtime logs trong 3 overlay:
- `ProcessingOverlay.tsx` — Pipeline (tạo project mới)
- `TaskProcessingOverlay.tsx` mode="init" — Sinh todolist
- `TaskProcessingOverlay.tsx` mode="refine" — AI Refine

### AsyncLocalStorage pattern

```typescript
// src/lib/pipeline-progress.ts
const pipelineAls = new AsyncLocalStorage<string>();  // projectId
const initAls = new AsyncLocalStorage<string>();      // projectId
const refineAls = new AsyncLocalStorage<string>();    // projectId

// Maps: projectId → { status, agents[], logs[], startedAt, ... }
const pipelineMap = new Map<string, ProgressState>();
const initMap = new Map<string, InitState>();
const refineMap = new Map<string, RefineState>();

export function runWithProjectLog<T>(projectId: string, fn: () => T): T {
  return pipelineAls.run(projectId, fn);
}
export function runWithInitLog<T>(projectId: string, fn: () => T): T {
  return initAls.run(projectId, fn);
}
export function runWithRefineLog<T>(projectId: string, fn: () => T): T {
  return refineAls.run(projectId, fn);
}

export function appendLog(entry: Omit<LogEntry, "id" | "ts">): void {
  // Tự route đến đúng context (innermost first):
  // 1. refineAls (AI Refine đang chạy)
  // 2. initAls (Task generation đang chạy)
  // 3. pipelineAls (Pipeline chính đang chạy)
  const refinePid = refineAls.getStore();
  if (refinePid) { pushLog(refineMap, refinePid, entry); return; }

  const initPid = initAls.getStore();
  if (initPid) { pushLog(initMap, initPid, entry); return; }

  const pipelinePid = pipelineAls.getStore();
  if (pipelinePid) { pushLog(pipelineMap, pipelinePid, entry); return; }

  // Không có context active → log bị drop (silent)
}
```

### Log entry format

```typescript
interface LogEntry {
  id: string;          // unique per log
  ts: number;          // timestamp ms
  level: "info" | "success" | "warn" | "error";
  agentId?: string;    // "01".."10" | "TASK" | "REFINE" | "PIPELINE"
  provider?: "pipeline" | "openrouter" | "cache" | "fallback";
  model?: string;      // "openai/gpt-oss-120b:free"
  keyIndex?: number;   // 1-based API key index
  message: string;
}
```

### Log line format (hiển thị)

```
14:23:01 [AGENT-01] [OR] [#1] [OpenRouter] Key #1, model: openai/gpt-oss-120b:free
14:23:02 [AGENT-01] [PIPELINE] [AGENT-01] Requirement Analyst → start (parallel)
14:23:08 [AGENT-01] [OR] [#1] [OpenRouter] ✓ 200 OK (1.234s, 1500+2000 tokens)
14:23:08 [AGENT-01] [PIPELINE] ✓ [AGENT-01] Requirement Analyst → done (openai/gpt-oss-120b:free)
```

---

## 🔑 Multi-Key Rotation

OpenRouter free tier có rate-limit (20 req/min per key). NEXUS AI support **multi-key rotation** để scale.

### Cấu hình

```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-key1...
OPENROUTER_API_KEY_2=sk-or-v1-key2...
OPENROUTER_API_KEY_3=sk-or-v1-key3...
# ... thêm bao nhiêu cũng được
```

### Rotation logic

```typescript
// src/lib/openrouter.ts
function getApiKeys(): { key: string; index: number }[] {
  // Đọc tất cả OPENROUTER_API_KEY* từ env
  // Trả về array theo thứ tự index
}

let currentKeyIndex = 0;
let lastResetTime = Date.now();
const requestCount = new Map<number, number>();  // keyIndex → count in window

function nextKey(): { key: string; index: number } {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("No API keys configured");

  // Reset counter mỗi 60s
  if (Date.now() - lastResetTime > 60_000) {
    requestCount.clear();
    lastResetTime = Date.now();
  }

  // Round-robin
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  const k = keys[currentKeyIndex];
  requestCount.set(k.index, (requestCount.get(k.index) || 0) + 1);
  return k;
}
```

### Khi bị 429 (rate-limit)

```typescript
if (err.status === 429) {
  // Wait 60s + jitter, retry same key
  const waitMs = 60_000 + Math.random() * 30_000;
  await sleep(waitMs);
  // Continue to next retry attempt
}
```

---

## 🗄️ Database Schema

21 models (SQLite via Prisma) — chi tiết tại [`prisma/schema.prisma`](../prisma/schema.prisma).

### ERD Overview

```
Project (1) ─── (N) Member
Project (1) ─── (N) Analysis      (versioned per section type)
Project (1) ─── (N) Task          (Kanban + developer-first fields)
Project (1) ─── (N) ChatMessage
Project (1) ─── (N) EditProposal
Project (1) ─── (1) ProjectContext  (long-term memory cache)
Project (1) ─── (N) TokenLog        (cost tracking)
Project (1) ─── (N) ActivityLog     (enriched with actor + relations)
Project (1) ─── (N) Notification
Project (1) ─── (N) Email
Project (1) ─── (N) EmailLog        (legacy)
Project (1) ─── (N) AgentConfig
Project (1) ─── (N) PipelineStatus
Project (1) ─── (1) TaskStatistic   (cached aggregate)

Task (1) ─── (N) TaskLog            (audit trail)
Task (1) ─── (1) Member             (assignee, optional)

Email (1) ─── (N) EmailAttachment
Email (1) ─── (N) Mailbox           (per-user state, unique [emailId, userEmail])
Email (1) ─── (N) MailRead          (audit per user)
Email (1) ─── (1) Email             (parentEmailId — threading reply/forward)

Notification (1) ─── (N) NotificationRead  (per-user read, unique [notifId, readerEmail])

AgentStatus (1) ─── (1) agentId     (live agent state)
SystemStatus (1) ─── (1) subsystem  (singleton per subsystem)
Template (N)                          (project blueprints, standalone)
```

### Key design choices

- **SQLite** thay vì PostgreSQL: zero-config, file-based, dễ deploy local/Docker. Đánh đổi: không có enums (dùng `String` + union type), không có native arrays (dùng `String` JSON).
- **Soft state in Mailbox** thay vì delete: user có thể undo (move từ TRASH về INBOX).
- **Per-user read tracking** (NotificationRead, MailRead): một notification có thể unread cho user A nhưng read cho user B.
- **ProjectContext**: cache long-term memory để retry/refine không tốn tokens re-reading.
- **TaskLog**: audit trail riêng cho task mutations (.CREATED/.UPDATED/.STATUS_CHANGED/.COMPLETED/.ASSIGNED/.DEADLINE_CHANGED).
- **ActivityLog enriched**: actorName/actorEmail/actorRole/actorAvatar + relatedTaskId/relatedMailId + actionUrl/actionLabel — để dashboard "Recent Activity" widget render rich rows.

---

## ⚡ Real-time (Socket.io + Polling)

### 2 mini-services

| Service | Port | Purpose |
|---|---|---|
| **chat-service** | 3001 | Realtime chat (Socket.io `chat_message` event) |
| **notification-service** | 3002 | Realtime notifications + activity + task + status broadcasts |

### Rooms (notification-service)

| Room | Who joins | Use case |
|---|---|---|
| `dashboard` | Tất cả sockets | Broadcast activity/task/status tới Home dashboard widgets |
| `project:ID` | Members of project | Project-scoped notifications + mail + task updates |
| `user:EMAIL` | Single user | Targeted notifications + personal mail alerts |

### HTTP broadcast endpoints (internal — Next.js calls these)

| Method | Path | Broadcasts |
|---|---|---|
| `POST` | `/broadcast` | `notification:new` → `project:ID` + `user:EMAIL` |
| `POST` | `/broadcast-mail` | `mail:new` → `project:ID` |
| `POST` | `/broadcast-activity` | `activity:new` → `dashboard` + `project:ID` |
| `POST` | `/broadcast-task` | `task:update` → `dashboard` + `project:ID` |
| `POST` | `/broadcast-status` | `status:update` → `dashboard` |
| `GET` | `/health` | Health check |

### Fallback (HTTP polling)

Nếu mini-services không chạy:
- **Chat**: frontend polls `GET /api/projects/:id/chat` mỗi 3s
- **Notifications**: polls `GET /api/projects/:id/notifications` mỗi 10s
- **Dashboard widgets**: polls `/api/dashboard/activity|status|tasks` mỗi 10s

> **Note:** Mini-services KHÔNG persist state. Nếu service restart, sockets reconnect + re-fetch via REST.

---

## 🐙 GitHub Integration

### OAuth Flow

```
1. User click "Connect GitHub" trong Git tab
2. Browser → GET /api/github/auth?projectId=ID&token=LEADER_TOKEN
3. Redirect → https://github.com/login/oauth/authorize?client_id=...&scope=repo&state=...
4. User authorize trên GitHub
5. GitHub redirect → GET /api/github/callback?code=CODE&state=STATE
6. Server: exchange CODE → access_token (server-to-server)
7. db.project.update({ githubToken, githubUsername })
8. Redirect → /?p=PROJECT_ID&token=LEADER_TOKEN
```

### Push Flow

```
User click "Push to GitHub" → POST /api/github/push
      │
      ├─→ Verify GitHub connected (githubToken !== null)
      ├─→ Build files (17+ files):
      │     - README.md
      │     - .gitignore
      │     - PROJECT_SUMMARY.md
      │     - FOLDER_STRUCTURE.txt
      │     - docs/CODING_CONVENTION.md
      │     - docs/API_STANDARD.md
      │     - docs/ARCHITECTURE.md
      │     - docs/DATABASE.md
      │     - docs/API_ENDPOINTS.md
      │     - docs/SPRINT_PLAN.md
      │     - docs/TEAM.md
      │     - docs/TASKS.md
      │     - docs/UML/{use-case,class-diagram,erd,sequence}.mmd
      │     - .github/ISSUE_TEMPLATE/task.md
      │
      ├─→ scripts/push-to-github.js:
      │     - Create branch "nexus-ai-init"
      │     - Create tree + commit via GitHub REST API
      │     - Update ref (push branch)
      │     - Create Pull Request
      │
      ├─→ db.project.update({ githubRepoName, githubPushedAt })
      ├─→ db.activityLog.create({ type: "GITHUB_PUSH" })
      │
      └─→ Response { repoUrl, prUrl, filesPushed }
```

---

## 🗃️ State Management

### Zustand store (`useNexus.ts`)

```typescript
interface NexusState {
  // Navigation
  view: "home" | "projects" | "input" | "workspace" | "agenthub";
  activeTab: SectionType | "chat" | "members" | "tasks" | "mailbox" | "history" | "agenthub";

  // Project context
  projectId: string | null;
  token: string | null;
  access: AccessInfo | null;
  project: ProjectInfo | null;
  result: ProjectResult | null;

  // Collections
  tasks: TaskItem[];
  members: MemberInfo[];
  chatMessages: ChatMessage[];

  // Pipeline progress (Live Log Console)
  pipelineProgress: ProgressState | null;
  initProgress: InitState | null;
  refineProgress: RefineState | null;

  // Actions
  setView(view): void;
  setActiveTab(tab): void;
  loadProject(id, token): Promise<void>;
  startPipeline(input): Promise<void>;
  pollPipeline(): Promise<void>;
  // ... (persisted via Zustand persist middleware)
}
```

### Persisted fields

- `view`, `activeTab`, `projectId`, `token` (lưu localStorage để reload page không mất context)

### TanStack Query

Dùng cho dashboard widgets (Recent Activity, NEXUS AI Status, Tasks đang làm) — auto refetch + cache + invalidation.

---

## 🎯 Design Decisions

### 1. Background + Polling thay vì SSE/WebSocket cho pipeline

**Vấn đề:** Pipeline chạy 5-10 phút. SSE/WebSocket long-lived bị Cloudflare/Fly.io timeout (504 Gateway Timeout).

**Giải pháp:** Pipeline chạy background (không block HTTP request). Client polls mỗi 2.5s. Progress lưu trong in-memory Map (expire 5 phút).

**Trade-off:** Tốn thêm HTTP requests, nhưng reliable + scale được.

### 2. Multi-key rotation + Multi-model fallback

**Vấn đề:** OpenRouter free tier rate-limit 20 req/min per key. 10 agents × 9 models = 90 requests có thể spike.

**Giải pháp:**
- Multi-key: round-robin + 60s window counter
- Multi-model: 9 models/agent, retry 5 lần/model, full-jitter backoff
- Concurrency limit: max 3 parallel LLM calls (`p-limit`)

### 3. AsyncLocalStorage cho log context

**Vấn đề:** Log entry cần biết nó thuộc pipeline nào (pipeline/init/refine). Truyền `projectId` qua 10 layers function call rất verbose.

**Giải pháp:** AsyncLocalStorage — `runWithProjectLog(pid, fn)` set context, `appendLog()` tự đọc context. Code sạch, không leak abstraction.

### 4. 3-tier Mermaid fix

**Vấn đề:** Mermaid syntax error thường gặp (đặc biệt node ID tiếng Việt). AI fix tốn tokens + có thể fail.

**Giải pháp:**
1. Regex `fixMermaid()` — fix nhanh, 0 tokens
2. Regex `aggressiveFix()` — fix mạnh hơn (ASCII hóa node ID)
3. AI Auto-Fix — last resort, qua OpenRouter

### 5. Per-user read tracking (NotificationRead, MailRead)

**Vấn đề:** Notification/Mail broadcast (`recipientEmail=null`) tới nhiều user. Mỗi user cần read state riêng.

**Giải pháp:** Bảng riêng `NotificationRead` (unique `[notifId, readerEmail]`) + `MailRead`. Notification "unread" cho user khi không có `NotificationRead` row.

### 6. Dark theme only

**Vấn đề:** NEXUS AI là SaaS dashboard phức tạp. Hỗ trợ light + dark tốn effort thiết kế + maintain.

**Giải pháp:** Chỉ dark theme (teal accent). `globals.css` chỉ có 1 theme. Don't need `next-themes` provider cho light/dark switch.

### 7. SQLite + Prisma

**Vấn đề:** Cần DB zero-config, dễ deploy local + Docker + Fly.io.

**Giải pháp:** SQLite + Prisma. File `db/custom.db`. Trade-off: không có enums (dùng String), không có native arrays (dùng JSON String), không có concurrency cao (OK vì single-instance).

### 8. 2 mini-services riêng (chat + notification)

**Vấn đề:** Socket.io trong Next.js API Routes không scale tốt (stateless). Realtime cần stateful WebSocket server.

**Giải pháp:** 2 mini-services Node.js + Socket.io. Next.js gọi HTTP `/broadcast*` khi cần push event. Mini-service có thể restart độc lập.

### 9. Long-term memory (ProjectContext)

**Vấn đề:** Retry/Refine cần re-read toàn bộ context (members, analyses, chat). Tốn tokens + time.

**Giải pháp:** Sau pipeline đầu, cache compressed summary vào `ProjectContext.summary`. Refine đọc cache thay vì re-read. Save ~50% tokens.

### 10. Task dedup + comprehensiveness check

**Vấn đề:** AI có thể sinh task trùng lặp, hoặc thiếu layer quan trọng (chỉ có UI, không có DATABASE).

**Giải pháp:**
- **Dedup**: compare title + description similarity với task đã có
- **Comprehensiveness**: đảm bảo mỗi member có task across các layers (DATABASE/BACKEND/UI/CONFIG/TESTING)

---

## 📚 Related Docs

- [README.md](../README.md) — Overview + cài đặt
- [API.md](API.md) — REST API reference (50+ endpoints)
- [CONTRIBUTING.md](CONTRIBUTING.md) — Dev setup + cách extend
- [prisma/schema.prisma](../prisma/schema.prisma) — DB schema

---

<p align="center">
  <strong>NEXUS AI Architecture</strong> — 10 agents, 6 phases, 3-tier Mermaid fix, dark theme only
</p>
