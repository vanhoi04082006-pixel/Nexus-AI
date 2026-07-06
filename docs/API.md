# 🔌 NEXUS AI — REST API Reference (v6.0)

> Toàn bộ **58 endpoints** (50+) của NEXUS AI. Base URL: `http://localhost:3000` (local) hoặc public URL (Cloudflare Tunnel / Fly.io / Docker).

## 📑 Mục lục

- [Authentication](#-authentication)
- [Projects](#-projects)
- [Pipeline (Initialize / Refine / Progress)](#-pipeline-initialize--refine--progress)
- [Tasks](#-tasks)
- [Notifications (Project-scoped)](#-notifications-project-scoped)
- [Notifications (Global)](#-notifications-global)
- [Mail (Mailbox + Attachments + AI Rewrite)](#-mail-mailbox--attachments--ai-rewrite)
- [Dashboard](#-dashboard)
- [Activity Logs](#-activity-logs)
- [Agents](#-agents)
- [GitHub](#-github)
- [Chat](#-chat)
- [Edit Proposals](#-edit-proposals)
- [Sections](#-sections)
- [Members](#-members)
- [Context (Long-term Memory)](#-context-long-term-memory)
- [Tokens (Usage Logs)](#-tokens-usage-logs)
- [Fix Mermaid](#-fix-mermaid)
- [Config & Templates](#-config--templates)
- [Health](#-health)
- [Error Responses](#-error-responses)
- [Mini-service HTTP endpoints (internal)](#-mini-service-http-endpoints-internal)

---

## 🔐 Authentication

Tất cả endpoints (trừ `/api`, `/api/config`, `/api/agents`, `/api/github/callback`) yêu cầu `token` query parameter:

```
GET /api/projects/abc123?token=cmr3xyz456
```

| Token type | Source | Permissions |
|---|---|---|
| `leaderToken` | `Project.leaderToken` (cuid) | Full access (edit, refine, push GitHub, delete, send mail, manage members) |
| `inviteToken` | `Member.inviteToken` (cuid) | View + chat + update own tasks + read mail + create edit proposals |

**Token truyền qua:**
- Query param: `?token=xxx`
- Chat service: `{ token }` trong `join` event (verify via HTTP call to API)
- Notification service: `{ token }` trong `join` event

**Response 403:**
```json
{ "error": "Access denied" }
```
hoặc
```json
{ "error": "Leader access required" }
```

**Leader-only actions** (returns 403 if `inviteToken`):
- PATCH section content
- POST `/initialize` (task generation)
- POST `/refine` (AI refine)
- POST `/mailbox` (compose + send mail)
- POST `/edit-proposals/:proposalId/approve` (approve/reject proposals)
- POST `/github/push`
- DELETE project
- Manage members

---

## 📦 Projects

### `GET /api/projects`

List tất cả projects (cho Home + All Projects views).

**Response 200:**
```json
{
  "projects": [
    {
      "id": "cmr3abc123",
      "topic": "Hệ thống quản lý nhân sự",
      "description": "Quản lý nhân sự công ty",
      "status": "WORKSPACE",
      "leaderName": "Bùi Văn Hội",
      "leaderEmail": "leader@gmail.com",
      "leaderToken": "cmr3xyz456",
      "purpose": "Đồ án tốt nghiệp",
      "isFavorite": false,
      "isArchived": false,
      "priority": "normal",
      "deadline": "2024-08-01T00:00:00.000Z",
      "techStack": ["Next.js", "React", "PostgreSQL"],
      "tags": ["web", "hrm"],
      "coverColor": "cyan",
      "memberCount": 3,
      "taskCount": 12,
      "doneTaskCount": 4,
      "totalTaskCount": 12,
      "progress": 33,
      "hasAnalysis": true,
      "members": [{ "id": "...", "name": "...", "email": "...", "role": "..." }],
      "createdAt": "2024-07-01T10:00:00.000Z",
      "updatedAt": "2024-07-01T10:05:00.000Z"
    }
  ]
}
```

---

### `POST /api/projects`

Tạo project mới + chạy 8-phase AI pipeline trong background (Phase 0 Planner → Phase 1-3 Agents → Phase 4 Retry → Phase 5 Fallback → Phase 5.5 Normalizer → Phase 6 Quality Reviewer).

**Request body:**
```json
{
  "topic": "Hệ thống quản lý nhân sự",
  "description": "Quản lý nhân sự cho công ty 100+ người",
  "purpose": "Đồ án tốt nghiệp",
  "extraInfo": {
    "requirements": ["Authentication", "Role-based access"],
    "specialReqs": "Multi-language support",
    "techPrefs": ["React", "Node.js"],
    "langPrefs": ["TypeScript"]
  },
  "leaderName": "Bùi Văn Hội",
  "leaderEmail": "leader@gmail.com",
  "leaderSmtpPassword": "xxxx xxxx xxxx xxxx",
  "priority": "high",
  "deadline": "2024-08-01",
  "tags": ["web", "hrm"],
  "coverColor": "cyan",
  "members": [
    {
      "name": "Nguyen Van A",
      "email": "a@example.com",
      "strengths": "Backend, Database",
      "weaknesses": "Weak CSS"
    }
  ]
}
```

**Validation:**
- `topic` — required, non-empty
- `members` — required, array, ≥1 member
- `leaderName` — required
- `leaderEmail` — required (for SMTP)
- `leaderSmtpPassword` — required (Gmail App Password)

**Response 200** (trả về ngay, pipeline chạy background):
```json
{
  "projectId": "cmr3abc123",
  "leaderToken": "cmr3xyz456"
}
```

> Sau khi nhận `projectId`, client polls `GET /api/projects/:id/progress` mỗi 2.5s. Khi `status === "done"`, redirect to workspace.

**Background flow:**
1. `initProgress(projectId)` — tạo progress tracker
2. `runPipeline(input, onProgress)` (wrapped trong `runWithProjectLog` cho AsyncLocalStorage)
3. Save 9 sections (Analysis rows, versioned)
4. Save `ProjectContext` (long-term memory)
5. Update `Project.status = "WORKSPACE"`
6. Send invitation emails (SMTP)
7. `logActivity: PROJECT_CREATED`
8. `finishProgress(projectId, ...)`

---

### `GET /api/projects/:id?token=xxx`

Get chi tiết project (workspace data) — members, tasks, sections, chat, etc.

**Response 200:**
```json
{
  "access": {
    "role": "leader",
    "name": "Bùi Văn Hội",
    "email": "leader@gmail.com"
  },
  "project": {
    "id": "cmr3abc123",
    "topic": "...",
    "description": "...",
    "status": "WORKSPACE",
    "leaderName": "...",
    "leaderEmail": "...",
    "purpose": "...",
    "extraInfo": { ... },
    "priority": "high",
    "deadline": "2024-08-01T00:00:00.000Z",
    "techStack": ["Next.js", "React"],
    "tags": ["web"],
    "coverColor": "cyan",
    "isFavorite": false,
    "isArchived": false,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "members": [{ "id": "...", "name": "...", "email": "...", "role": "...", "strengths": "...", "weaknesses": "..." }],
  "result": {
    "analysis": { ... },
    "hr": { ... },
    "sprint": { ... },
    "design": { ... },
    "uml": { ... },
    "docs": { ... },
    "git": { ... },
    "test": { ... },
    "security": { ... }
  },
  "tasks": [ ... ],
  "chat": [ ... ]
}
```

---

### `PATCH /api/projects/:id?token=xxx`

Update project metadata (leader only). Body chứa fields cần update.

**Request body (partial):**
```json
{
  "isFavorite": true,
  "isArchived": false,
  "priority": "high",
  "deadline": "2024-09-01",
  "tags": ["web", "hrm", "urgent"],
  "coverColor": "violet"
}
```

**Response 200:** Updated project object.

---

### `DELETE /api/projects/:id?token=xxx`

Delete project + cascade (members, analyses, tasks, chat, emails, notifications, etc.). Leader only.

**Response 200:**
```json
{ "success": true }
```

---

### `POST /api/projects/:id/duplicate?token=xxx`

Duplicate project (tạo bản sao với topic suffix " (Copy)"). Leader only.

**Request body (optional):**
```json
{
  "newTopic": "Hệ thống quản lý nhân sự v2",
  "copyTasks": true,
  "copyMembers": true
}
```

**Response 200:**
```json
{
  "projectId": "cmr3new456",
  "leaderToken": "cmr3newToken789"
}
```

---

## 🔄 Pipeline (Initialize / Refine / Progress)

### `GET /api/projects/:id/progress?token=xxx`

Poll pipeline progress (gọi mỗi 2.5s khi pipeline đang chạy).

**Response 200:**
```json
{
  "status": "running",
  "progress": 45,
  "currentPhase": "ANALYSIS",
  "agents": [
    { "id": "01", "name": "Requirement Analyst", "status": "done", "model": "openai/gpt-oss-120b:free" },
    { "id": "02", "name": "HR Planner", "status": "running" },
    { "id": "03", "name": "Sprint Planner", "status": "pending" },
    // ... 10 agents
  ],
  "logs": [
    {
      "id": "log_xxx",
      "level": "info",
      "agentId": "01",
      "provider": "pipeline",
      "model": "openai/gpt-oss-120b:free",
      "keyIndex": 1,
      "message": "✓ [AGENT-01] Requirement Analyst → done",
      "ts": "2024-07-01T10:00:05.000Z"
    },
    // ... up to 1000 logs
  ],
  "startedAt": "2024-07-01T10:00:00.000Z",
  "finishedAt": null,
  "result": null,
  "error": null
}
```

**Status values:**
- `"running"` — pipeline đang chạy
- `"done"` — hoàn thành, `result` có data
- `"failed"` — thất bại, `error` có message

---

### `POST /api/projects/:id/initialize?token=xxx`

Leader triggers AI sinh todolist chi tiết (Task Generator với dedup). Chạy background.

**Request body:**
```json
{
  "force": false
}
```

> Nếu `force: false` (default) và project đã có tasks → return 400 (đã có tasks). Dùng `force: true` để re-generate.

**Response 200** (trả về ngay):
```json
{
  "started": true,
  "message": "Task generation started. Poll /api/projects/:id/initialize/progress for status."
}
```

**Background flow:**
1. `reconstructInput` + `reconstructResult` từ DB
2. `initInitialize(projectId)`
3. `runWithInitLog(() => generateTasks(input, result, onProgress))`
4. `db.task.createMany` (with dedup by title+assignee)
5. `sendTaskAssignedEmail` cho mỗi member
6. `logActivity: TASK_GEN`
7. `refreshTaskStatistics`
8. `finishInitialize`

---

### `GET /api/projects/:id/initialize/progress?token=xxx`

Poll task generation progress.

**Response 200:**
```json
{
  "status": "running",
  "progress": 60,
  "logs": [ ... ],
  "tasksGenerated": 0,
  "startedAt": "...",
  "finishedAt": null
}
```

---

### `POST /api/projects/:id/refine?token=xxx`

Leader triggers AI Refine (re-generate 9 sections dựa trên edit requests + chat discussion). Chạy background.

**Request body:**
```json
{
  "editRequests": [
    { "section": "analysis", "change": "Thêm module Notification" },
    { "section": "design", "change": "Thay PostgreSQL bằng MySQL" }
  ],
  "chatDiscussion": "Team thảo luận muốn thêm tính năng export Excel"
}
```

**Response 200** (trả về ngay):
```json
{
  "started": true,
  "message": "AI Refine started. Poll /api/projects/:id/refine/progress for status."
}
```

**Background flow:**
1. `reconstructInput` + `reconstructResult`
2. `initRefine(projectId)`
3. `runWithRefineLog(() => refineSections(input, current, editRequests, chatDiscussion, onProgress))`
4. Save 9 sections (versioned — increment `Analysis.version`)
5. `logActivity: REFINE`
6. `finishRefine`

---

### `GET /api/projects/:id/refine/progress?token=xxx`

Poll AI Refine progress.

**Response 200:**
```json
{
  "status": "running",
  "progress": 33,
  "currentSection": "design",
  "sectionsCompleted": ["analysis", "hr", "sprint"],
  "sectionsTotal": 9,
  "logs": [ ... ]
}
```

---

## ✅ Tasks

### `GET /api/projects/:id/tasks?token=xxx`

List tất cả tasks (cho Kanban board).

**Response 200:**
```json
{
  "tasks": [
    {
      "id": "task_xxx",
      "assigneeName": "Nguyen Van A",
      "memberId": "mem_xxx",
      "memberName": "Nguyen Van A",
      "title": "Thiết kế database schema",
      "description": "...",
      "role": "Backend Developer",
      "responsibilities": ["..."],
      "codeConventions": ["..."],
      "dependencies": "Setup project xong",
      "acceptanceCriteria": ["Code chạy", "Pass tests"],
      "deadline": "2024-08-15",
      "sprintName": "Sprint 1",
      "status": "todo",
      "hours": 8,
      "priority": "P0",
      "layer": "DATABASE",
      "targetFile": "prisma/schema.prisma",
      "implementationSteps": ["1. Prisma models", "2. Relations", "3. Migrate"],
      "technicalHints": {
        "snippet": "model User { id String @id @default(cuid()) }",
        "note": "cuid()"
      },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

**Status values:** `todo` | `in_progress` | `review` | `done`
**Layer values:** `DATABASE` | `BACKEND` | `UI` | `CONFIG` | `TESTING`
**Priority values:** `P0` | `P1` | `P2`

---

### `PATCH /api/projects/:id/tasks/:taskId?token=xxx`

Update task (status, assignee, deadline, etc.). Dùng cho Kanban drag-drop.

**Request body (partial):**
```json
{
  "status": "in_progress",
  "assigneeName": "Nguyen Van B",
  "deadline": "2024-08-20",
  "priority": "P0"
}
```

**Response 200:** Updated task object.

**Side effects:**
- `logActivity: TASK_STATUS_CHANGED` (if status changed)
- `logActivity: TASK_COMPLETED` (if status → "done")
- `refreshTaskStatistics` (cập nhật TaskStatistic cache)
- Broadcast `task:update` qua notification-service (port 3002)
- Create notification `TASK_ASSIGNED` if assigneeName changed
- Create notification `TASK_COMPLETED` if status → "done"

---

## 🔔 Notifications (Project-scoped)

### `GET /api/projects/:id/notifications?token=xxx`

List notifications cho user hiện tại trong project.

**Query params:**
- `folder` (optional) — `unread` | `all` (default: `all`)
- `limit` (optional) — default 50, max 100
- `offset` (optional) — for pagination

**Response 200:**
```json
{
  "notifications": [
    {
      "id": "notif_xxx",
      "type": "TASK_ASSIGNED",
      "title": "Task assigned",
      "message": "Bạn được gán task: Thiết kế database",
      "senderName": "Bùi Văn Hội",
      "senderRole": "Leader",
      "recipientEmail": "a@example.com",
      "priority": "normal",
      "relatedTaskId": "task_xxx",
      "relatedMailId": null,
      "actionUrl": "/?p=cmr3abc&tab=tasks",
      "actionLabel": "Mở task",
      "isRead": false,
      "readAt": null,
      "createdAt": "..."
    }
  ],
  "unreadCount": 3,
  "totalCount": 25
}
```

---

### `POST /api/projects/:id/notifications?token=xxx`

Create notification (leader only, or system).

**Request body:**
```json
{
  "type": "DEADLINE_SOON",
  "title": "Deadline sắp tới",
  "message": "Task 'Thiết kế database' đến deadline trong 2 ngày",
  "recipientEmail": "a@example.com",
  "priority": "high",
  "relatedTaskId": "task_xxx",
  "actionUrl": "/?p=cmr3abc&tab=tasks",
  "actionLabel": "Mở task"
}
```

> `recipientEmail = null` → broadcast (tất cả members). `recipientEmail = "x@y.com"` → targeted.

**Response 200:** Created notification object.

**Side effects:**
- `notification-service` broadcast `notification:new` qua WebSocket (port 3002)
- Nếu recipientEmail !== null → chỉ user đó nhận

---

### `PATCH /api/projects/:id/notifications/:notifId?token=xxx`

Mark notification as read/unread.

**Request body:**
```json
{
  "isRead": true
}
```

**Response 200:** Updated notification object.

> Tạo/update `NotificationRead` row (1 row per reader).

---

### `DELETE /api/projects/:id/notifications/:notifId?token=xxx`

Delete notification (leader only, hoặc notification của mình).

**Response 200:**
```json
{ "success": true }
```

---

## 🔔 Notifications (Global)

### `GET /api/notifications?token=xxx&email=user@example.com`

List tất cả notifications cho user (cross-project). Query `email` để filter.

**Response 200:**
```json
{
  "notifications": [ ... ],
  "unreadCount": 5
}
```

---

### `POST /api/notifications`

Create global notification (system-level, không cần project).

**Request body:**
```json
{
  "type": "SYSTEM",
  "title": "...",
  "message": "...",
  "recipientEmail": "..."
}
```

---

### `PATCH /api/notifications/:id?token=xxx`

Mark as read/unread.

---

### `DELETE /api/notifications/:id?token=xxx`

Delete notification.

---

## 📬 Mail (Mailbox + Attachments + AI Rewrite)

### `GET /api/projects/:id/mailbox?token=xxx`

List mails cho user hiện tại.

**Query params:**
- `folder` — `INBOX` | `SENT` | `DRAFT` | `STARRED` | `ARCHIVE` | `SPAM` | `TRASH` (default: `INBOX`)
- `q` — search query (subject + body)
- `page` — default 1
- `limit` — default 20, max 100

**Response 200:**
```json
{
  "mails": [
    {
      "id": "mail_xxx",
      "fromEmail": "leader@gmail.com",
      "fromName": "Bùi Văn Hội",
      "toEmails": ["a@example.com", "b@example.com"],
      "ccEmails": [],
      "bccEmails": [],
      "subject": "Lời mời tham gia dự án",
      "bodyHtml": "<p>...</p>",
      "bodyText": "...",
      "parentEmailId": null,
      "attachments": [
        { "id": "att_xxx", "filename": "spec.pdf", "sizeBytes": 123456, "mimeType": "application/pdf" }
      ],
      "folder": "INBOX",
      "isRead": false,
      "isStarred": false,
      "isArchived": false,
      "isTrashed": false,
      "sentAt": "2024-07-01T10:00:00.000Z",
      "createdAt": "..."
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "unreadByFolder": { "INBOX": 3, "SPAM": 0 }
}
```

---

### `POST /api/projects/:id/mailbox?token=xxx`

Compose + send mail (leader only). SMTP send qua leader credentials + DB persistence.

**Request body:**
```json
{
  "toEmails": ["a@example.com"],
  "ccEmails": ["b@example.com"],
  "bccEmails": [],
  "subject": "Task assignment",
  "bodyHtml": "<p>Hi A, please work on...</p>",
  "bodyText": "Hi A, please work on...",
  "asDraft": false,
  "parentEmailId": null
}
```

**Response 200:**
```json
{
  "mailId": "mail_xxx",
  "sent": true,
  "message": "Mail sent successfully via SMTP"
}
```

> Nếu `asDraft: true` → save as draft (folder = DRAFT, không SMTP send).

**Side effects:**
- SMTP send qua `nodemailer` (leader credentials)
- Create `Email` + `Mailbox` rows (1 Mailbox per recipient)
- For each recipient: create notification `MAIL_RECEIVED`
- Broadcast `notification:new` qua notification-service
- `logActivity: MAIL_SENT`

---

### `GET /api/projects/:id/mailbox/:mailId?token=xxx`

Get chi tiết 1 mail (including attachments).

**Response 200:**
```json
{
  "mail": { ... }
}
```

---

### `PATCH /api/projects/:id/mailbox/:mailId?token=xxx`

Update mail state (move folder, mark read/star/archived/trashed).

**Request body (partial):**
```json
{
  "folder": "STARRED",
  "isRead": true,
  "isStarred": true,
  "isArchived": false,
  "isTrashed": false
}
```

**Response 200:** Updated mail object.

---

### `DELETE /api/projects/:id/mailbox/:mailId?token=xxx`

Delete mail (move to TRASH if not in TRASH, permanently delete if in TRASH).

**Response 200:**
```json
{ "success": true, "permanent": false }
```

---

### `POST /api/projects/:id/mailbox/attachments?token=xxx`

Upload attachment (max 5MB per file). Multipart form-data.

**Request:**
```
POST /api/projects/:id/mailbox/attachments?token=xxx
Content-Type: multipart/form-data

mailId: mail_xxx
file: <binary>
```

**Response 200:**
```json
{
  "attachmentId": "att_xxx",
  "filename": "spec.pdf",
  "sizeBytes": 123456,
  "mimeType": "application/pdf"
}
```

---

### `GET /api/projects/:id/mailbox/attachments/:attId?token=xxx`

Download attachment (returns binary stream).

**Response 200:** `Content-Type: application/pdf` (or appropriate), binary body.

---

### `DELETE /api/projects/:id/mailbox/attachments/:attId?token=xxx`

Delete attachment.

**Response 200:**
```json
{ "success": true }
```

---

### `POST /api/projects/:id/mailbox/ai-rewrite?token=xxx`

AI Rewrite mail body (5 modes). Leader only.

**Request body:**
```json
{
  "text": "Hi team, please check this task...",
  "mode": "professional"
}
```

**Mode values:** `improve` | `professional` | `friendly` | `concise` | `expand`

**Response 200:**
```json
{
  "rewritten": "Dear Team,\n\nI would appreciate it if you could review..."
}
```

---

## 📊 Dashboard

### `GET /api/dashboard/activity?token=xxx&email=user@example.com&limit=20`

Recent activity feed (cross-project, cho Home widget).

**Response 200:**
```json
{
  "activity": [
    {
      "id": "act_xxx",
      "projectId": "cmr3abc",
      "projectTopic": "Hệ thống quản lý nhân sự",
      "type": "TASK_COMPLETED",
      "status": "SUCCESS",
      "title": "Task completed",
      "details": "Nguyen Van A completed 'Thiết kế database'",
      "actorName": "Nguyen Van A",
      "actorEmail": "a@example.com",
      "actorRole": "Member",
      "actorAvatar": "",
      "relatedTaskId": "task_xxx",
      "relatedTaskTitle": "Thiết kế database",
      "relatedMailId": null,
      "actionUrl": "/?p=cmr3abc&tab=tasks",
      "actionLabel": "Mở task",
      "icon": "Activity",
      "createdAt": "..."
    }
  ]
}
```

---

### `GET /api/dashboard/status?token=xxx`

NEXUS AI system status (cho Home widget).

**Response 200:**
```json
{
  "agents": [
    { "id": "01", "name": "Requirement Analyst", "status": "idle", "model": "..." },
    // ... 10 agents
  ],
  "pipeline": {
    "running": 1,
    "completed24h": 5,
    "failed24h": 0
  },
  "system": {
    "database": "ok",
    "storage": "ok",
    "openRouterKeys": 5,
    "rateLimitedKeys": 1
  },
  "aiCacheSize": 234
}
```

---

### `GET /api/dashboard/tasks?token=xxx&email=user@example.com`

Tasks đang làm (cho Home widget).

**Response 200:**
```json
{
  "inProgress": [ { "id": "...", "title": "...", "projectId": "...", "deadline": "..." } ],
  "overdue": [ ... ],
  "dueSoon": [ ... ]
}
```

---

### `GET /api/dashboard/statistics?token=xxx`

Aggregate statistics (cho All Projects dashboard).

**Response 200:**
```json
{
  "totalProjects": 12,
  "activeProjects": 8,
  "archivedProjects": 2,
  "favoriteProjects": 3,
  "totalTasks": 156,
  "doneTasks": 78,
  "inProgressTasks": 22,
  "overdueTasks": 4,
  "totalMembers": 25,
  "totalEmails": 89,
  "pipelineRuns": 18
}
```

---

## 📋 Activity Logs

### `GET /api/projects/:id/history?token=xxx`

Project activity history (cho History tab).

**Query params:**
- `type` (optional) — filter by event type
- `limit` — default 100, max 500
- `offset` — for pagination

**Response 200:**
```json
{
  "history": [
    {
      "id": "act_xxx",
      "type": "SECTION_EDIT",
      "status": "SUCCESS",
      "title": "Edited analysis section",
      "details": "...",
      "actorName": "...",
      "actorEmail": "...",
      "actorRole": "Leader",
      "relatedTaskId": null,
      "actionUrl": "/?p=cmr3abc&tab=analysis",
      "icon": "Edit",
      "createdAt": "..."
    }
  ],
  "total": 234
}
```

---

### `GET /api/activity/logs?token=xxx&email=user@example.com&limit=50`

Global activity logs (cross-project, cho admin/debug).

**Query params:**
- `email` — filter by actor email
- `type` — filter by event type
- `projectId` — filter by project
- `startDate` / `endDate` — date range filter
- `limit` — default 50, max 500

**Response 200:**
```json
{
  "logs": [ ... ],
  "total": 1234
}
```

---

## 🤖 Agents

### `GET /api/agents`

List 10 AI agents info (public — no token required).

**Response 200:**
```json
{
  "agents": [
    {
      "id": "01",
      "name": "Requirement Analyst",
      "role": "Requirement Analyst",
      "section": "analysis",
      "description": "Phân tích chủ đề → tech stack, features, actors, modules",
      "models": ["nvidia/nemotron-3-ultra-550b-a55b:free", "qwen/qwen3-next-80b-a3b-instruct:free", ...],
      "modelCount": 9,
      "temperature": 0.20,
      "required": true,
      "skills": ["Requirement Analysis", "Tech Stack Selection", "Feature Decomcomposition"],
      "icon": "Search",
      "color": "cyan"
    },
    // ... 10 agents
  ]
}
```

---

## 🐙 GitHub

### `GET /api/github/auth?projectId=xxx`

Redirect to GitHub OAuth authorize URL.

**Query params:**
- `projectId` — project để bind OAuth token

**Response 302:** Redirect to `https://github.com/login/oauth/authorize?client_id=...&scope=repo&state=...`

---

### `GET /api/github/callback?code=xxx&state=xxx`

OAuth callback — exchange code for access_token, store in `Project.githubToken`.

**Response 302:** Redirect to `/?p=${projectId}&tab=git&github=connected`

---

### `GET /api/github/status?token=xxx&projectId=xxx`

Check GitHub OAuth status.

**Response 200:**
```json
{
  "connected": true,
  "username": "vanhoi04082006-pixel",
  "repoName": null
}
```

---

### `POST /api/github/push?token=xxx`

Push project to GitHub repo (leader only).

**Request body:**
```json
{
  "projectId": "cmr3abc",
  "repoName": "nexus-ai-hrm",
  "branchName": "nexus-ai-init",
  "isPrivate": true
}
```

**Response 200:**
```json
{
  "success": true,
  "repoUrl": "https://github.com/vanhoi04082006-pixel/nexus-ai-hrm",
  "prUrl": "https://github.com/vanhoi04082006-pixel/nexus-ai-hrm/pull/1",
  "filesPushed": 17
}
```

**Files pushed:**
- `README.md`
- `docs/TEST_PLAN.md`, `docs/SECURITY.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/CONTRIBUTING.md`
- `uml/use-case.mmd`, `uml/class.mmd`, `uml/erd.mmd`, `uml/sequence.mmd`
- `.github/ISSUE_TEMPLATE/bug.md`, `.github/ISSUE_TEMPLATE/feature.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/ci.yml`
- `.gitignore`, `LICENSE`

---

## 💬 Chat

### `GET /api/projects/:id/chat?token=xxx&limit=50`

List chat messages.

**Response 200:**
```json
{
  "messages": [
    {
      "id": "msg_xxx",
      "senderName": "Nguyen Van A",
      "senderEmail": "a@example.com",
      "senderRole": "Member",
      "message": "Team ơi, ai làm phần auth?",
      "createdAt": "..."
    }
  ]
}
```

---

### `POST /api/projects/:id/chat?token=xxx`

Post chat message (cũng broadcast qua chat-service WebSocket port 3001).

**Request body:**
```json
{
  "message": "Mình sẽ làm phần auth nhé",
  "senderName": "Nguyen Van B"
}
```

**Response 200:**
```json
{
  "id": "msg_xxx",
  "createdAt": "..."
}
```

---

### `POST /api/projects/:id/chat/ai?token=xxx`

Trigger AI assistant reply (leader or member).

**Request body:**
```json
{
  "recentMessages": "Nguyen Van A: Team ơi...\nNguyen Van B: Mình sẽ làm..."
}
```

**Response 200:**
```json
{
  "reply": "Tốt! Nguyen Van B sẽ làm auth. Nguyen Van A có thể làm phần UI login.",
  "model": "openai/gpt-oss-120b:free"
}
```

---

## 📝 Edit Proposals

### `GET /api/projects/:id/edit-proposals?token=xxx`

List edit proposals (leader thấy all, member thấy của mình).

**Response 200:**
```json
{
  "proposals": [
    {
      "id": "prop_xxx",
      "section": "analysis",
      "proposedBy": "Nguyen Van A",
      "proposedByEmail": "a@example.com",
      "changeDescription": "Thêm module Notification",
      "proposedContent": { ... },
      "status": "pending",
      "reviewedAt": null,
      "reviewerName": null,
      "createdAt": "..."
    }
  ]
}
```

**Status values:** `pending` | `approved` | `rejected`

---

### `POST /api/projects/:id/edit-proposals?token=xxx`

Member creates edit proposal.

**Request body:**
```json
{
  "section": "analysis",
  "changeDescription": "Thêm module Notification",
  "proposedContent": { ... }
}
```

**Response 200:** Created proposal object.

---

### `PATCH /api/projects/:id/edit-proposals/:proposalId?token=xxx`

Leader approve/reject proposal. Nếu approve → apply proposedContent to section + increment version.

**Request body:**
```json
{
  "status": "approved",
  "reviewComment": "Đồng ý, thêm module"
}
```

**Response 200:** Updated proposal object.

**Side effects (if approved):**
- `db.analysis.update` — apply proposedContent, increment version
- `logActivity: PROPOSAL_APPROVED` + `SECTION_EDIT`
- Create notification `REQUIREMENT_EDITED` cho proposal author
- Broadcast `section:saved` event

---

### `DELETE /api/projects/:id/edit-proposals/:proposalId?token=xxx`

Delete proposal (author or leader).

---

## 📝 Sections

### `PATCH /api/projects/:id/section?token=xxx`

Leader trực tiếp edit section content (không qua proposal).

**Request body:**
```json
{
  "section": "analysis",
  "content": { ... },
  "changeDescription": "Sửa trực tiếp"
}
```

**Response 200:**
```json
{
  "success": true,
  "version": 3,
  "section": "analysis"
}
```

**Side effects:**
- `db.analysis.update` — apply content, increment version
- `saveVersion(projectId, section, content, "leader", leaderName)` — Version Manager
- `logActivity: SECTION_EDIT`
- Broadcast `section:saved` event

---

## 👥 Members

### `GET /api/projects/:id/members?token=xxx`

List project members.

**Response 200:**
```json
{
  "members": [
    {
      "id": "mem_xxx",
      "name": "Nguyen Van A",
      "email": "a@example.com",
      "role": "Backend Developer",
      "strengths": "Backend, Database",
      "weaknesses": "Weak CSS",
      "inviteToken": "cmr3xyz",
      "joinedAt": "...",
      "taskCount": 4,
      "doneTaskCount": 1
    }
  ]
}
```

---

### `POST /api/projects/:id/members?token=xxx`

Leader add new member.

**Request body:**
```json
{
  "name": "Nguyen Van C",
  "email": "c@example.com",
  "strengths": "Frontend, UI/UX",
  "weaknesses": "Weak backend"
}
```

**Response 200:** Created member object (with `inviteToken`).

**Side effects:**
- Send invitation email (SMTP)
- `logActivity: MEMBER_JOINED`

---

## 🧠 Context (Long-term Memory)

### `GET /api/projects/:id/context?token=xxx`

Get long-term memory (`ProjectContext`).

**Response 200:**
```json
{
  "summary": {
    "topic": "Hệ thống quản lý nhân sự",
    "modules": ["Auth", "User", "Employee", ...],
    "techStack": { "fe": "Next.js", "be": "Node.js", "db": "PostgreSQL" },
    "actors": ["HR Manager", "Employee"],
    "features": ["Login", "User Management", ...],
    "members": [...],
    "assignments": [...],
    "sprints": [...]
  },
  "runCount": 3,
  "lastRunAt": "..."
}
```

---

### `POST /api/projects/:id/context?token=xxx`

Update long-term memory (leader only). Thường tự động sau pipeline/refine.

**Request body:**
```json
{
  "summary": { ... },
  "fullResults": { ... }
}
```

---

## 🪙 Tokens (Usage Logs)

### `GET /api/projects/:id/tokens?token=xxx`

Token usage per agent per project.

**Response 200:**
```json
{
  "tokens": [
    {
      "agentId": "01",
      "agentName": "Requirement Analyst",
      "model": "openai/gpt-oss-120b:free",
      "promptTokens": 1234,
      "completionTokens": 567,
      "totalTokens": 1801,
      "keyIndex": 1,
      "createdAt": "..."
    }
  ],
  "totalTokensUsed": 15678,
  "totalCost": 0
}
```

---

## 🔧 Fix Mermaid

### `POST /api/projects/:id/fix-mermaid?token=xxx`

AI fix Mermaid syntax (tier 3 trong 3-tier fix).

**Request body:**
```json
{
  "code": "classDiagram\n  class User { ... }",
  "diagramType": "classDiagram"
}
```

**Response 200:**
```json
{
  "fixed": "classDiagram\n  class User {\n    +String id\n    +String name\n  }",
  "model": "openai/gpt-oss-120b:free"
}
```

---

## ⚙️ Config & Templates

### `GET /api/config`

Get public URL config (no token required).

**Response 200:**
```json
{
  "publicUrl": "https://xxx.trycloudflare.com",
  "appUrl": "http://localhost:3000",
  "chatServiceRunning": true,
  "notificationServiceRunning": true
}
```

---

### `GET /api/templates`

List project templates.

**Response 200:**
```json
{
  "templates": [
    {
      "id": "tpl_xxx",
      "name": "Web App Template",
      "description": "Standard Next.js + Prisma + Tailwind",
      "defaultMembers": 4,
      "defaultTechStack": ["Next.js", "PostgreSQL"],
      "icon": "Globe"
    }
  ]
}
```

---

## 🏥 Health

### `GET /api`

Health check (no token required).

**Response 200:**
```json
{
  "status": "ok",
  "version": "6.0.0",
  "uptime": 12345,
  "timestamp": "2024-07-01T10:00:00.000Z"
}
```

---

## ❌ Error Responses

Tất cả endpoints trả error theo format thống nhất:

### 400 — Bad Request

```json
{
  "error": "Topic is required",
  "details": "optional context"
}
```

### 401 — Unauthorized (no token)

```json
{
  "error": "Token required"
}
```

### 403 — Forbidden (invalid token hoặc không phải leader)

```json
{ "error": "Access denied" }
```
hoặc
```json
{ "error": "Leader access required" }
```

### 404 — Not Found

```json
{ "error": "Project not found" }
```

### 429 — Rate Limited (rare, chỉ khi API chính bị limit)

```json
{
  "error": "Rate limited",
  "retryAfter": 60
}
```

### 500 — Internal Server Error

```json
{
  "error": "Failed to fetch projects",
  "details": "PrismaClientInitializationError: ..."
}
```

---

## 🔌 Mini-service HTTP endpoints (internal)

NEXUS AI có 2 mini-service Socket.io (chat port 3001 + notification port 3002). Ngoài WebSocket, notification-service cũng có HTTP endpoints cho API route broadcast:

### `POST http://localhost:3002/broadcast-notification` (internal)

API route gọi để broadcast notification qua WebSocket.

**Request body:**
```json
{
  "notification": { ... },
  "recipientEmail": "a@example.com"
}
```

> `recipientEmail = null` → broadcast to all connected clients. `recipientEmail = "x@y.com"` → chỉ gửi đến user đó.

---

### `POST http://localhost:3002/broadcast-activity` (internal)

API route gọi để broadcast activity log qua WebSocket (cho Dashboard widget "Recent Activity" realtime).

**Request body:**
```json
{
  "activity": { ... }
}
```

---

### `POST http://localhost:3002/broadcast-status` (internal)

API route gọi để broadcast system status update.

**Request body:**
```json
{
  "agentId": "01",
  "status": "running",
  "model": "openai/gpt-oss-120b:free"
}
```

---

### `GET http://localhost:3001` (chat-service health)

**Response 200:**
```json
{ "code": 0, "message": "Cannot GET /" }
```

> Đây là response mặc định của Socket.io HTTP server — không phải error.

---

## 📊 Endpoint Summary

| Group | Endpoints | Methods |
|---|---|---|
| **Projects** | 6 | GET, POST, GET/:id, PATCH/:id, DELETE/:id, POST/:id/duplicate |
| **Pipeline** | 6 | GET progress, POST initialize, GET init/progress, POST refine, GET refine/progress |
| **Tasks** | 2 | GET, PATCH/:taskId |
| **Notifications (project)** | 4 | GET, POST, PATCH/:notifId, DELETE/:notifId |
| **Notifications (global)** | 4 | GET, POST, PATCH/:id, DELETE/:id |
| **Mail** | 8 | GET mailbox, POST mailbox, GET mailbox/:mailId, PATCH, DELETE, POST attachments, GET attachments/:attId, DELETE attachments/:attId, POST ai-rewrite |
| **Dashboard** | 4 | GET activity, GET status, GET tasks, GET statistics |
| **Activity** | 2 | GET /:id/history, GET /activity/logs |
| **Agents** | 1 | GET |
| **GitHub** | 4 | GET auth, GET callback, GET status, POST push |
| **Chat** | 3 | GET, POST, POST /ai |
| **Edit Proposals** | 4 | GET, POST, PATCH/:proposalId, DELETE/:proposalId |
| **Sections** | 1 | PATCH |
| **Members** | 2 | GET, POST |
| **Context** | 2 | GET, POST |
| **Tokens** | 1 | GET |
| **Fix Mermaid** | 1 | POST |
| **Config** | 1 | GET |
| **Templates** | 1 | GET |
| **Health** | 1 | GET /api |
| **Total** | **58** | |

---

## 🔗 See also

- [Architecture](ARCHITECTURE.md) — system design, 24-module AI structure, 36 enterprise features
- [Contributing](CONTRIBUTING.md) — how to add new API routes + log via AsyncLocalStorage
- [README](../README.md) — overview, quick start

---

[← Về docs/README](README.md) · [← Về README](../README.md)
