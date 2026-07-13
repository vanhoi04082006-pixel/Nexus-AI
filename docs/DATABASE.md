# 🗄️ NEXUS AI — Database Documentation

> Tài liệu database cho **NEXUS AI v0.3.0** — 23 Prisma models trên SQLite.
>
> **Source:**
> - Schema: [`prisma/schema.prisma`](../prisma/schema.prisma)
> - Client: [`src/lib/db.ts`](../src/lib/db.ts)
> - Migration scripts: [`package.json`](../package.json) (`db:push`, `db:generate`, `db:migrate`, `db:reset`)

---

## 📑 Mục lục

1. [Tổng quan](#-tổng-quan)
2. [23 Models theo nhóm](#-23-models-theo-nhóm)
3. [Key Relationships Diagram](#-key-relationships-diagram)
4. [Indexes (@@index)](#-indexes-index)
5. [Cascade Delete Behavior](#-cascade-delete-behavior)
6. [Migration Commands](#-migration-commands)
7. [Best Practices](#-best-practices)

---

## 🧩 Tổng quan

| Thuộc tính | Giá trị |
|---|---|
| **Database engine** | SQLite (file-based, không cần server) |
| **File path** | `db/custom.db` (dev) / `/data/custom.db` (Docker, Fly.io) |
| **ORM** | Prisma v6.11 (`@prisma/client` + `prisma`) |
| **Schema file** | `prisma/schema.prisma` |
| **Số models** | 23 |
| **Datasource URL** | `env("DATABASE_URL")` — default `file:./db/custom.db` |

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

> ⚠️ **Lưu ý:** SQLite không có native array type. Mọi array field (`tags`, `techStack`, `toEmails`, `modules`, `implementationSteps`...) đều lưu dưới dạng **JSON string** và parse bằng `JSON.parse()` ở application layer.

---

## 📦 23 Models theo nhóm

### 1. Core (Project & Collaboration) — 6 models

| # | Model | Mô tả | Fields quan trọng |
|---|---|---|---|
| 1 | **Project** | Entity chính — 1 dự án phần mềm | `topic`, `description`, `purpose`, `status`, `leaderName`, `leaderEmail`, `leaderToken`, `leaderSmtpPassword?`, `githubToken?`, `isFavorite`, `isArchived`, `priority`, `deadline?`, `techStack` (JSON), `tags` (JSON), `coverColor` |
| 2 | **Member** | Thành viên trong project | `name`, `email`, `strengths`, `weaknesses`, `role`, `inviteToken`, `joinedAt?` |
| 3 | **ProjectContext** | Long-term memory cache (compress pipeline results) | `projectId` (unique), `summary`, `fullResults?`, `tokensUsed`, `runCount` |
| 4 | **Analysis** | Versioned analysis section (7 types: ANALYSIS, HR, SPRINT, DESIGN, UML, DOCS, GIT) | `type`, `content` (JSON), `version` |
| 5 | **Task** | Todolist task (SMART model + Kanban) | `title`, `description`, `assigneeName`, `layer` (DATABASE/BACKEND/UI/CONFIG/TESTING), `targetFile`, `implementationSteps` (JSON), `technicalHints` (JSON), `status`, `priority`, `hours` |
| 6 | **EditProposal** | Proposal từ chat — leader approve → AI refine | `section`, `requestedChange`, `status` (PENDING/APPROVED/REJECTED/APPLIED) |

### 2. Logging & Audit — 4 models

| # | Model | Mô tả | Fields quan trọng |
|---|---|---|---|
| 7 | **ActivityLog** | All pipeline/init/refine logs + actor info | `type` (25 loại: PROJECT_CREATED, MEMBER_JOINED, AI_AGENT_DONE, MAIL_SENT...), `status`, `title`, `details`, `actorName`, `actorEmail`, `actorRole`, `relatedTaskId?`, `actionUrl`, `icon` |
| 8 | **TaskLog** | Audit trail of every task mutation | `taskId`, `action` (CREATED/UPDATED/STATUS_CHANGED/COMPLETED), `oldStatus?`, `newStatus?`, `actorName`, `details` |
| 9 | **TokenLog** | API cost log — track tokens per agent per project | `agentId`, `agentName`, `model`, `apiKeyId`, `promptTokens`, `completionTokens`, `totalTokens`, `success`, `errorMsg?`, `duration` |
| 10 | **ChatMessage** | Project chat messages (member + AI) | `authorName`, `authorRole` (leader/member/ai), `message` |

### 3. Monitoring & Pipeline — 4 models

| # | Model | Mô tả | Fields quan trọng |
|---|---|---|---|
| 11 | **AgentStatus** | Live AI agent status (online/offline/busy/error/idle) | `agentId` (unique), `name`, `role`, `status`, `currentTask`, `projectId?`, `lastActiveAt?` |
| 12 | **SystemStatus** | Subsystem status (database/redis/vector_db/storage/pipeline) | `subsystem` (unique), `status`, `details`, `metadata` (JSON) |
| 13 | **PipelineStatus** | One row per running/recent pipeline per project | `status` (ready/running/paused/failed/success), `currentAgent`, `progress` (0-100), `stage`, `startedAt?`, `finishedAt?`, `error?` |
| 14 | **TaskStatistic** | Cached aggregate per project (refresh on task changes) | `totalTasks`, `doneTasks`, `inProgressTasks`, `todoTasks`, `reviewTasks`, `overdueTasks`, `dueSoonTasks`, `completionRate` |

### 4. Notifications — 2 models

| # | Model | Mô tả | Fields quan trọng |
|---|---|---|---|
| 15 | **Notification** | Bell icon alerts (task/proposal/mail/deadline/AI) | `type`, `title`, `message`, `senderName`, `senderRole`, `recipientEmail?` (null=broadcast), `priority`, `relatedTaskId?`, `relatedMailId?`, `actionUrl`, `actionLabel`, `extra` (JSON), `read` (legacy) |
| 16 | **NotificationRead** | Per-user read receipt (1 row per reader per notification) | `notificationId`, `readerEmail`, `readAt` |

### 5. Mail System — 4 models

| # | Model | Mô tả | Fields quan trọng |
|---|---|---|---|
| 17 | **Email** | Email content (1 row per email sent) | `fromEmail`, `fromName`, `toEmails` (JSON), `ccEmails` (JSON), `bccEmails` (JSON), `subject`, `bodyHtml`, `bodyText`, `type`, `smtpStatus`, `smtpError?`, `parentEmailId?` (threading) |
| 18 | **EmailAttachment** | File đính kèm (base64 content) | `emailId`, `filename`, `mimeType`, `size`, `content` (base64) |
| 19 | **Mailbox** | Per-user mailbox state (folder, read, starred) | `emailId`, `userEmail`, `folder` (INBOX/SENT/DRAFT/TRASH/ARCHIVE/SPAM), `isRead`, `isStarred`, `isArchived`, `isTrashed`, `readAt?`, `trashedAt?` |
| 20 | **MailRead** | Read receipt audit log (separate from Mailbox.isRead) | `emailId`, `userEmail`, `readAt`, `via` (MAILBOX/NOTIFICATION) |
| 21 | **EmailLog** | Legacy email log (INVITATION/REMINDER/TASK_ASSIGNED) | `toEmail`, `toName`, `subject`, `body`, `type`, `sentAt` |

### 6. Configuration — 2 models

| # | Model | Mô tả | Fields quan trọng |
|---|---|---|---|
| 22 | **AgentConfig** | Customizable AI agent per project | `agentId`, `name`, `role`, `description`, `model`, `provider`, `temperature`, `maxContext`, `status`, `systemPrompt`, `skills` (JSON), `tokenUsed`, `taskCount`, `successRate` |
| 23 | **Template** | Project template (blueprint cho quick creation) | `name`, `description`, `category` (WEB/ECOMMERCE/MANAGEMENT/MOBILE/LMS/HOTEL/HOSPITAL/WAREHOUSE/BANKING/AI_SAAS/CHAT/MICROSERVICES/K8S/DASHBOARD/CUSTOM), `icon`, `color`, `topic`, `purpose`, `techPrefs`, `langPrefs`, `isBuiltIn` |

---

## 🔗 Key Relationships Diagram

```
                        ┌─────────────────┐
                        │     Project     │
                        │  (leaderToken)  │
                        └────────┬────────┘
                                 │
        ┌────────────┬───────────┼────────────┬────────────┬────────────┐
        │            │           │            │            │            │
        ▼            ▼           ▼            ▼            ▼            ▼
   ┌────────┐  ┌─────────┐  ┌────────┐  ┌────────┐  ┌──────────┐  ┌─────────┐
   │ Member │  │ Project │  │ Task   │  │ Analysis│ │ActivityLog│ │AgentConf│
   │        │  │ Context │  │        │  │(7 type)│  │ (25 type) │ │         │
   └───┬────┘  └─────────┘  └────┬───┘  └────────┘  └──────────┘  └─────────┘
       │                        │
       │  ┌─────────────────────┤
       │  │                     │
       ▼  ▼                     ▼
   ┌──────────┐            ┌─────────┐
   │ChatMsg   │            │TaskLog  │
   │EditPropos│            │ (audit) │
   └──────────┘            └─────────┘

   ┌────────────────────────────────────────────────────┐
   │                  Mail System                       │
   │                                                     │
   │  Project ──┬──> Email ──┬──> EmailAttachment       │
   │            │             ├──> Mailbox (per user)   │
   │            │             ├──> MailRead (receipt)   │
   │            └──> EmailLog (legacy)                  │
   └────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────┐
   │              Notifications                         │
   │                                                     │
   │  Project ──> Notification ──> NotificationRead     │
   │              (recipientEmail? =                    │
   │               null = broadcast)                    │
   └────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────┐
   │              Monitoring                            │
   │                                                     │
   │  Project ──> PipelineStatus (per run)              │
   │  Project ──> TaskStatistic (cached, unique)        │
   │  Project ──> TokenLog (per agent per run)          │
   │                                                     │
   │  AgentStatus (global, agentId unique)              │
   │  SystemStatus (global, subsystem unique)           │
   └────────────────────────────────────────────────────┘
```

### Quan hệ cascade

| Parent | Child | onDelete |
|---|---|---|
| `Project` | `Member`, `Analysis`, `Task`, `EmailLog`, `Email`, `ActivityLog`, `PipelineStatus`, `Notification`, `AgentConfig`, `ProjectContext`, `ChatMessage`, `EditProposal`, `TokenLog` | **Cascade** (xóa project → xóa hết children) |
| `Member` | `Task`, `ChatMessage`, `EditProposal` | **SetNull** (member rời project → task/message vẫn còn, `memberId = null`) |
| `Email` | `EmailAttachment`, `Mailbox`, `MailRead` | **Cascade** |
| `Notification` | `NotificationRead` | **Cascade** |

---

## 🗂️ Indexes (@@index)

Index được thiết kế cho các query pattern phổ biến (dashboard, filter, search):

| Model | Index fields | Use case |
|---|---|---|
| **TokenLog** | `[projectId]`, `[agentId]` | Filter cost theo project/agent |
| **Member** | `[projectId]`, `[inviteToken]` | Lookup member theo token (resolveAccess) |
| **Analysis** | `[projectId]`, `@@unique([projectId, type])` | 1 section type per project (versioned) |
| **EditProposal** | `[projectId]` | List proposals theo project |
| **ChatMessage** | `[projectId]` | Load chat history |
| **Task** | `[projectId]`, `[memberId]` | Filter task theo assignee |
| **EmailLog** | `[projectId]` | Mailbox legacy |
| **ActivityLog** | `[projectId]`, `[type]`, `[createdAt]`, `[actorEmail]` | Dashboard widget (recent activity), filter theo type/actor |
| **TaskLog** | `[taskId]`, `[projectId]`, `[createdAt]` | Audit trail per task |
| **AgentStatus** | `[status]`, `[projectId]` | Filter agents online/busy |
| **PipelineStatus** | `[projectId]`, `[status]` | Active pipelines |
| **Notification** | `[projectId]`, `[recipientEmail]`, `[type]`, `[createdAt]` | Bell icon (unread for user) |
| **NotificationRead** | `[readerEmail]`, `@@unique([notificationId, readerEmail])` | 1 read receipt per user per notif |
| **AgentConfig** | `[projectId]`, `[agentId]` | Get agent config per project |
| **Template** | `[category]` | Filter templates theo category |
| **Email** | `[projectId]`, `[fromEmail]`, `[parentEmailId]`, `[createdAt]` | Thread view, inbox |
| **EmailAttachment** | `[emailId]` | Get attachments of an email |
| **Mailbox** | `[userEmail]`, `[folder]`, `[emailId]`, `@@unique([emailId, userEmail])` | Inbox/sent/starred view per user |
| **MailRead** | `[userEmail]`, `@@unique([emailId, userEmail])` | Read receipt per user |

> 💡 **Unique constraints** (`@@unique`): đảm bảo 1 row per (parent, key) — ví dụ 1 project chỉ có 1 `ProjectContext`, 1 (notification, reader) chỉ có 1 `NotificationRead`.

---

## 🗑️ Cascade Delete Behavior

### Cascade (xóa parent → xóa hết children)

```prisma
model Project {
  members       Member[]       // onDelete: Cascade (mặc định)
  analyses      Analysis[]
  chatMessages  ChatMessage[]
  tasks         Task[]
  emails        Email[]
  // ... 10 quan hệ khác đều Cascade
}

model Email {
  attachments  EmailAttachment[]  // Cascade
  mailboxes    Mailbox[]          // Cascade
  readReceipts MailRead[]         // Cascade
}
```

**Use case:** Khi leader xóa project, **tự động** xóa toàn bộ: members, tasks, emails, attachments, mailbox states, notifications, activity logs, agent configs, chat messages, edit proposals, token logs, pipeline status, project context.

```ts
// An toàn — không cần xóa thủ công
await db.project.delete({ where: { id } });
// → Prisma tự xóa cascade
```

### SetNull (giữ child, set FK = null)

```prisma
model Task {
  member Member? @relation(fields: [memberId], references: [id], onDelete: SetNull)
}

model ChatMessage {
  member Member? @relation(fields: [memberId], references: [id], onDelete: SetNull)
}
```

**Use case:** Khi 1 member rời project (leader xóa member), task/chat của member đó **vẫn giữ lại** để audit — chỉ set `memberId = null`.

---

## 🛠️ Migration Commands

Định nghĩa trong [`package.json`](../package.json) → `scripts`:

| Command | Mục đích | Khi nào dùng |
|---|---|---|
| `bun run db:push` | Push schema → database (không tạo migration file) | **Dev** — khi sửa `schema.prisma` (thêm field/model), chạy lệnh này để cập nhật DB |
| `bun run db:generate` | Generate Prisma Client (`node_modules/.prisma/client`) | Sau khi pull code mới từ git, hoặc sau `db:push` |
| `bun run db:migrate` | Tạo migration file + apply (`prisma/migrations/`) | **Production** — khi cần audit trail của schema changes |
| `bun run db:reset` | Drop DB + re-create + run all migrations | ⚠️ **Mất data** — chỉ dùng trong dev khi schema corrupt |

### Workflow phát triển

```bash
# 1. Sửa prisma/schema.prisma (thêm field/model)
# 2. Push schema → DB
bun run db:push

# 3. Generate Prisma Client (cập nhật TypeScript types)
bun run db:generate

# 4. Restart dev server (để load Prisma Client mới)
bun run dev
```

### Workflow production (Docker / Fly.io)

```dockerfile
# Dockerfile (cuối cùng) — chạy db push trước khi start server
CMD ["sh", "-c", "bunx prisma db push --skip-generate && node server.js"]
```

```toml
# fly.toml — volume persistent cho SQLite
[[mounts]]
  source = "nexus_data"
  destination = "/data"
  initial_size = "1GB"

[env]
  DATABASE_URL = "file:/data/custom.db"
```

### Tạo file DB mới (dev)

```bash
# Nếu db/custom.db chưa tồn tại
bun run db:push  # → tự tạo file + schema
```

File DB sẽ được tạo tại `db/custom.db` (theo `DATABASE_URL=file:./db/custom.db` trong `.env`).

---

## ✅ Best Practices

### 1. Luôn dùng Prisma Client đã generate

```ts
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

> **Singleton pattern:** Tránh tạo nhiều PrismaClient instances trong dev (hot-reload) → connection leak.

### 2. JSON field — luôn parse trong try-catch

```ts
// ❌ Sai — crash nếu field rỗng hoặc không phải JSON
const tags = JSON.parse(project.tags);

// ✅ Đúng — defensive parsing
const parseArr = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const tags = parseArr(project.tags);
```

### 3. Transaction cho multi-write

```ts
import { db } from "@/lib/db";

// Tạo project + members atomic
await db.$transaction([
  db.project.create({ data: { ... } }),
  db.member.createMany({ data: members }),
]);
```

### 4. Select chỉ field cần thiết (performance)

```ts
// ❌ Lấy hết (heavy)
const project = await db.project.findUnique({ where: { id } });

// ✅ Chỉ lấy field cần dùng
const project = await db.project.findUnique({
  where: { id },
  select: { leaderEmail: true, leaderSmtpPassword: true },
});
```

### 5. Backup SQLite

```bash
# Backup (chỉ cần copy file)
cp db/custom.db db/backup-$(date +%Y%m%d).db

# Restore
cp db/backup-20250115.db db/custom.db
bun run db:generate
```

> 📌 File `db/custom.db` đã có trong `.gitignore` — không commit lên git. Backup thủ công bằng `cp`.

---

## 🔗 Liên kết

- [Schema source](../prisma/schema.prisma)
- [Prisma Client setup](../src/lib/db.ts)
- [API endpoints dùng DB](./API.md)
- [Architecture overview](./ARCHITECTURE.md)
