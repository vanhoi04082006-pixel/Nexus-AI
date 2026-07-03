# 📐 NEXUS AI — Architecture

> System design, data flow, components, và design decisions.

## 📑 Mục lục

- [Overview](#-overview)
- [High-Level Architecture](#-high-level-architecture)
- [Component Diagram](#-component-diagram)
- [Multi-Agent Pipeline](#-multi-agent-pipeline)
- [Data Flow](#-data-flow)
- [Live Log Console (AsyncLocalStorage)](#-live-log-console-asynclocalstorage)
- [Multi-Key Rotation](#-multi-key-rotation)
- [Database Schema](#-database-schema)
- [Real-time (Socket.io + Polling)](#-real-time-socketio--polling)
- [GitHub Integration](#-github-integration)
- [Email System](#-email-system)
- [State Management](#-state-management)
- [Design Decisions](#-design-decisions)

---

## 🎯 Overview

NEXUS AI là một **single-page Next.js application** chạy hoàn toàn local (hoặc Docker). Backend là Next.js API Routes (Node.js runtime), database là SQLite qua Prisma ORM, real-time qua Socket.io mini-service.

**Design principles:**
1. **Background + Polling** thay vì SSE (fix 504 gateway timeout)
2. **Multi-provider fallback** — không bao giờ crash, luôn có kết quả
3. **Multi-key rotation** — tối ưu free tier
4. **AsyncLocalStorage** cho log context (không传 tham số qua 10 layers)
5. **Long-term memory** — AI nhớ dự án qua `ProjectContext`
6. **Parallel execution** — Phase 2 agents chạy song song

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  React 19 + Next.js 16 (App Router)                        │ │
│  │  ├─ HomeView (project history)                             │ │
│  │  ├─ InputView (form nhập dự án)                            │ │
│  │  ├─ WorkspaceView (11 tabs)                                │ │
│  │  ├─ ProcessingOverlay (Live Log Console)                   │ │
│  │  └─ Zustand store (persisted)                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↕ HTTP polling 2.5s                  │
│                              ↕ Socket.io (chat)                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES (port 3000)                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  /api/projects          CRUD + pipeline + refine + tasks   │ │
│  │  /api/github            OAuth + push + PR                  │ │
│  │  /api/config            Public URL                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Background Pipeline (process.nextTick)                    │ │
│  │  ├─ 10 AI Agents (ai.ts)                                   │ │
│  │  ├─ OpenRouter multi-key (openrouter.ts)                   │ │
│  │  └─ AsyncLocalStorage log context                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Pipeline Progress Tracker (in-memory, globalThis)         │ │
│  │  ├─ progressMap (pipeline)                                 │ │
│  │  ├─ initMap (task generation)                              │ │
│  │  └─ refineMap (AI refine)                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
              │                          │
              ▼                          ▼
┌──────────────────────────┐  ┌────────────────────────────────┐
│  SQLite (Prisma)         │  │  External APIs                 │
│  ├─ Project              │  │  ├─ OpenRouter (multi-key)     │
│  ├─ Member               │  │  ├─ GitHub REST API            │
│  ├─ Analysis (versioned) │  │  └─ Gmail SMTP (Nodemailer)    │
│  ├─ Task                 │  └────────────────────────────────┘
│  ├─ ChatMessage          │
│  ├─ EditProposal         │              │
│  ├─ EmailLog             │              ▼
│  ├─ ProjectContext       │  ┌────────────────────────────────┐
│  └─ TokenLog             │  │  Socket.io Chat Service        │
└──────────────────────────┘  │  (mini-service, port 3001)     │
                              │  └─ Room per project           │
                              └────────────────────────────────┘
```

---

## 🧩 Component Diagram

### Frontend Components

```
src/components/nexus/
├── HomeView.tsx              # Project history (cards grid)
├── InputView.tsx             # Form nhập dự án (topic, members, leader)
├── WorkspaceView.tsx         # Main workspace (sidebar + tab content)
│   ├─ Sidebar (logo, nav, leader info, init button, public URL)
│   └─ Tab content (renderTab switch)
├── tabs/                     # 11 workspace tabs
│   ├── AnalysisTab.tsx       # Tech stack, features, actors, modules
│   ├── HRTab.tsx             # Member assignments + risks
│   ├── SprintTab.tsx         # Sprint timeline + milestones
│   ├── DesignTab.tsx         # Architecture + DB schema + API + folder tree
│   ├── UMLTab.tsx            # 4 diagrams (React Flow + Mermaid)
│   ├── DocsTab.tsx           # README + Convention + API Standard (MDX editor)
│   ├── GitTab.tsx            # OAuth + Push + PR
│   ├── ChatTab.tsx           # Real-time chat + AI Refine
│   ├── MembersTab.tsx        # Member list + invite links
│   ├── TasksTab.tsx          # Kanban board (dnd-kit)
│   └── MailboxTab.tsx        # Email log
├── ProcessingOverlay.tsx     # Pipeline overlay (8 agent board + log console)
├── TaskProcessingOverlay.tsx # Init/Refine overlay (thinking panel + log)
├── MermaidRenderer.tsx       # Mermaid.js với extensive fixers
├── SectionEditor.tsx         # Edit section dialog (MDX editor)
└── useReload.ts              # Hook reload project data
```

### Backend Lib

```
src/lib/
├── ai.ts                     # 8-agent pipeline + refine + task gen + chat
├── openrouter.ts             # Multi-key rotation + cache + retry strategy
├── github.ts                 # Push 15+ files + PR creation
├── email.ts                  # SMTP (Nodemailer) + .public-url
├── pipeline-progress.ts      # AsyncLocalStorage log + progress maps (globalThis)
├── access.ts                 # resolveAccess + requireLeader
├── db.ts                     # Prisma client
├── types.ts                  # TypeScript types (ProjectResult, TaskItem, etc.)
└── utils.ts                  # cn() + helpers
```

### API Routes

```
src/app/api/
├── projects/
│   ├── route.ts                    # GET list / POST create + run pipeline
│   └── [id]/
│       ├── route.ts                # GET / DELETE
│       ├── progress/route.ts       # GET pipeline progress + logs
│       ├── initialize/route.ts     # POST sinh todolist
│       ├── initialize/progress/    # GET init progress + logs
│       ├── refine/route.ts         # POST AI Refine
│       ├── refine/progress/        # GET refine progress + logs
│       ├── tasks/route.ts          # GET / POST tasks
│       ├── tasks/[taskId]/route.ts # PATCH task status (drag-drop)
│       ├── chat/route.ts           # GET / POST messages
│       ├── chat/ai/route.ts        # POST AI Assistant reply
│       ├── edit-proposals/         # GET / POST / PATCH proposals
│       ├── section/route.ts        # GET / POST section content
│       ├── members/route.ts        # GET members
│       ├── mailbox/route.ts        # GET emails
│       ├── context/route.ts        # GET long-term memory
│       └── tokens/route.ts         # GET token usage logs
├── github/
│   ├── auth/route.ts               # GET OAuth redirect
│   ├── callback/route.ts           # GET OAuth callback
│   ├── status/route.ts             # GET OAuth status
│   └── push/route.ts               # POST push to GitHub + create PR
└── config/route.ts                 # GET public URL
```

---

## 🤖 Multi-Agent Pipeline

### Phase 1: Sequential (analysis → hr → sprint)

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT-01: Requirement Analyst                              │
│  ├─ Input: topic, description, purpose, members             │
│  ├─ Output: { desc, techStack, features, actors, modules }  │
│  └─ Models: nemotron-ultra → qwen3-next → gpt-oss-120b ...  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  AGENT-02: HR Planner                                       │
│  ├─ Input: Agent-01 output + members (strengths/weaknesses) │
│  ├─ Output: { assignments, coverage, risks }                │
│  └─ Models: gemma-4-31b → gemma-4-26b → nemotron-ultra ...  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  AGENT-03: Sprint Planner                                   │
│  ├─ Input: Agent-01 + Agent-02 output                       │
│  ├─ Output: { totalSprints, sprints, milestones }           │
│  └─ Models: nemotron-ultra → nemotron-super → qwen3-next .. │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Parallel (design + uml + docs + git)

```
Phase 1 output
      │
      ├──────────────┬──────────────┬──────────────┐
      ▼              ▼              ▼              ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ AGENT-04  │ │ AGENT-05  │ │ AGENT-06  │ │ AGENT-07  │
│ Architect │ │ UML Gen   │ │ Writer    │ │ Git/DevOps│
│           │ │           │ │           │ │           │
│ design    │ │ uml       │ │ docs      │ │ git       │
│ {dbTables,│ │ {useCase, │ │ {readme,  │ │ {gitCmds, │
│  apiEndp, │ │  class,   │ │  conven,  │ │  branch,  │
│  folder}  │ │  erd,     │ │  apiStd}  │ │  issue}   │
│           │ │  seq}     │ │           │ │           │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
      │             │             │             │
      └─────────────┴─────────────┴─────────────┘
                      ↓
              Promise.all(phase2Promises)
```

### Phase 3: Retry failed agents

```
for each failed agent:
  wait 5s
  retry with same models
  if still fail → mark as failed
```

### Phase 4: Fallback (static data)

```
for each agent without result:
  use fallback(agent.key, input, results)
  → returns static placeholder JSON
```

### Phase 5: Quality Reviewer (AGENT-10)

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT-10: Quality Reviewer                                 │
│  ├─ Input: ALL 9 sections (JSON, truncated to 12000 chars)  │
│  ├─ Task: Fix inconsistencies, sync sections                │
│  ├─ Output: merged + fixed ProjectResult                    │
│  └─ Models: gpt-oss-120b → qwen3-next → nemotron-ultra ...  │
└─────────────────────────────────────────────────────────────┘
```

### Task Generation (separate, on demand)

```
┌─────────────────────────────────────────────────────────────┐
│  TASK GENERATOR                                             │
│  ├─ Input: ProjectResult (analysis + hr + sprint + design)  │
│  ├─ Output: TaskItem[] (SMART tasks with code snippets)     │
│  ├─ Models: qwen3-coder → gpt-oss-120b → laguna-m.1 ...     │
│  └─ Trigger: POST /api/projects/:id/initialize              │
└─────────────────────────────────────────────────────────────┘
```

### AI Refine (separate, on demand)

```
┌─────────────────────────────────────────────────────────────┐
│  AI REFINE                                                  │
│  ├─ Input: current results + editRequests + chatDiscussion  │
│  ├─ Task: Re-generate ALL 7 sections with new context       │
│  ├─ Output: refined ProjectResult                           │
│  └─ Trigger: POST /api/projects/:id/refine                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### Pipeline Flow (tạo dự án mới)

```
1. User submit form (InputView)
   ↓
2. POST /api/projects
   ├─ Create Project + Members in DB
   ├─ initProgress(projectId)
   └─ process.nextTick(() => runPipeline(input, onProgress))
   ↓
3. POST returns immediately { projectId, leaderToken }
   ↓
4. Client polls GET /api/projects/:id/progress every 2.5s
   ├─ Returns { status, agents[], logs[] }
   └─ Client updates ProcessingOverlay
   ↓
5. Background pipeline runs:
   ├─ Phase 1: Agent-01 → Agent-02 → Agent-03 (sequential)
   ├─ Phase 2: Agent-04,05,06,07 (parallel via Promise.all)
   ├─ Phase 3: Retry failed agents
   ├─ Phase 4: Static fallback for missing sections
   └─ Phase 5: Agent-10 Quality Reviewer
   ↓
6. Pipeline done:
   ├─ Save sections to DB (Analysis with version)
   ├─ Save ProjectContext (long-term memory)
   ├─ Update project status → WORKSPACE
   ├─ Send invitation emails
   └─ finishProgress(projectId, { projectId, leaderToken })
   ↓
7. Client detects status === "done"
   ├─ Redirect to workspace: /?p=PROJECT_ID&token=LEADER_TOKEN
   └─ WorkspaceView loads project data
```

### Init Flow (sinh todolist)

```
1. Leader clicks "Khởi tạo Dự Án" (sidebar)
   ↓
2. POST /api/projects/:id/initialize
   ├─ Delete old tasks
   ├─ initInitialize(projectId)
   └─ process.nextTick(() => runWithInitLog(projectId, () => generateTasks(...)))
   ↓
3. Client polls GET /api/projects/:id/initialize/progress every 2.5s
   ├─ Returns { status, logs[], taskCount? }
   └─ Client updates TaskProcessingOverlay (mode="init")
   ↓
4. generateTasks:
   ├─ Read analysis + hr + sprint + design from DB
   ├─ Log: "👤 Member A → vai trò: Frontend Developer · module: UI, ..."
   ├─ Call AI (TASK_GEN_MODELS)
   ├─ Log: "✓ Sinh task cho Member A: Thiết kế layout chính"
   └─ Return TaskItem[]
   ↓
5. Persist tasks to DB + send TASK_ASSIGNED emails
   ↓
6. finishInitialize(projectId, taskCount)
   ↓
7. Client reloads project → switches to TasksTab
```

### Refine Flow

```
1. Leader clicks "AI Refine" (ChatTab)
   ↓
2. POST /api/projects/:id/refine
   ├─ Body: { editRequests: [], chatDiscussion: "..." }
   ├─ initRefine(projectId)
   └─ runWithRefineLog(projectId, () => refineSections(...))
   ↓
3. Client polls GET /api/projects/:id/refine/progress every 2.5s
   ├─ Returns { status, logs[], sections{} }
   └─ Client updates TaskProcessingOverlay (mode="refine")
   ↓
4. refineSections:
   ├─ For each of 7 sections:
   │   ├─ Log: "🔧 [REFINE] Phân tích → đang đọc..."
   │   ├─ Call AI with current content + edit requests
   │   └─ Log: "✓ [REFINE] Phân tích → đã chỉnh sửa xong"
   └─ Return refined ProjectResult
   ↓
5. Persist refined sections (version bumped)
   ↓
6. finishRefine(projectId)
   ↓
7. Client reloads project
```

---

## 📊 Live Log Console (AsyncLocalStorage)

### Vấn đề

`generateTasks` và `refineSections` gọi `callAndParse` → `callModel` → `callOpenRouter` → `callOpenRouterDirect`. Mỗi layer có retry logic, key rotation, etc. Truyền tham số `projectId` qua 5+ layers rất lộn xộn.

### Giải pháp: AsyncLocalStorage

```typescript
// pipeline-progress.ts
const pipelineAls = new AsyncLocalStorage<string>();
const initAls = new AsyncLocalStorage<string>();
const refineAls = new AsyncLocalStorage<string>();

export function runWithProjectLog<T>(projectId: string, fn: () => T): T {
  return pipelineAls.run(projectId, fn);
}

export function appendLog(entry: Omit<LogEntry, "id" | "ts">): void {
  // Try innermost context first (refine > init > pipeline)
  const refinePid = refineAls.getStore();
  if (refinePid) {
    pushLog(refineMap, refinePid, entry);
    return;
  }
  const initPid = initAls.getStore();
  if (initPid) {
    pushLog(initMap, initPid, entry);
    return;
  }
  const pipePid = pipelineAls.getStore();
  if (pipePid) {
    pushLog(progressMap, pipePid, entry);
    return;
  }
  // No active context — silently drop
}
```

### Usage

```typescript
// route.ts
process.nextTick(() => {
  runWithProjectLog(project.id, () => {
    runPipeline(input, onProgress)  // ← all deep callees can appendLog()
      .then(...)
      .catch(...);
  });
});

// ai.ts (deep inside callAndParse)
appendLog({
  level: "info",
  model,
  message: `→ [1/2] trying ${model}`,
});

// openrouter.ts (even deeper)
appendLog({
  level: "warn",
  provider: "openrouter",
  keyIndex: keyIndex + 1,
  message: `[KEY ROTATION] Key #${keyIndex + 1} rate-limited for ${ra}s`,
});
```

AsyncLocalStorage **tự động propagate qua `await`**, `Promise.all`, `process.nextTick` — không cần传 tham số.

### globalThis fix

**Vấn đề:** Next.js dev recompile tạo module instance mới → `Map` reset → mất in-flight progress.

**Giải pháp:** Lưu maps trên `globalThis`:

```typescript
type GlobalStore = {
  progressMap?: Map<string, PipelineProgress>;
  refineMap?: Map<string, RefineProgress>;
  initMap?: Map<string, InitProgress>;
  rateLimitedKeys?: Map<number, number>;
  aiCache?: Map<string, { result: string; timestamp: number }>;
};
const g = globalThis as typeof globalThis & GlobalStore;

const progressMap: Map<string, PipelineProgress> = g.progressMap ?? new Map();
g.progressMap = progressMap;
// ... same for refineMap, initMap
```

---

## 🔑 Multi-Key Rotation

### OpenRouter

```typescript
function getAvailableKeyIndex(): number {
  const keys = getAllApiKeys();  // OPENROUTER_API_KEY, _2, _3, ...
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const resetAt = rateLimitedKeys.get(i);
    if (!resetAt || resetAt < now) {
      rateLimitedKeys.delete(i);
      return i;
    }
  }
  // All rate-limited → return soonest-resetting key
  return soonestResetting;
}

function markKeyRateLimited(keyIndex: number, retryAfter: number) {
  rateLimitedKeys.set(keyIndex, Date.now() + retryAfter * 1000);
  appendLog({
    level: "warn",
    provider: "openrouter",
    keyIndex: keyIndex + 1,
    message: `[KEY ROTATION] Key #${keyIndex + 1} rate-limited for ${retryAfter}s`,
  });
}
```

### Retry strategy

| HTTP status | Action |
|---|---|
| 200 | Return content + cache (if temp < 0.5) |
| 429 | Mark key rate-limited → try next key |
| 401/403 | Mark key invalid → try next key |
| 404 | Model unavailable → skip to next model |
| 5xx | Wait + retry same model (backoff) |
| Timeout | Wait + retry same model |

### Model fallback

```typescript
const AGENTS: AgentDef[] = [
  {
    id: "01",
    name: "Requirement Analyst",
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",  // try 1st
      "qwen/qwen3-next-80b-a3b-instruct:free",   // try 2nd
      "nvidia/nemotron-3-super-120b-a12b:free",
      "openai/gpt-oss-120b:free",
      // ... 5 more fallback models
    ],
    // ...
  },
  // ...
];

// callAndParse iterates models, MAX_RETRIES=2 per model
for (const model of models) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const raw = await callModel(model, sys, usr, temp);
      // parse JSON, AI self-fix if needed
      return { data, model };
    } catch (e) {
      // 429 → wait + retry same model
      // 5xx → backoff + retry same model
      // 4xx → skip to next model
    }
  }
}
```

---

## 🗄️ Database Schema

Xem [prisma/schema.prisma](../prisma/schema.prisma) cho full schema.

### Entity Relationship

```
Project (1) ──── (N) Member
Project (1) ──── (N) Analysis (versioned)
Project (1) ──── (N) Task
Project (1) ──── (N) ChatMessage
Project (1) ──── (N) EditProposal
Project (1) ──── (N) EmailLog
Project (1) ──── (1) ProjectContext  (long-term memory)
Project (1) ──── (N) TokenLog        (cost tracking)

Member (1) ──── (N) Task
Member (1) ──── (N) ChatMessage
Member (1) ──── (N) EditProposal
```

### Key fields

| Model | Key fields | Notes |
|---|---|---|
| `Project` | `leaderToken`, `githubToken` | Token-based auth (no session) |
| `Member` | `inviteToken` | Member access via link `/?p=ID&token=TOKEN` |
| `Analysis` | `type`, `version` | 7 types: ANALYSIS/HR/SPRINT/DESIGN/UML/DOCS/GIT |
| `Task` | `layer`, `targetFile`, `implementationSteps`, `technicalHints` | SMART model |
| `ProjectContext` | `summary`, `fullResults`, `runCount` | Long-term memory |
| `TokenLog` | `agentId`, `model`, `apiKeyId`, `totalTokens` | Cost tracking |

---

## 💬 Real-time (Socket.io + Polling)

### Architecture

```
Browser (socket.io-client)
  ↓ io('/?XTransformPort=3001')
Caddy Gateway
  ↓ forward to localhost:3001 (path=/)
Socket.io Chat Service (port 3001)
  ↓ verify token via HTTP
Next.js API (port 3000)
  ↓ GET /api/projects/:id?token=...
DB
```

### Fallback: HTTP Polling

Nếu chat service không chạy, frontend tự fallback:

```typescript
// ChatTab.tsx
useEffect(() => {
  const interval = setInterval(async () => {
    const resp = await fetch(`/api/projects/${projectId}/chat`);
    if (resp.ok) {
      const data = await resp.json();
      setMessages(data.messages);
    }
  }, 3000); // 3s polling
  return () => clearInterval(interval);
}, [projectId]);
```

### Room model

Mỗi project = 1 room `project:<projectId>`. Tất cả events scoped trong room.

### Events

| Client → Server | Payload | Mô tả |
|---|---|---|
| `join` | `{ projectId, name, role, token }` | Join room (verify token) |
| `send_message` | `{ projectId, name, role, message }` | Broadcast message |
| `typing` | `{ projectId, name }` | Typing indicator |

| Server → Client | Payload | Mô tả |
|---|---|---|
| `user_joined` | `{ projectId, name, role, socketId, timestamp }` | User joined |
| `message` | `{ name, role, message, timestamp }` | New message (excludes sender) |
| `typing` | `{ projectId, name, timestamp }` | Someone typing |
| `user_left` | `{ projectId, name, role, socketId, timestamp }` | User left |
| `error` | `{ message }` | Error |

👉 Chi tiết: [mini-services/chat-service/README.md](../mini-services/chat-service/README.md)

---

## 🔌 GitHub Integration

### OAuth Flow

```
1. User clicks "Connect GitHub"
   ↓
2. GET /api/github/auth
   → Redirect to https://github.com/login/oauth/authorize?client_id=...&scope=repo
   ↓
3. GitHub redirects back to /api/github/callback?code=xxx
   ↓
4. GET /api/github/callback
   ├─ Exchange code for access_token
   ├─ Get user info (username)
   ├─ Save to Project: githubToken, githubUsername
   └─ Redirect to /?p=PROJECT_ID&token=LEADER_TOKEN
   ↓
5. GET /api/github/status?projectId=xxx
   → { connected: true, username: "vanhoi04082006" }
```

### Push Flow

```
1. User clicks "Push to GitHub"
   ↓
2. POST /api/github/push
   Body: { projectId, token }
   ↓
3. github.ts:
   ├─ Create repo (private) via POST /user/repos
   ├─ Generate 15+ files:
   │   ├─ README.md
   │   ├─ .gitignore
   │   ├─ PROJECT_SUMMARY.md
   │   ├─ FOLDER_STRUCTURE.txt
   │   ├─ docs/CODING_CONVENTION.md
   │   ├─ docs/API_STANDARD.md
   │   ├─ docs/ARCHITECTURE.md
   │   ├─ docs/DATABASE.md
   │   ├─ docs/API_ENDPOINTS.md
   │   ├─ docs/SPRINT_PLAN.md
   │   ├─ docs/TEAM.md
   │   ├─ docs/TASKS.md
   │   ├─ docs/UML/use-case.mmd
   │   ├─ docs/UML/class-diagram.mmd
   │   ├─ docs/UML/erd.mmd
   │   ├─ docs/UML/sequence.mmd
   │   └─ .github/ISSUE_TEMPLATE/task.md
   ├─ Create blob for each file
   ├─ Create tree with all blobs
   ├─ Create commit on top of default branch
   ├─ Update ref (master/main)
   ├─ Create branch nexus-ai/init
   └─ Create Pull Request
   ↓
4. Return { repoUrl, prUrl }
```

---

## 📧 Email System

### SMTP via Nodemailer

```typescript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: leaderEmail,
    pass: leaderSmtpPassword,  // App Password, NOT regular password
  },
});

// Verify before sending
await transporter.verify();
```

### Email types

| Type | Trigger | Content |
|---|---|---|
| `INVITATION` | Tạo project | Lời mời + vai trò + module + invite link |
| `TASK_ASSIGNED` | Sinh todolist | Danh sách task + deadline |
| `REMINDER` | (Manual) | Deadline reminder |

### Public URL

Email link dùng URL từ `.public-url` file (Cloudflare Tunnel URL):

```typescript
const publicUrl = fs.readFileSync('.public-url', 'utf-8').trim();
const inviteLink = `${publicUrl}/?p=${projectId}&token=${memberToken}`;
```

Nếu không có `.public-url` → fallback `http://localhost:3000`.

---

## 🎯 State Management

### Zustand (client state, persisted)

```typescript
interface NexusState {
  // routing
  view: "input" | "workspace" | "home";
  projectId: string | null;
  token: string | null;

  // input form (persisted)
  input: { topic, description, members, ... };

  // pipeline state
  pipelineRunning: boolean;
  agents: AgentProgress[];
  logs: LogEntry[];

  // init state
  initRunning: boolean;
  initLogs: LogEntry[];

  // refine state
  refineRunning: boolean;
  refineLogs: LogEntry[];

  // workspace data
  project, result, members, messages, tasks, emails, proposals;
}
```

**Persisted** (qua `localStorage`):
- `input` (form data across reloads)
- `projectId`, `token`, `activeTab`

**Not persisted** (transient):
- `pipelineRunning`, `agents`, `logs`, etc.

### TanStack Query (server state)

Sử dụng cho:
- Fetch tasks (Kanban real-time polling 5s)
- Fetch chat messages (fallback polling 3s)

---

## 🎨 Design Decisions

### 1. Background + Polling thay vì SSE

**Vấn đề:** SSE (Server-Sent Events) qua Caddy gateway → 504 timeout sau 100s.

**Giải pháp:**
- POST `/api/projects` trả về ngay `{ projectId, leaderToken }`
- Pipeline chạy trong `process.nextTick` (background)
- Client polls `GET /api/projects/:id/progress` mỗi 2.5s
- Backend lưu progress trong `progressMap` (in-memory, globalThis)

**Trade-off:** Thêm 1.25s latency trung bình (half of 2.5s poll interval), nhưng đáng để đổi lấy reliability.

### 2. Multi-provider fallback

**Vấn đề:** Free tier OpenRouter rate-limit nặng. Cần nhiều model + key để đảm bảo pipeline luôn có kết quả.

**Giải pháp:**
- Multi-key rotation (unlimited keys) — tự luân chuyển khi 429
- Multi-model fallback per agent — thử model 1 → 2 → 3 → ...
- Static fallback data (always return something)
- In-memory cache (1h TTL) — skip repeated calls

### 3. AsyncLocalStorage cho log context

**Vấn đề:** `generateTasks` → `callAndParse` → `callModel` → `callOpenRouter` → `callOpenRouterDirect`. Truyền `projectId` qua 5+ layers lộn xộn.

**Giải pháp:** AsyncLocalStorage tự động propagate qua `await`/`Promise.all`. `appendLog()` không cần tham số — tự biết context nào đang chạy.

### 4. globalThis cho in-memory maps

**Vấn đề:** Next.js dev recompile tạo module instance mới → `Map` reset → mất in-flight progress.

**Giải pháp:** Lưu `progressMap`, `initMap`, `refineMap`, `rateLimitedKeys`, `aiCache` trên `globalThis`.

### 5. Long-term memory (ProjectContext)

**Vấn đề:** Retry/refine cần đọc lại tất cả sections → tốn token + thời gian.

**Giải pháp:** Lưu `summary` (compressed) + `fullResults` (capped 50KB) trong `ProjectContext`. AI đọc summary thay vì full JSON.

### 6. Parallel Phase 2

**Vấn đề:** 7 agents tuần tự = chậm.

**Giải pháp:** Phase 1 (analysis → hr → sprint) tuần tự (có dependency). Phase 2 (design + uml + docs + git) chỉ depend trên Phase 1 → chạy song song qua `Promise.all`.

### 7. Token-based auth (no session)

**Vấn đề:** Next.js App Router + serverless → session phức tạp.

**Giải pháp:**
- `leaderToken` (cuid) — trong URL `/?p=PROJECT_ID&token=LEADER_TOKEN`
- `member.inviteToken` (cuid) — trong URL email
- Mỗi API request verify token vs DB
- Chat service verify token via HTTP call to Next.js API

### 8. SQLite (not Postgres)

**Lý do:**
- Zero-config — không cần setup database server
- File-based (`db/custom.db`) — dễ backup (copy file)
- Đủ performance cho dev / small team
- Docker volume persist dễ

---

<p align="center">
  <strong>NEXUS AI Architecture</strong> — Multi-Agent + Live Log + Multi-Key
</p>
