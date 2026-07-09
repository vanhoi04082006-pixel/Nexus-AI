# 🤝 Contributing to NEXUS AI (v0.2.0)

Cảm ơn bạn đã quan tâm đóng góp cho **NEXUS AI — Multi-Agent Project Architect**! 🎉

NEXUS AI là ứng dụng Next.js 16 dùng **10 AI agents** chạy pipeline để phân tích, thiết kế và sinh artifacts cho dự án phần mềm (UML, todolist, kiến trúc, chat...). Tài liệu này giúp bạn setup dev env, hiểu code style, và mở rộng project đúng chuẩn.

> **Stack:** Next.js 16 · TypeScript 5 (strict) · Prisma 6 · SQLite · Zustand · shadcn/ui · OpenRouter AI · Socket.io (mini-service) · Bun 1.x

---

## 📑 Mục lục

- [🚀 Dev Setup](#-dev-setup)
- [📁 Project Structure](#-project-structure)
- [🎨 Code Style](#-code-style)
- [🗄️ Database Changes](#️-database-changes)
- [🤖 Cách thêm AI Agent mới](#-cách-thêm-ai-agent-mới)
- [🧠 Cách thêm Model mới](#-cách-thêm-model-mới)
- [🌐 Cách thêm API Route mới](#-cách-thêm-api-route-mới)
- [🧩 Cách thêm shadcn/ui component](#-cách-thêm-shadcnui-component)
- [🛡️ Zod Schemas — Lenient Preprocessors](#️-zod-schemas--lenient-preprocessors)
- [📟 Live Log Console](#-live-log-console)
- [🧪 Testing Checklist](#-testing-checklist)
- [🔄 Pull Request Checklist](#-pull-request-checklist)

---

## 🚀 Dev Setup

### Yêu cầu

| Tool | Version | Mục đích |
|------|---------|----------|
| [Bun](https://bun.sh) | 1.x (primary) | Runtime + package manager + dev server |
| [Node.js](https://nodejs.org) | 20+ | Cần cho Prisma CLI + scripts Node thuần |
| [OpenRouter API key](https://openrouter.ai/keys) | free tier OK | Gọi LLM (Gemini, Qwen, DeepSeek, ...) |

### Cài đặt lần đầu

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
cp .env.example .env       # Điền OPENROUTER_API_KEY vào .env
bun install
bun run db:push            # push Prisma schema → SQLite (db/custom.db)
```

### Các script chính

| Lệnh | Mô tả |
|------|-------|
| `bun run dev` | Next.js dev server ở port **3000**, log ghi ra `dev.log` |
| `bun run lint` | ESLint 9 + `eslint-config-next` (phải pass 0 errors trước PR) |
| `bun run build` | Production build |
| `bun run start` | Production bằng Bun + Next.js standalone |
| `bun run db:push` | Push schema Prisma xuống SQLite |

### Theo dõi log khi dev

```bash
bun run dev       # terminal 1
tail -f dev.log   # terminal 2 — xem full server log
```

Dev server auto-reload khi save. Nếu thấy chậm, check `dev.log` — Turbopack đôi khi nuốt error.

---

## 📁 Project Structure

```
src/
├── app/                        # Next.js App Router (routes + API)
│   ├── api/                    # 42 route files (REST endpoints)
│   ├── layout.tsx              # Root layout (providers, theme)
│   ├── page.tsx                # Landing / dashboard
│   ├── error.tsx               # Error boundary route
│   └── globals.css             # Tailwind + design tokens
├── components/
│   ├── ui/                     # 48 shadcn/ui components (New York)
│   ├── nexus/                  # Feature components
│   │   └── tabs/               # UI cho từng section (UML, Todolist, Chat, ...)
│   ├── ErrorBoundary.tsx       # Class-based boundary
│   ├── providers/              # NotificationProvider (Socket.io)
│   └── states/                 # EmptyState, RetryState, LoadingState
├── lib/
│   ├── ai.ts                   # 70-line hub — re-export + orchestrate
│   ├── ai/                     # 24 AI modules (agents, prompts, pipeline, ...)
│   ├── openrouter.ts           # AI client (anti-rate-limit, retry, fallback)
│   ├── schemas.ts              # Zod schemas (lenient preprocessors)
│   ├── types.ts                # Shared TypeScript types
│   ├── db.ts                   # Prisma client singleton
│   ├── access.ts               # resolveAccess(id, token) — auth helper
│   ├── activity.ts             # logActivity() — audit trail
│   ├── email.ts, github.ts, notify.ts   # Optional integrations
│   └── pipeline-progress.ts    # AsyncLocalStorage — route log → project
├── store/useNexus.ts           # Zustand store (global app state)
└── hooks/                      # Custom React hooks
```

### Quy ước thư mục

- **`app/api/`** — mỗi route 1 file `route.ts`, không dùng Pages Router.
- **`components/ui/`** — KHÔNG sửa tay nếu có thể, sinh bằng `bunx shadcn@latest add`.
- **`components/nexus/tabs/`** — mỗi tab 1 file, named export default.
- **`lib/ai/`** — module hoá, không dump tất cả vào `ai.ts`.

---

## 🎨 Code Style

### TypeScript

- **Strict mode** xuyên suốt — không dùng `any` (trừ khi thực sự cần + comment lý do).
- Dùng `interface` cho object shape, `type` cho union/intersection.

### Client vs Server components

```tsx
// Client component — PHẢI có "use client" ở dòng đầu
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Counter() {
  const [n, setN] = useState(0);
  return <Button onClick={() => setN((c) => c + 1)}>{n}</Button>;
}
```

```tsx
// Server component — KHÔNG có "use client", default
import { db } from "@/lib/db";

export default async function ProjectsPage() {
  const projects = await db.project.findMany();
  return <ul>{projects.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

### UI components

- **Ưu tiên shadcn/ui** thay vì tự viết — đảm bảo design system đồng nhất.
- Dùng `cn()` từ `@/lib/utils` để merge className.
- Color tokens: `bg-background`, `text-foreground`, `border-border` (dark mode mặc định).

### Conventional Commits & Branches

```
feat: thêm agent Security Reviewer
fix: fallback khi OpenRouter 429
refactor: tách pipeline.ts thành 3 module
docs: cập nhật API.md cho endpoint /analyze
chore: bump prisma lên 6.2
```

- `main` — production, luôn deploy được.
- `feature/*` — tính năng mới (vd: `feature/security-agent`).
- `fix/*` — bug fix (vd: `fix/pipeline-race-condition`).

---

## 🗄️ Database Changes

Project dùng **Prisma 6 + SQLite** ở `db/custom.db`. **Không** dùng migration files (chỉ `db:push`).

### Workflow

1. Sửa `prisma/schema.prisma`:

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String
  status    String   @default("draft")
  tags      String[] @default([])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

2. Push xuống DB + restart dev server (để Prisma Client regenerate types):

```bash
bun run db:push
```

> **Lưu ý:** `db:push` không giữ data khi thay đổi breaking (vd: đổi type column). Dump SQLite trước nếu cần giữ data test:
> ```bash
> cp db/custom.db db/custom.db.bak
> ```

---

## 🤖 Cách thêm AI Agent mới

Pipeline NEXUS chạy **10 agents** tuần tự. Để thêm agent thứ 11, làm theo **9 bước**:

**1. Định nghĩa Agent** — `src/lib/ai/agents/definitions.ts`

```ts
export interface AgentDef {
  id: string;        // "security-reviewer"
  name: string;      // "Security Reviewer"
  key: SectionType;  // "security" — phải khớp types.ts
  models: string[];  // ["deepseek/deepseek-r1:free", ...]
  temp: number;      // 0.3 — thấp cho task phân tích
  required: boolean; // true nếu pipeline fail khi agent lỗi
}

export const AGENTS: AgentDef[] = [
  // ... existing
  { id: "security-reviewer", name: "Security Reviewer", key: "security",
    models: ["deepseek/deepseek-r1:free", "qwen/qwen-2.5-72b-instruct:free"],
    temp: 0.3, required: false },
];
```

**2. Thêm system prompt** — `src/lib/ai/prompts/index.ts`

```ts
export const PROMPT_MAP: Record<string, string> = {
  security: `Bạn là chuyên gia bảo mật phần mềm.
Phân tích kiến trúc dự án dưới góc độ security.
Trả về JSON: threats, recommendations, severity. Luôn trả lời tiếng Việt.`,
};
```

**3. Thêm Zod schema** — `src/lib/schemas.ts` (dùng lenient preprocessors)

```ts
export const securitySchema = z.object({
  threats: toStringArray,
  recommendations: toStringArray,
  severity: z.enum(["low", "medium", "high", "critical"]).catch("low"),
});
export const SCHEMAS: Record<string, z.ZodType> = { /* ... */ security: securitySchema };
```

**4. Thêm MIN_KEYS** — `src/lib/ai/agents/definitions.ts` (field tối thiểu bắt buộc)

```ts
export const MIN_KEYS: Record<string, string[]> = {
  security: ["threats", "recommendations"],
};
```

**5. Thêm fallback case** — `src/lib/ai/pipeline/fallback.ts`

```ts
export function getFallback(key: string): unknown {
  switch (key) {
    case "security":
      return { threats: ["Không xác định — agent lỗi"], recommendations: ["Check manually"], severity: "low" };
    default: return null;
  }
}
```

**6. Tạo tab UI** — `src/components/nexus/tabs/SecurityTab.tsx`

```tsx
"use client";
import { useNexus } from "@/store/useNexus";
import { EmptyState } from "@/components/states/EmptyState";

export function SecurityTab() {
  const security = useNexus((s) => s.project?.sections?.security);
  if (!security) return <EmptyState message="Chưa có dữ liệu security" />;
  return <div className="space-y-4"><h2 className="text-xl font-bold">Security Review</h2>{/* render */}</div>;
}
```

**7. Wire tab vào WorkspaceView** — `src/components/nexus/WorkspaceView.tsx`

```tsx
import { SecurityTab } from "./tabs/SecurityTab";
const TABS: Record<SectionType, React.FC> = { /* ... */ security: SecurityTab };
```

**8. Thêm SectionType** — `src/lib/types.ts`

```ts
export type SectionType = "overview" | "requirements" | "architecture" /* ... */ | "security";
```

**9. Cập nhật docs** — `docs/API.md` nếu agent đi kèm endpoint mới (vd: `POST /api/projects/[id]/regenerate?section=security`).

> **Test:** `bun run dev` → tạo test project → kiểm tra tab Security render đúng.

---

## 🧠 Cách thêm Model mới

OpenRouter cung cấp hàng trăm model. Để thêm model cho agent hiện có, thêm vào mảng `models[]`:

```ts
// src/lib/ai/agents/definitions.ts
{
  id: "architect",
  name: "Architect",
  key: "architecture",
  models: [
    "google/gemini-2.0-flash-exp:free",       // existing
    "meta-llama/llama-3.3-70b-instruct:free",  // ← thêm dòng này
  ],
  temp: 0.4,
  required: true,
}
```

### Định dạng model string

```
provider/model-name:free
```

- `provider` — `google`, `deepseek`, `qwen`, `meta-llama`, `mistral`, ...
- `:free` — suffix cho free tier (OpenRouter qui ước).

### Test

```bash
bun run dev
# Tạo project mới → chạy pipeline → xem dev.log
# Kiểm tra agent nào dùng model mới, output có parse được không
```

> **Rate limit:** OpenRouter free tier giới hạn ~20 req/phút. `src/lib/openrouter.ts` đã có retry + exponential backoff + fallback sang model kế tiếp trong mảng `models[]`.

---

## 🌐 Cách thêm API Route mới

### Template chuẩn

```ts
// src/app/api/projects/[id]/archive/route.ts
import { NextRequest } from "next/server";
import { resolveAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";  // luôn fresh, không cache
export const runtime = "nodejs";         // cần Prisma + Node APIs

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await resolveAccess(id, req.headers);
    if (!access.ok) return Response.json({ error: access.error }, { status: 401 });

    const updated = await db.project.update({ where: { id }, data: { status: "archived" } });
    await logActivity({ projectId: id, type: "project.archive", details: { status: "archived" } });
    return Response.json(updated);
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "Archive failed", details }, { status: 500 });
  }
}
```

### Checklist cho mỗi route

- [ ] Có `export const dynamic = "force-dynamic";`
- [ ] Có `export const runtime = "nodejs";`
- [ ] Dùng `resolveAccess(id, token)` cho auth — KHÔNG trust client.
- [ ] Gọi `logActivity()` để có audit trail (xem được ở History tab).
- [ ] Try-catch toàn bộ body, return `{ error, details }` + HTTP status.
- [ ] KHÔNG dùng `console.log` cho logic — dùng `appendLog()` (xem bên dưới).

---

## 🧩 Cách thêm shadcn/ui component

### Tự động (khuyến nghị)

```bash
bunx shadcn@latest add accordion
bunx shadcn@latest add data-table
```

`components.json` đã cấu hình New York style, CSS variables, dark mode. File tạo ở `src/components/ui/[name].tsx`.

### Thủ công (khi chưa có trong registry shadcn)

```tsx
// src/components/ui/my-widget.tsx
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface MyWidgetProps extends React.HTMLAttributes<HTMLDivElement> { title: string }
export const MyWidget = React.forwardRef<HTMLDivElement, MyWidgetProps>(
  ({ className, title, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border p-4", className)} {...props}>
      <h3 className="font-semibold">{title}</h3>
    </div>
  )
);
MyWidget.displayName = "MyWidget";
```

> **Không** sửa tay các file trong `components/ui/` nếu có thể regenerate — sẽ bị conflict khi update shadcn.

---

## 🛡️ Zod Schemas — Lenient Preprocessors

Vì AI output **không deterministic** — cùng 1 field model có thể trả string HOẶC array — NEXUS dùng **lenient preprocessors** trong `src/lib/schemas.ts`:

### 3 preprocessor chính — `src/lib/schemas.ts`

```ts
import { z } from "zod";

// toString — accept string | number | array → string
export const toString = z.preprocess((val) => {
  if (Array.isArray(val)) return val.join("\n");
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return val;
  return "";
}, z.string());

// toStringArray — accept string | array → array (split by comma/newline)
export const toStringArray = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") return val.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  return [];
}, z.array(z.string()));

// toNumber — accept string | number → number
export const toNumber = z.preprocess((val) => {
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = Number(val); return Number.isNaN(n) ? 0 : n; }
  return 0;
}, z.number());
```

### Ví dụ schema agent

```ts
export const overviewSchema = z.object({
  summary: toString,
  goals: toStringArray,
  targetUsers: toStringArray,
  complexity: z.enum(["low", "medium", "high"]).catch("medium"),
});
export const SCHEMAS: Record<string, z.ZodType> = { overview: overviewSchema, /* ... */ };
```

### Nguyên tắc

- **Luôn dùng preprocessor** cho field mà AI có thể trả nhiều dạng.
- **Dùng `.catch(default)`** cho enum để pipeline không crash khi model trả giá trị lạ.
- **Không throw** trong schema — fallback value tốt hơn crash toàn pipeline.

---

## 📟 Live Log Console

NEXUS có **Live Log Console** hiển thị log real-time cho mỗi project (pipeline/init/refine). Log route tới đúng project bằng **AsyncLocalStorage**.

### API

```ts
import { appendLog } from "@/lib/pipeline-progress";

await appendLog({
  level: "info",          // "info" | "warn" | "error" | "debug"
  agentId: "architect",   // id agent (hoặc "system")
  provider: "google",     // OpenRouter provider
  model: "gemini-2.0-flash-exp:free",
  keyIndex: 0,            // index model trong mảng models[]
  message: "Bắt đầu sinh architecture",
});
```

### Cách hoạt động

1. Khi pipeline bắt đầu cho project X, AsyncLocalStorage set context `{ projectId: X, phase: "pipeline" }`.
2. Mọi lời gọi `appendLog()` trong async chain đó được tự động gắn với project X.
3. Log stream tới client qua Socket.io (mini-service).
4. **Max 2000 log lines/project** (tăng từ 500 trước đây) — tránh memory bloat cho pipeline dài.
5. Khi pipeline hoàn tất, toàn bộ log được save vào `ActivityLog.details` (JSON) — xem được ở **History tab**.

### Khi nào dùng `appendLog` vs `console.log`

| Trường hợp | Dùng |
|------------|------|
| Logic trong AI pipeline, cần hiện cho user | `appendLog()` |
| Debug dev local, không muốn user thấy | `console.log()` (**phải xoá trước PR**) |
| Error route, cần log server | `console.error()` + return `{ error, details }` |

> **Quy tắc vàng:** Code production KHÔNG được để `console.log`. PR có `console.log` sẽ bị reject.

---

## 🧪 Testing Checklist

NEXUS **chưa có automated tests** (no Jest/Vitest). Mỗi PR phải test thủ công:

**Smoke test:**

- [ ] `bun run lint` passes (0 errors)
- [ ] `bun run dev` starts without errors
- [ ] `bun run build` thành công (no TS errors)

**Functional:**

- [ ] Tạo test project → pipeline hoàn tất (10 agents chạy xong)
- [ ] Tất cả tabs render content (không empty state khi đã có data)
- [ ] UML diagrams render đúng (Mermaid syntax valid)
- [ ] Todolist generation hoạt động (nút initialize → sinh tasks)
- [ ] Chat + Notifications hoạt động (Socket.io mini-service)

**UI/UX + Edge cases:**

- [ ] Mobile responsive — check width **375px** (iPhone SE)
- [ ] Dark mode (default theme) hiển thị đúng
- [ ] Không console errors trong browser DevTools
- [ ] Không memory leak khi chạy pipeline dài (DevTools Memory tab)
- [ ] OpenRouter rate limit → fallback model hoạt động
- [ ] Network disconnect giữa pipeline → UI hiển thị error + retry
- [ ] Project rất lớn (nhiều sections) → không lag

---

## 🔄 Pull Request Checklist

Trước khi mở PR, đảm bảo:

**Code quality:**

- [ ] `bun run lint` passes
- [ ] Không có TypeScript errors (`bun run build` passes)
- [ ] **Không** `console.log` trong production code (dùng `appendLog` cho AI pipeline)
- [ ] Cập nhật docs (`docs/API.md`, `docs/ARCHITECTURE.md`) nếu API/feature thay đổi

**Testing + Git hygiene:**

- [ ] Test trên **mobile + desktop**, verify [Testing Checklist](#-testing-checklist) ở trên
- [ ] Nếu thêm agent mới → tạo test project → verify tab render
- [ ] Conventional commit message (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- [ ] Branch name đúng format (`feature/*` hoặc `fix/*`)
- [ ] Rebase lên `main` mới nhất trước khi push
- [ ] Mô tả PR rõ ràng — **mô tả breaking changes** nếu có

**PR template (gợi ý):**

```markdown
## What
- Mô tả ngắn gọn thay đổi

## Why
- Context / lý do

## How
- Các bước implement chính

## Breaking changes
- (nếu có) Liệt kê + migration guide

## Test
- [x] bun run lint
- [x] bun run build
- [x] Manual test (mô tả)
```

---

## 💬 Tone & Triết lý

- **Friendly but technical** — comment ngắn gọn, đúng trọng tâm, không giải thích obvious.
- Tiếng Việt cho business logic comment, tiếng Anh cho technical terms (vd: "fallback khi rate limit").
- Tránh over-engineering — nếu 10 dòng giải quyết được, không viết 100 dòng.
- PR review tôn trọng — focus vào code, không phải người. Khi reject, luôn giải thích **why** + suggest solution.
- Đặt câu hỏi nếu unclear — tốt hơn là implement sai.

> **Architecture:** "Modular nhưng không over-abstracted. Mỗi module 1 trách nhiệm rõ ràng, interface hẹp, dễ test."
> - `lib/ai.ts` chỉ 70 dòng — hub thuần, không logic.
> - 24 module trong `lib/ai/` mỗi module 1 concern (agents, prompts, pipeline, fallback, ...).
> - shadcn/ui > custom UI — tiết kiệm thời gian, đồng nhất design.

---

## 📞 Liên hệ / Hỗ trợ

- **Issues:** [github.com/vanhoi04082006-pixel/Nexus-AI/issues](https://github.com/vanhoi04082006-pixel/Nexus-AI/issues)
- **Docs khác:**
  - [README.md](./README.md) — Overview + quickstart
  - [API.md](./API.md) — Chi tiết 42 API routes
  - [ARCHITECTURE.md](./ARCHITECTURE.md) — Sơ đồ kiến trúc + data flow

Cảm ơn bạn đã đóng góp! Mỗi PR — dù nhỏ — đều giúp NEXUS AI tốt hơn. 🚀

---

<p align="center">
  <sub>NEXUS AI v0.2.0 · Multi-Agent Project Architect · Made with 🤍 by the community</sub>
</p>
