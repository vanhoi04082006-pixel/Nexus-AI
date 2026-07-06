# 🤝 Contributing to NEXUS AI

Cảm ơn bạn quan tâm đóng góp cho NEXUS AI! Tài liệu này hướng dẫn cách setup dev environment, code style, và cách extend project.

## 📑 Mục lục

- [Dev Setup](#-dev-setup)
- [Project Structure](#-project-structure)
- [Code Style](#-code-style)
- [Database Changes](#-database-changes)
- [Cách thêm AI Agent mới](#-cách-thêm-ai-agent-mới)
- [Cách thêm Model mới](#-cách-thêm-model-mới)
- [Cách thêm Workspace Tab mới](#-cách-thêm-workspace-tab-mới)
- [Cách thêm API Route mới](#-cách-thêm-api-route-mới)
- [Cách thêm Notification Type mới](#-cách-thêm-notification-type-mới)
- [Cách thêm Activity Event Type mới](#-cách-thêm-activity-event-type-mới)
- [Live Log Console — Cách log từ code mới](#-live-log-console--cách-log-từ-code-mới)
- [Testing](#-testing)
- [Pull Request Process](#-pull-request-process)

---

## 🚀 Dev Setup

### Yêu cầu

- [Bun](https://bun.sh) v1+ (runtime + package manager)
- [Node.js](https://nodejs.org) v20+ (cho Prisma CLI)
- [OpenRouter API key](https://openrouter.ai/keys) (free)

### Cài đặt

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
cp .env.example .env
# Điền OPENROUTER_API_KEY vào .env
bun install
bun run db:push
```

### Chạy dev server

```bash
bun run dev
# → http://localhost:3000 (Turbopack)
```

Dev server auto-reload khi save file. Log ghi ra `dev.log`:

```bash
tail -f dev.log
```

### Chạy mini-services (optional, cho realtime)

```bash
# Terminal 1 — Chat service (port 3001, Socket.io realtime chat)
cd mini-services/chat-service
bun install
bun run dev

# Terminal 2 — Notification service (port 3002, Socket.io notifications)
cd mini-services/notification-service
bun install
bun run dev
```

Nếu không chạy mini-services, frontend tự fallback sang HTTP polling. Notification Center + Mail vẫn hoạt động qua REST API (chỉ không realtime).

### Lint

```bash
bun run lint
# → ESLint + Next.js rules
```

> **Quan trọng:** PR phải pass lint trước khi merge.

### Database commands

```bash
bun run db:push      # Push schema → SQLite (dev)
bun run db:generate  # Regenerate Prisma Client
bun run db:migrate   # Create migration (production)
bun run db:reset     # Reset DB (xóa hết data!)
```

---

## 📁 Project Structure

```
Nexus-AI/
├── prisma/
│   └── schema.prisma              # DB schema (21 models) — edit here then `bun run db:push`
├── src/
│   ├── app/
│   │   ├── api/                   # REST API routes (50+ endpoints)
│   │   │   ├── projects/          # Project CRUD + pipeline + tasks + mailbox + ...
│   │   │   ├── dashboard/         # activity, status, tasks, statistics
│   │   │   ├── activity/logs/     # Activity log query
│   │   │   ├── agents/            # 10 AI agents info
│   │   │   ├── notifications/     # Global notifications
│   │   │   ├── templates/         # Project templates
│   │   │   ├── github/            # OAuth + push + status
│   │   │   └── config/            # Public URL config
│   │   ├── layout.tsx             # Root layout (Mermaid CDN, dark theme)
│   │   └── page.tsx               # Main page (router: home/projects/input/workspace)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui (50+ components — KHÔNG sửa)
│   │   └── nexus/
│   │       ├── tabs/              # 13 workspace tabs
│   │       ├── HomeView.tsx       # Dashboard widgets
│   │       ├── AllProjectsView.tsx# Premium SaaS dashboard
│   │       ├── InputView.tsx      # Create project form
│   │       ├── WorkspaceView.tsx  # Project workspace
│   │       ├── AgentHubView.tsx   # 10 AI agents dashboard
│   │       ├── NotificationBell.tsx
│   │       ├── MermaidRenderer.tsx# 3-tier fix (regex → aggressive → AI)
│   │       ├── ProcessingOverlay.tsx       # Pipeline Live Log
│   │       ├── TaskProcessingOverlay.tsx   # Init/Refine Live Log
│   │       ├── NeuralBackground.tsx
│   │       └── AI3DBrain.tsx
│   ├── lib/
│   │   ├── ai.ts                  # 10-agent pipeline + retry + fallback
│   │   ├── openrouter.ts          # Multi-key rotation client
│   │   ├── github.ts              # Push + PR
│   │   ├── email.ts               # SMTP (nodemailer)
│   │   ├── notifications.ts       # Notification service broadcaster
│   │   ├── activity.ts            # Activity log + system/pipeline status
│   │   ├── pipeline-progress.ts   # AsyncLocalStorage log + progress maps
│   │   ├── access.ts              # Token auth (leader/member)
│   │   ├── schemas.ts             # Zod validators
│   │   ├── db.ts                  # Prisma client
│   │   └── types.ts
│   └── store/
│       └── useNexus.ts            # Zustand store (persisted)
├── mini-services/
│   ├── chat-service/              # Socket.io chat (port 3001)
│   └── notification-service/      # Socket.io notifications (port 3002)
├── scripts/                       # run-local (Win/Mac/Linux), deploy-fly, push-to-github
├── docs/                          # Documentation
├── db/
│   └── custom.db                  # SQLite (auto-created)
└── package.json
```

### File naming conventions

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `ProcessingOverlay.tsx` |
| Lib | camelCase | `pipeline-progress.ts` |
| API routes | `route.ts` trong folder | `api/projects/route.ts` |
| Types | PascalCase | `ProjectResult`, `TaskItem` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `CACHE_TTL` |

---

## 💻 Code Style

### TypeScript

- **Strict mode** — `tsconfig.json` có `"strict": true`
- **ES6+ imports/exports** — không dùng `require`
- **`'use client'` / `'use server'`** — mark rõ ràng
- **Type inference** — tránh `any`, dùng `unknown` + type guard

```typescript
// ✅ Good
import { db } from "@/lib/db";
import type { TaskItem } from "@/lib/types";

export async function getTasks(projectId: string): Promise<TaskItem[]> {
  const tasks = await db.task.findMany({ where: { projectId } });
  return tasks as unknown as TaskItem[];
}

// ❌ Bad
import { db } from "@/lib/db";

export async function getTasks(projectId: any): Promise<any> {
  return db.task.findMany({ where: { projectId } });
}
```

### React / Next.js

- **App Router** — không dùng Pages Router
- **`'use client'`** chỉ khi cần state/effects
- **shadcn/ui** — KHÔNG sửa files trong `src/components/ui/`, chỉ compose
- **Tailwind CSS** — dùng `cn()` helper từ `@/lib/utils`
- **Server Components** default — mark `'use client'` chỉ khi cần

```tsx
// ✅ Good
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MyComponent({ className }: { className?: string }) {
  const [count, setCount] = useState(0);
  return (
    <Button
      onClick={() => setCount(c => c + 1)}
      className={cn("bg-primary", className)}
    >
      {count}
    </Button>
  );
}
```

### API Routes

- **`export const runtime = "nodejs"`** — KHÔNG dùng edge (cần Prisma)
- **`export const dynamic = "force-dynamic"`** — không cache
- **Token auth** qua `resolveAccess(id, token)`
- **Leader-only** qua `requireLeader(access)`
- **Error format:** `{ error: "msg", details: "..." }`

```typescript
import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  // Leader-only action:
  if (!requireLeader(access)) {
    return Response.json({ error: "Leader access required" }, { status: 403 });
  }

  // ... business logic

  // Log activity (creates ActivityLog + broadcasts via notification-service)
  await logActivity({
    projectId: id,
    type: "SECTION_EDIT",
    title: "Edited analysis section",
    actorName: access.name,
    actorEmail: access.email,
    actorRole: access.role === "leader" ? "Leader" : "Member",
  });

  return Response.json({ data: "..." });
}
```

### Color & Styling

- **Dark theme only** — `globals.css` chỉ có 1 theme (teal accent)
- **No indigo/blue** — dùng `bg-primary`, `text-primary`, `bg-background`, etc.
- **Responsive** — mobile-first, dùng `sm:`, `md:`, `lg:`, `xl:`
- **Sticky footer** — `min-h-screen flex flex-col`, footer `mt-auto`

---

## 🗄️ Database Changes

### Edit schema

1. Edit `prisma/schema.prisma`
2. Run `bun run db:push` (dev) hoặc `bun run db:migrate` (production)
3. Prisma Client tự regenerate

### Example: Add new field

```prisma
model Task {
  // ... existing fields
  estimatedHours Int?    // ← new field
}
```

```bash
bun run db:push
# → Auto-add column to SQLite
```

### Example: Add new model

```prisma
model Comment {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  taskId    String?
  authorEmail String
  body      String
  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([taskId])
}
```

```bash
bun run db:push
```

> **Note:** SQLite không support tất cả Prisma features (vd: enums). Dùng `String` + union type thay thế. JSON arrays lưu dưới dạng `String` với suffix `[]` trong comment.

---

## 🤖 Cách thêm AI Agent mới

Ví dụ: thêm Agent-11 "Performance Engineer".

### 1. Define agent trong `src/lib/ai.ts`

```typescript
const PERFORMANCE_MODELS = [
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "qwen/qwen3-coder:free",
];

// Thêm vào AGENTS array (đặt SAU agent 09, TRƯỚC khi Quality Reviewer chạy)
const AGENTS: AgentDef[] = [
  // ... existing 9 agents
  {
    id: "11",
    name: "Performance Engineer",
    key: "performance",  // ← new SectionType
    required: false,
    temp: 0.15,
    models: PERFORMANCE_MODELS,
  },
];
```

### 2. Add `performance` to SectionType

```typescript
// src/lib/types.ts
export type SectionType =
  | "analysis" | "hr" | "sprint" | "design"
  | "uml" | "docs" | "git" | "test" | "security"
  | "performance";  // ← add
```

### 3. Add prompt builder

```typescript
// src/lib/ai.ts
function performancePrompt(): string {
  return `Bạn là Performance Engineer. Phân tích hiệu năng cho dự án.
${JSON_INSTRUCTION}
Trả object với các key:
- "bottlenecks" (array): { "area", "risk", "fix" }
- "cachingStrategy" (string)
- "dbOptimization" (string)`;
}

const PROMPT_MAP: Record<SectionType, () => string> = {
  // ... existing
  performance: performancePrompt,
};
```

### 4. Add to MIN_KEYS + fallback + Zod schema

```typescript
// src/lib/schemas.ts — add Zod schema for performance
// src/lib/ai.ts
const MIN_KEYS: Record<SectionType, string[]> = {
  // ... existing
  performance: ["bottlenecks", "cachingStrategy"],
};

function fallback(key: SectionType, input: ProjectInput, results: Partial<ProjectResult>): unknown {
  // ... existing
  if (key === "performance") {
    return {
      bottlenecks: [{ area: "DB queries", risk: "N+1", fix: "Use Prisma include" }],
      cachingStrategy: "Redis cho hot paths",
      dbOptimization: "Index trên foreign keys",
    };
  }
}
```

### 5. Add to SECTION_KEYS (for persistence)

```typescript
// src/app/api/projects/_lib/reconstruct.ts
export const SECTION_KEYS: SectionType[] = [
  "analysis", "hr", "sprint", "design", "uml", "docs", "git", "test", "security",
  "performance",  // ← add
];
```

### 6. Add to phase filter (if agent runs in parallel)

```typescript
// src/lib/ai.ts — in runPipeline
const phase3Agents = AGENTS.filter((a) => ["test", "security", "performance"].includes(a.key));
```

### 7. Add tab UI (optional)

```tsx
// src/components/nexus/tabs/PerformanceTab.tsx
"use client";
import { useNexus } from "@/store/useNexus";

export function PerformanceTab() {
  const result = useNexus((s) => s.result);
  if (!result?.performance) return <div>Chưa có dữ liệu performance</div>;
  return (
    <div>
      <h2>Performance Audit</h2>
      {/* render bottlenecks, cachingStrategy, dbOptimization */}
    </div>
  );
}
```

Add to `WorkspaceView.tsx`:
```typescript
case "performance":
  return <PerformanceTab />;
```

### 8. Update DEFAULT_AGENTS in 2 places

```typescript
// src/app/api/agents/route.ts — add to DEFAULT_AGENTS array
// src/app/api/dashboard/status/route.ts — add to DEFAULT_AGENTS array
{ id: "11", name: "Performance Engineer", role: "Performance Engineer", ... },
```

### 9. Update pipeline progress agent board

Update `startPipeline` trong `useNexus.ts` và `initProgress` trong `pipeline-progress.ts` để include agent mới trong danh sách.

---

## 🔑 Cách thêm Model mới

### 1. Add to model list

```typescript
// src/lib/ai.ts
const NEW_MODEL = "meta-llama/llama-3.1-70b-instruct:free";

const AGENTS: AgentDef[] = [
  {
    id: "01",
    name: "Requirement Analyst",
    models: [
      NEW_MODEL,  // ← add to priority list (đầu = ưu tiên cao)
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "openai/gpt-oss-120b:free",
    ],
  },
];
```

### 2. Test

```bash
bun run dev
# Tạo project mới → xem Live Log Console
# → Check model có trong priority list + thử fallback
```

### 3. (Optional) Update DEFAULT_AGENTS

Update `src/app/api/agents/route.ts` nếu model default của agent thay đổi.

---

## 🎨 Cách thêm Workspace Tab mới

### 1. Create tab component

```tsx
// src/components/nexus/tabs/ReportsTab.tsx
"use client";
import { useNexus } from "@/store/useNexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportsTab() {
  const result = useNexus((s) => s.result);
  const tasks = useNexus((s) => s.tasks);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reports</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Total tasks: {tasks.length}</p>
        {/* ... */}
      </CardContent>
    </Card>
  );
}
```

### 2. Add to WorkspaceView

```typescript
// src/components/nexus/WorkspaceView.tsx
import { ReportsTab } from "./tabs/ReportsTab";

const NAV: NavItem[] = [
  // ... existing 13 tabs
  { id: "reports", name: "Reports", icon: BarChart, group: "delivery" },
];

function renderTab() {
  switch (activeTab) {
    // ... existing
    case "reports":
      return <ReportsTab />;
    default:
      return <AnalysisTab />;
  }
}
```

### 3. Add to store type

```typescript
// src/store/useNexus.ts
activeTab: SectionType | "chat" | "members" | "tasks" | "mailbox" | "history" | "agenthub" | "reports";
```

---

## 🔌 Cách thêm API Route mới

### 1. Create route file

```typescript
// src/app/api/projects/[id]/reports/route.ts
import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  const tasks = await db.task.findMany({ where: { projectId: id } });
  const done = tasks.filter(t => t.status === "done").length;

  // Log activity (optional — broadcast to dashboard)
  await logActivity({
    projectId: id,
    type: "AI_AGENT_DONE",
    title: "Generated reports",
    actorName: access.name,
    actorEmail: access.email,
  });

  return Response.json({
    total: tasks.length,
    done,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0,
  });
}
```

### 2. Update API.md

Add documentation entry to [docs/API.md](API.md).

---

## 🔔 Cách thêm Notification Type mới

### 1. Add to type union (comment)

```prisma
// prisma/schema.prisma — update comment on Notification.type
model Notification {
  type String // TASK_COMPLETED | ... | NEW_TYPE  // ← add
}
```

### 2. Use via `createNotification` helper

```typescript
// src/lib/notifications.ts — helper signature
await createNotification({
  projectId,
  type: "NEW_TYPE",
  title: "...",
  message: "...",
  senderName: "...",
  senderRole: "...",
  recipientEmail: null,  // null = broadcast, email = targeted
  priority: "normal",    // low | normal | high | urgent
  relatedTaskId: null,
  relatedMailId: null,
  actionUrl: "/?p=...&tab=...",
  actionLabel: "Mở...",
});
```

> Helper tự broadcast qua notification-service (port 3002) nếu đang chạy.

### 3. Update frontend NotificationBell

Nếu cần icon/handler đặc biệt cho type mới, update `src/components/nexus/NotificationBell.tsx`.

### 4. Update API.md + docs/README.md

Add type to the "13 notification types" list.

---

## 📋 Cách thêm Activity Event Type mới

### 1. Add to ActivityLog type comment

```prisma
// prisma/schema.prisma
model ActivityLog {
  type String // ... | NEW_EVENT_TYPE  // ← add
}
```

### 2. Use via `logActivity` helper

```typescript
import { logActivity } from "@/lib/activity";

await logActivity({
  projectId,
  type: "NEW_EVENT_TYPE",
  status: "SUCCESS",  // SUCCESS | FAILED | RUNNING | WARNING
  title: "Short summary",
  details: "Longer context",
  actorName: access.name,
  actorEmail: access.email,
  actorRole: "Leader",  // Leader | Member | AI Agent | System
  actorAvatar: "",  // optional avatar URL or initials
  relatedTaskId: null,
  relatedTaskTitle: "",
  relatedMailId: null,
  actionUrl: "/?p=...&tab=...",
  actionLabel: "Mở...",
  icon: "Activity",  // lucide icon name
});
```

> Helper tự broadcast qua notification-service (`/broadcast-activity`) → dashboard widget "Recent Activity" refresh realtime.

---

## 📊 Live Log Console — Cách log từ code mới

Live Log Console dùng **AsyncLocalStorage** — không cần truyền tham số, tự biết context nào đang chạy.

### Basic usage

```typescript
import { appendLog } from "@/lib/pipeline-progress";

appendLog({
  level: "info",  // "info" | "success" | "warn" | "error"
  agentId: "01",  // optional: "01"-"10" | "TASK" | "REFINE" | "PIPELINE"
  provider: "pipeline",  // optional: "pipeline" | "openrouter" | "cache" | "fallback"
  model: "openai/gpt-oss-120b:free",  // optional
  keyIndex: 1,  // optional: 1-based API key index
  message: "Your log message here",
});
```

### Example: log in new agent

```typescript
async function myNewAgent(input: ProjectInput) {
  appendLog({
    level: "info",
    agentId: "11",
    provider: "pipeline",
    message: `[AGENT-11] Performance Engineer → start`,
  });

  try {
    const result = await callAndParse(models, prompt, context, 0.15);
    appendLog({
      level: "success",
      agentId: "11",
      provider: "pipeline",
      model: result.model,
      message: `✓ [AGENT-11] Performance Engineer → done (${result.model})`,
    });
    return result.data;
  } catch (e) {
    appendLog({
      level: "error",
      agentId: "11",
      provider: "pipeline",
      message: `✗ [AGENT-11] Performance Engineer → ${(e as Error).message}`,
    });
    throw e;
  }
}
```

### Context routing

`appendLog()` tự route đến đúng context (innermost first):

1. `refineAls` (AI Refine đang chạy)
2. `initAls` (Task generation đang chạy)
3. `pipelineAls` (Pipeline chính đang chạy)

Nếu không có context nào active → log bị drop (silent).

### Wrap new background process

Nếu thêm background process mới (vd: deploy sender), wrap trong context mới:

```typescript
// pipeline-progress.ts — add new ALS
const deployAls = new AsyncLocalStorage<string>();

export function runWithDeployLog<T>(projectId: string, fn: () => T): T {
  return deployAls.run(projectId, fn);
}

// Update appendLog to check deployAls first
export function appendLog(entry: Omit<LogEntry, "id" | "ts">): void {
  const deployPid = deployAls.getStore();
  if (deployPid) {
    pushLog(deployMap, deployPid, entry);
    return;
  }
  // ... existing refine > init > pipeline
}
```

---

## 🧪 Testing

Hiện tại project chưa có automated tests. Khi thêm feature mới:

### Manual test checklist

- [ ] Tạo project mới → pipeline chạy → tất cả 10 agents done/failed
- [ ] Check Live Log Console hiện đủ logs
- [ ] Workspace load đúng data (13 tabs)
- [ ] Edit section → save → version bumped → ActivityLog tạo
- [ ] AI Refine → tất cả 9 sections regenerated
- [ ] Khởi tạo todolist → Kanban có tasks
- [ ] Drag-drop task giữa 4 cột (todo/in_progress/review/done)
- [ ] Notification Center: bell badge, mark read, mark all read, detail modal
- [ ] Mail: compose + send SMTP, AI rewrite, attachments, reply/forward, 7 folders
- [ ] Dashboard widgets: Recent Activity, NEXUS AI Status, Tasks đang làm
- [ ] All Projects: search, filter, sort, grid/list, context menu
- [ ] Chat realtime (nếu chat service chạy port 3001)
- [ ] Push GitHub → repo + PR tạo
- [ ] Mermaid render → 3-tier fix hoạt động (regex → aggressive → AI)
- [ ] Dark theme only — không có light mode

### Lint check

```bash
bun run lint
# → Must pass with 0 errors
```

---

## 🔄 Pull Request Process

### 1. Fork + branch

```bash
git checkout -b feature/my-new-feature
```

### 2. Commit (conventional commits)

```bash
git commit -m "feat: add performance engineer agent (agent-11)"
git commit -m "fix: handle undefined result.analysis in generateTasks"
git commit -m "docs: update API.md with /reports endpoint"
git commit -m "refactor: extract mermaid fix to lib/mermaid.ts"
```

### 3. Push + PR

```bash
git push origin feature/my-new-feature
```

Mở PR trên GitHub với:
- **Title:** rõ ràng (vd: `feat: add Performance Engineer agent (agent-11)`)
- **Description:** gì thay đổi, tại sao, cách test
- **Screenshots:** nếu UI thay đổi

### 4. Review checklist

PR phải:
- [ ] Pass `bun run lint` (0 errors)
- [ ] TypeScript strict pass (no `any`, no `@ts-ignore`)
- [ ] Không break existing features
- [ ] Documentation updated (README.md, docs/, API.md nếu cần)
- [ ] No `console.log` trong production code (chỉ trong lib/ai.ts + lib/openrouter.ts cho debug)
- [ ] Responsive (test mobile + desktop)
- [ ] Không thêm dependencies mới nếu không cần thiết
- [ ] Database changes: đã chạy `bun run db:push` và test

---

## 🐛 Bug Reports

Khi báo bug, include:

1. **Mô tả** ngắn gọn
2. **Steps to reproduce**
3. **Expected vs actual behavior**
4. **Screenshots** (nếu UI bug)
5. **Dev log** snippet (`tail -50 dev.log`)
6. **Browser + OS**
7. **.env** config (CHE API keys!)

---

## 💡 Feature Requests

Mở issue với label `enhancement`. Discuss trước khi code lớn.

### Ideas welcome

- 🤖 Thêm AI Agent mới (Performance, i18n, Accessibility, ...)
- 📊 Analytics dashboard nâng cao (burn-down chart, velocity)
- 🔔 Push notifications (Web Push API)
- 🌐 i18n (Vietnamese / English)
- 📱 PWA (mobile app)
- 🧪 Automated tests (Jest + Playwright)
- ⚡ WebSocket polling fallback cải tiến

---

## 📞 Liên hệ

- **GitHub Issues:** https://github.com/vanhoi04082006-pixel/Nexus-AI/issues
- **GitHub:** [@vanhoi04082006-pixel](https://github.com/vanhoi04082006-pixel)

---

<p align="center">
  <strong>Cảm ơn bạn đã đóng góp!</strong> 🙏
</p>
