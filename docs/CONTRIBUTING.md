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
- [Live Log Console — Cách log từ code mới](#-live-log-console--cách-log-từ-code-mới)
- [Testing](#-testing)
- [Pull Request Process](#-pull-request-process)

---

## 🚀 Dev Setup

### Yêu cầu

- [Bun](https://bun.sh) v1+
- [Node.js](https://nodejs.org) v18+ (cho Prisma CLI)
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
# → http://localhost:3000
```

Dev server auto-reload khi save file. Log ghi ra `dev.log`:

```bash
tail -f dev.log
```

### Chạy chat service (optional, cho realtime chat)

```bash
cd mini-services/chat-service
bun install
bun run dev
# → port 3001
```

Nếu không chạy chat service, frontend tự fallback sang HTTP polling 3s.

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
│   └── schema.prisma              # DB schema — edit here then `bun run db:push`
├── src/
│   ├── app/
│   │   ├── api/                   # REST API routes (23 endpoints)
│   │   ├── layout.tsx             # Root layout (Mermaid CDN, themes)
│   │   └── page.tsx               # Main page (router: home/input/workspace)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui (40+ components — KHÔNG sửa)
│   │   └── nexus/
│   │       ├── tabs/              # 11 workspace tabs
│   │       ├── HomeView.tsx
│   │       ├── InputView.tsx
│   │       ├── WorkspaceView.tsx
│   │       ├── ProcessingOverlay.tsx
│   │       ├── TaskProcessingOverlay.tsx
│   │       └── ...
│   ├── lib/
│   │   ├── ai.ts                  # 8-agent pipeline
│   │   ├── openrouter.ts          # Multi-key rotation client
│   │   ├── github.ts              # Push + PR
│   │   ├── email.ts               # SMTP
│   │   ├── pipeline-progress.ts   # ALS log + progress maps
│   │   ├── access.ts              # Token auth
│   │   ├── db.ts                  # Prisma client
│   │   └── types.ts
│   └── store/
│       └── useNexus.ts            # Zustand store
├── mini-services/
│   └── chat-service/              # Socket.io (port 3001)
├── scripts/                       # Run scripts (Windows/macOS/Linux)
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
- **Error format:** `{ error: "msg", details: "..." }`

```typescript
import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";

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

  // ... logic

  return Response.json({ data: "..." });
}
```

### Color & Styling

- **No indigo/blue** — dùng `bg-primary`, `text-primary`, `bg-background`, etc.
- **Dark theme** — teal accent (`primary` = teal)
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
model Notification {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([projectId])
}
```

```bash
bun run db:push
```

> **Note:** SQLite không support tất cả Prisma features (vd: enums). Dùng `String` + union type thay thế.

---

## 🤖 Cách thêm AI Agent mới

Ví dụ: thêm Agent-09 "Security Auditor".

### 1. Define agent trong `src/lib/ai.ts`

```typescript
const SECURITY_AUDITOR_MODELS = [
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

// Thêm vào AGENTS array
const AGENTS: AgentDef[] = [
  // ... existing 7 agents
  {
    id: "09",
    name: "Security Auditor",
    key: "security",  // ← new SectionType
    required: false,
    temp: 0.15,
    models: SECURITY_AUDITOR_MODELS,
  },
];
```

### 2. Add `security` to SectionType

```typescript
// src/lib/types.ts
export type SectionType =
  | "analysis" | "hr" | "sprint" | "design"
  | "uml" | "docs" | "git"
  | "security";  // ← add
```

### 3. Add prompt builder

```typescript
// src/lib/ai.ts
function securityPrompt(): string {
  return `Ban la Security Auditor. Phan tich security cho du an.
${JSON_INSTRUCTION}
Tra object voi cac key:
- "threats" (array): { "risk", "severity", "mitigation" }
- "authFlow" (string)
- "dataProtection" (string)`;
}

const PROMPT_MAP: Record<SectionType, () => string> = {
  // ... existing
  security: securityPrompt,
};
```

### 4. Add to MIN_KEYS + fallback

```typescript
const MIN_KEYS: Record<SectionType, string[]> = {
  // ... existing
  security: ["threats", "authFlow"],
};

function fallback(key: SectionType, input: ProjectInput, results: Partial<ProjectResult>): unknown {
  // ... existing
  if (key === "security") {
    return {
      threats: [{ risk: "SQL Injection", severity: "High", mitigation: "Use Prisma parameterized queries" }],
      authFlow: "JWT + refresh token",
      dataProtection: "bcrypt + HTTPS",
    };
  }
}
```

### 5. Add to SECTION_KEYS (for persistence)

```typescript
// src/app/api/projects/_lib/reconstruct.ts
export const SECTION_KEYS: SectionType[] = [
  "analysis", "hr", "sprint", "design", "uml", "docs", "git",
  "security",  // ← add
];
```

### 6. Add tab UI (optional)

```tsx
// src/components/nexus/tabs/SecurityTab.tsx
"use client";
import { useNexus } from "@/store/useNexus";

export function SecurityTab() {
  const result = useNexus((s) => s.result);
  if (!result?.security) return <div>Chưa có dữ liệu security</div>;
  return (
    <div>
      <h2>Security Audit</h2>
      {/* render threats, authFlow, dataProtection */}
    </div>
  );
}
```

Add to `WorkspaceView.tsx`:
```typescript
case "security":
  return <SecurityTab />;
```

### 7. Add to ProgressOverlay agent board

Update `startPipeline` trong `useNexus.ts`:
```typescript
agents: [
  // ... 01-08
  { id: "09", name: "Security Auditor", status: "pending" },
],
```

Update `initProgress` trong `pipeline-progress.ts`:
```typescript
agents: [
  // ... 01-08
  { id: "09", name: "Security Auditor", status: "pending" },
],
```

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
      NEW_MODEL,  // ← add to priority list
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "openai/gpt-oss-120b:free",
    ],
    // ...
  },
];
```

### 2. Test

```bash
bun run dev
# Tạo project mới → xem Live Log Console
# → Check model có trong priority list + thử fallback
```

### 3. (Optional) Update README model table

Update the "8 AI Agents — Model Priority" table in [README.md](../README.md) to reflect the new model order.

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
  // ... existing
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
activeTab: SectionType | "chat" | "members" | "tasks" | "mailbox" | "reports";
```

---

## 🔌 Cách thêm API Route mới

### 1. Create route file

```typescript
// src/app/api/projects/[id]/reports/route.ts
import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

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

## 📊 Live Log Console — Cách log từ code mới

Live Log Console dùng **AsyncLocalStorage** — không cần truyền tham số, tự biết context nào đang chạy.

### Basic usage

```typescript
import { appendLog } from "@/lib/pipeline-progress";

appendLog({
  level: "info",  // "info" | "success" | "warn" | "error"
  agentId: "01",  // optional: "01"-"08" | "TASK" | "REFINE" | "PIPELINE"
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
    agentId: "09",
    provider: "pipeline",
    message: `[AGENT-09] Security Auditor → start`,
  });

  try {
    const result = await callAndParse(models, prompt, context, 0.15);
    appendLog({
      level: "success",
      agentId: "09",
      provider: "pipeline",
      model: result.model,
      message: `✓ [AGENT-09] Security Auditor → done (${result.model})`,
    });
    return result.data;
  } catch (e) {
    appendLog({
      level: "error",
      agentId: "09",
      provider: "pipeline",
      message: `✗ [AGENT-09] Security Auditor → ${(e as Error).message}`,
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

Nếu thêm background process mới (vd: email sender), wrap trong context mới:

```typescript
// pipeline-progress.ts — add new ALS
const emailAls = new AsyncLocalStorage<string>();

export function runWithEmailLog<T>(projectId: string, fn: () => T): T {
  return emailAls.run(projectId, fn);
}

// Update appendLog to check emailAls first
export function appendLog(entry: Omit<LogEntry, "id" | "ts">): void {
  const emailPid = emailAls.getStore();
  if (emailPid) {
    pushLog(emailMap, emailPid, entry);
    return;
  }
  // ... existing refine > init > pipeline
}
```

---

## 🧪 Testing

Hiện tại project chưa có automated tests. Khi thêm feature mới:

### Manual test checklist

- [ ] Tạo project mới → pipeline chạy → tất cả 8 agents done/failed
- [ ] Check Live Log Console hiện đủ logs
- [ ] Workspace load đúng data (11 tabs)
- [ ] Edit section → save → version bumped
- [ ] AI Refine → tất cả sections regenerated
- [ ] Khởi tạo todolist → Kanban có tasks
- [ ] Drag-drop task giữa 4 cột
- [ ] Chat realtime (nếu chat service chạy)
- [ ] Push GitHub → repo + PR tạo
- [ ] Email gửi (nếu SMTP config đúng)

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
git commit -m "feat: add security auditor agent"
git commit -m "fix: handle undefined result.analysis in generateTasks"
git commit -m "docs: update API.md with /reports endpoint"
```

### 3. Push + PR

```bash
git push origin feature/my-new-feature
```

Mở PR trên GitHub với:
- **Title:** rõ ràng (vd: `feat: add Security Auditor agent`)
- **Description:** gì thay đổi, tại sao, cách test
- **Screenshots:** nếu UI thay đổi

### 4. Review checklist

PR phải:
- [ ] Pass `bun run lint` (0 errors)
- [ ] Không break existing features
- [ ] Documentation updated (README.md, docs/, API.md nếu cần)
- [ ] No `console.log` trong production code (chỉ trong lib/ai.ts + lib/openrouter.ts cho debug)
- [ ] TypeScript strict pass (no `any`, no `@ts-ignore`)
- [ ] Responsive (test mobile + desktop)
- [ ] Không thêm dependencies mới nếu không cần thiết

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

- 🤖 Thêm AI Agent mới (Security, Performance, i18n, etc.)
- 🎨 Theme switcher (light/dark)
- 📊 Analytics dashboard (task progress, burn-down chart)
- 🔔 Push notifications
- 🌐 i18n (Vietnamese / English)
- 📱 PWA (mobile app)
- 🧪 Automated tests (Jest + Playwright)

---

## 📞 Liên hệ

- **GitHub Issues:** https://github.com/vanhoi04082006-pixel/Nexus-AI/issues
- **Email:** (tùy chọn)

---

<p align="center">
  <strong>Cảm ơn bạn đã đóng góp!</strong> 🙏
</p>
