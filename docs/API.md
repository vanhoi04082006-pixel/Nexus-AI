# 🔌 NEXUS AI — REST API Reference

> Toàn bộ 50+ API endpoints. Base URL: `http://localhost:3000` (local) hoặc public URL (Cloudflare Tunnel / Fly.io).

## 📑 Mục lục

- [Authentication](#-authentication)
- [Projects](#-projects)
- [Pipeline (Initialize / Refine / Progress)](#-pipeline-initialize--refine--progress)
- [Tasks](#-tasks)
- [Notifications](#-notifications)
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
- [Error Responses](#-error-responses)

---

## 🔐 Authentication

Tất cả endpoints (trừ `/api/config`, `/api/agents`, `/api/github/callback`) yêu cầu `token` query parameter:

```
GET /api/projects/abc123?token=cmr3xyz456
```

| Token type | Source | Permissions |
|---|---|---|
| `leaderToken` | `Project.leaderToken` (cuid) | Full access (edit, refine, push GitHub, delete, send mail) |
| `inviteToken` | `Member.inviteToken` (cuid) | View + chat + update own tasks + read mail |

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
      "createdAt": "2024-07-01T10:00:00.000Z",
      "updatedAt": "2024-07-01T10:05:00.000Z",
      "_count": { "members": 3, "tasks": 12, "analyses": 9 },
      "members": [{ "id": "...", "name": "...", "email": "...", "role": "..." }]
    }
  ]
}
```

---

### `POST /api/projects`

Tạo project mới + chạy 10-agent pipeline trong background.

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

**Response 200** (trả về ngay, pipeline chạy background):
```json
{
  "projectId": "cmr3abc123",
  "leaderToken": "cmr3xyz456"
}
```

> Sau khi nhận `projectId`, client polls `GET /api/projects/:id/progress` mỗi 2.5s.

---

### `GET /api/projects/:id?token=xxx`

Get chi tiết project (workspace data).

**Response 200:**
```json
{
  "access": {
    "role": "leader",
    "name": "Bùi Văn Hội",
    "email": "leader@gmail.com",
    "memberId": null
  },
  "project": {
    "id": "cmr3abc123",
    "topic": "Hệ thống quản lý nhân sự",
    "description": "...",
    "status": "WORKSPACE",
    "leaderName": "Bùi Văn Hội",
    "leaderEmail": "leader@gmail.com",
    "purpose": "...",
    "priority": "high",
    "deadline": "...",
    "techStack": ["Next.js", "React"],
    "tags": ["web", "hrm"],
    "coverColor": "cyan",
    "isFavorite": false,
    "isArchived": false,
    "githubConnected": true,
    "githubUsername": "vanhoi04082006",
    "githubRepoName": "nexus-hrm",
    "githubPushedAt": "2024-07-01T10:10:00.000Z"
  },
  "result": {
    "analysis": { "desc": "...", "techStack": {...}, "features": [...], ... },
    "hr": { "assignments": [...], "coverage": "95%", "risks": [...] },
    "sprint": { "totalSprints": 3, "sprints": [...], "milestones": [...] },
    "design": { "dbTables": [...], "apiEndpoints": [...], "folderStructure": "..." },
    "uml": { "useCase": "...", "classDiagram": "...", "erd": "...", "sequence": "..." },
    "docs": { "readme": "...", "convention": "...", "apiStandard": "..." },
    "git": { "gitCommands": "...", "branchStrategy": "...", "issueTemplate": "..." },
    "test": { "testStrategy": "...", "unitTests": [...], ... },
    "security": { "threats": [...], "authFlow": "...", "owaspTop10": [...] }
  },
  "members": [...],
  "tasks": [...],
  "chatMessages": [...],
  "editProposals": [...]
}
```

**Response 403:** Access denied
**Response 404:** Project not found

---

### `PATCH /api/projects/:id?token=xxx`

Leader update project metadata (topic, description, priority, deadline, tags, coverColor, isFavorite, isArchived).

**Request body (partial):**
```json
{
  "priority": "urgent",
  "deadline": "2024-07-15",
  "tags": ["web", "hrm", "urgent"],
  "isFavorite": true
}
```

**Response 200:** `{ "project": { ...updated } }`

---

### `DELETE /api/projects/:id?token=xxx`

Xóa project (leader only). Cascade: members, analyses, tasks, chat, proposals, emails, context, token logs, notifications.

**Response 200:** `{ "success": true }`

---

### `POST /api/projects/:id/duplicate?token=xxx`

Tạo bản sao project (topic, description, purpose, techStack, tags, members) — không copy analyses/tasks/emails. Project mới có `leaderToken` mới + status `DRAFT`.

**Response 200:**
```json
{
  "projectId": "cmr3new456",
  "leaderToken": "cmr3token789"
}
```

---

## 🚀 Pipeline (Initialize / Refine / Progress)

### `GET /api/projects/:id/progress?token=xxx`

Poll pipeline progress (tạo project mới).

**Response 200:**
```json
{
  "projectId": "cmr3abc123",
  "status": "running",
  "agents": [
    { "id": "01", "name": "Requirement Analyst", "status": "done" },
    { "id": "02", "name": "HR Planner", "status": "running" },
    { "id": "03", "name": "Sprint Planner", "status": "pending" },
    ...
    { "id": "10", "name": "Quality Reviewer", "status": "pending" }
  ],
  "logs": [
    {
      "id": "log-123",
      "ts": 1719800000000,
      "level": "info",
      "agentId": "01",
      "provider": "pipeline",
      "message": "[AGENT-01] Requirement Analyst → start (parallel)"
    },
    {
      "id": "log-124",
      "ts": 1719800001000,
      "level": "info",
      "provider": "openrouter",
      "model": "openai/gpt-oss-120b:free",
      "keyIndex": 1,
      "message": "[OpenRouter] Key #1, model: openai/gpt-oss-120b:free"
    }
  ],
  "startedAt": 1719800000000
}
```

**Status values:** `running` | `done` | `error`
**Response 404:** Progress expire sau 5 phút → client check project status.

---

### `POST /api/projects/:id/initialize?token=xxx`

Sinh todolist (Kanban) qua AI với dedup + comprehensiveness check. Leader only. Xóa task cũ (clean slate).

**Request body:** `{}` (empty)

**Response 200:** `{ "started": true }`

> Client polls `GET /api/projects/:id/initialize/progress` mỗi 2.5s.

---

### `GET /api/projects/:id/initialize/progress?token=xxx`

Poll init progress + logs.

**Response 200:**
```json
{
  "projectId": "cmr3abc123",
  "status": "running",
  "message": "Đang sinh todolist...",
  "logs": [
    {
      "id": "log-1",
      "ts": 1719800000000,
      "level": "info",
      "agentId": "TASK",
      "provider": "pipeline",
      "message": "▶ INIT STARTED — project: \"...\" — 3 member(s)"
    }
  ],
  "startedAt": 1719800000000
}
```

**Status values:** `running` | `done` (có `taskCount`) | `error`

---

### `POST /api/projects/:id/refine?token=xxx`

AI Refine — sinh lại tất cả 9 sections dựa trên chat + edit requests. Leader only.

**Request body:**
```json
{
  "editRequests": [
    { "section": "analysis", "change": "Thêm feature export Excel" },
    { "section": "hr", "change": "Đổi vai trò Nguyen Van A sang Backend" }
  ],
  "chatDiscussion": "Leader: Mình muốn thêm tính năng export...\nMember A: OK, tôi sẽ làm..."
}
```

**Response 200:** `{ "started": true }`

---

### `GET /api/projects/:id/refine/progress?token=xxx`

Poll refine progress + logs.

**Response 200:**
```json
{
  "projectId": "cmr3abc123",
  "status": "running",
  "sections": {
    "analysis": false,
    "hr": true,
    "sprint": false,
    "design": false,
    "uml": false,
    "docs": false,
    "git": false,
    "test": false,
    "security": false
  },
  "logs": [...],
  "startedAt": 1719800000000
}
```

**`sections` field:** `true` = section đã refine xong, `false` = đang xử lý.

---

## ✅ Tasks

### `GET /api/projects/:id/tasks?token=xxx`

List tất cả tasks (cho Kanban board).

**Response 200:**
```json
{
  "tasks": [
    {
      "id": "cmr3task1",
      "assigneeName": "Nguyen Van A",
      "memberId": "cmr3member1",
      "memberName": "Nguyen Van A",
      "title": "Thiết kế layout chính",
      "description": "...",
      "role": "Frontend Developer",
      "responsibilities": "...",
      "codeConventions": "...",
      "dependencies": "Cần setup project xong trước",
      "acceptanceCriteria": "...",
      "deadline": "2024-07-08T00:00:00.000Z",
      "sprintName": "Sprint 1",
      "status": "todo",
      "hours": 8,
      "priority": "P0",
      "layer": "UI",
      "targetFile": "src/components/Layout.tsx",
      "implementationSteps": ["Step 1...", "Step 2..."],
      "technicalHints": { "snippet": "...", "note": "..." },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### `PUT /api/projects/:id/tasks/:taskId?token=xxx`

Update task status (drag-drop Kanban).

**Request body:**
```json
{ "status": "in_progress" }
```

**Valid statuses:** `todo` | `in_progress` | `review` | `done`

**Permissions:**
- Leader: update bất kỳ task nào
- Member: chỉ update task của mình

**Response 200:** `{ "task": { ...updated } }`

> Side-effects: tạo `TaskLog`, refresh `TaskStatistic`, broadcast `task:update` qua notification-service, tạo `Notification` cho leader.

---

## 🔔 Notifications

### `GET /api/projects/:id/notifications?token=xxx`

List notifications visible cho user hiện tại (broadcast `recipientEmail=null` HOẶC `recipientEmail=userEmail`). Bao gồm per-user read state.

**Response 200:**
```json
{
  "notifications": [
    {
      "id": "cmr3notif1",
      "type": "TASK_COMPLETED",
      "title": "Task hoàn thành",
      "message": "Nguyen Van A đã hoàn thành...",
      "senderName": "Nguyen Van A",
      "senderRole": "Frontend Developer",
      "recipientEmail": null,
      "priority": "normal",
      "relatedTaskId": "cmr3task1",
      "relatedTaskTitle": "Thiết kế layout chính",
      "relatedMailId": null,
      "actionUrl": "/?p=cmr3abc123&token=...&tab=tasks",
      "actionLabel": "Mở Task",
      "extra": {},
      "read": false,
      "readAt": null,
      "createdAt": "..."
    }
  ],
  "unreadCount": 5
}
```

**13 notification types:** `TASK_COMPLETED`, `TASK_STATUS_CHANGED`, `PROPOSAL_CREATED`, `REQUIREMENT_EDITED`, `DOC_UPLOADED`, `COMMENT`, `AI_DONE`, `AI_ERROR`, `DEADLINE_SOON`, `TASK_ASSIGNED`, `MAIL_RECEIVED`, `PROJECT_INVITE`, `APPROVAL_REQUEST`.

---

### `POST /api/projects/:id/notifications?token=xxx`

Tạo notification (internal — dùng bởi task/proposal/mail flows) HOẶC mark all as read.

**Mark all as read:**
```json
{ "action": "mark_all_read" }
```

**Create (internal):**
```json
{
  "type": "TASK_COMPLETED",
  "title": "...",
  "message": "...",
  "senderName": "...",
  "senderRole": "...",
  "recipientEmail": null,
  "priority": "normal",
  "relatedTaskId": "..."
}
```

---

### `PATCH /api/projects/:id/notifications/:notifId?token=xxx`

Mark single notification as read/unread cho user hiện tại.

**Request body:** `{ "read": true }` (default `true`)

**Response 200:** `{ "notification": { ...updated, "read": true, "readAt": "..." } }`

---

### `DELETE /api/projects/:id/notifications/:notifId?token=xxx`

Delete notification (leader only).

**Response 200:** `{ "success": true }`

---

## 📬 Mail (Mailbox + Attachments + AI Rewrite)

### `GET /api/projects/:id/mailbox?token=xxx`

List mails cho user hiện tại trong folder cụ thể.

**Query params:**
| Param | Default | Mô tả |
|---|---|---|
| `folder` | `INBOX` | `INBOX` / `SENT` / `DRAFT` / `STARRED` / `ARCHIVE` / `SPAM` / `TRASH` |
| `q` | (empty) | Search trong subject + body |
| `page` | `1` | Page number |
| `limit` | `20` | Max 100 |

**Response 200:**
```json
{
  "mails": [
    {
      "id": "cmr3email1",
      "fromEmail": "leader@gmail.com",
      "fromName": "Bùi Văn Hội",
      "toEmails": ["a@example.com"],
      "ccEmails": [],
      "bccEmails": [],
      "subject": "Lời mời tham gia dự án",
      "bodyHtml": "...",
      "bodyText": "...",
      "type": "COMPOSE",
      "smtpStatus": "sent",
      "parentEmailId": null,
      "sentAt": "...",
      "createdAt": "...",
      "mailbox": {
        "folder": "INBOX",
        "isRead": false,
        "isStarred": false,
        "isArchived": false,
        "isTrashed": false,
        "readAt": null
      },
      "attachments": [{ "id": "...", "filename": "...", "size": 1024, "mimeType": "..." }]
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "unreadCount": 5
}
```

---

### `POST /api/projects/:id/mailbox?token=xxx`

Compose + send mail (leader only). Real SMTP send qua leader credentials + DB persistence.

**Request body:**
```json
{
  "toEmails": ["a@example.com", "b@example.com"],
  "ccEmails": ["c@example.com"],
  "bccEmails": [],
  "subject": "Lời mời tham gia dự án",
  "bodyHtml": "<p>Chào bạn,</p><p>...</p>",
  "bodyText": "Chào bạn, ...",
  "asDraft": false,
  "parentEmailId": null
}
```

**Response 200:**
```json
{
  "email": { "id": "cmr3email1", "smtpStatus": "sent", "smtpMessageId": "...", ... },
  "recipients": ["a@example.com", "b@example.com"]
}
```

> Side-effects: tạo `Notification` (type `MAIL_RECEIVED`) cho mỗi recipient + broadcast `mail:new` qua notification-service.

---

### `GET /api/projects/:id/mailbox/:mailId?token=xxx`

Get single mail với full body + attachments.

**Query param:** `?autoRead=1` (optional — tự mark as read)

**Response 200:**
```json
{
  "email": {
    "id": "cmr3email1",
    "fromEmail": "...",
    "fromName": "...",
    "toEmails": [...],
    "ccEmails": [...],
    "bccEmails": [...],
    "subject": "...",
    "bodyHtml": "...",
    "bodyText": "...",
    "type": "COMPOSE",
    "smtpStatus": "sent",
    "parentEmailId": null,
    "sentAt": "...",
    "createdAt": "...",
    "attachments": [
      { "id": "...", "filename": "doc.pdf", "size": 102400, "mimeType": "application/pdf" }
    ]
  },
  "mailbox": {
    "folder": "INBOX",
    "isRead": true,
    "isStarred": false,
    "isArchived": false,
    "isTrashed": false,
    "readAt": "..."
  }
}
```

---

### `PATCH /api/projects/:id/mailbox/:mailId?token=xxx`

Update per-user mailbox state.

**Request body (partial):**
```json
{
  "isRead": true,
  "isStarred": true,
  "isArchived": false,
  "isTrashed": false,
  "folder": "INBOX"
}
```

**Response 200:** `{ "mailbox": { ...updated } }`

---

### `DELETE /api/projects/:id/mailbox/:mailId?token=xxx`

- **Leader:** permanently delete mail
- **Member:** soft-delete (move to TRASH)

**Response 200:** `{ "success": true }`

---

### `POST /api/projects/:id/mailbox/ai-rewrite?token=xxx`

AI rewrite email draft qua OpenRouter. Leader only.

**Request body:**
```json
{
  "subject": "Lời mời tham gia dự án",
  "body": "<p>Chào bạn,</p><p>...</p>",
  "toEmails": ["a@example.com"],
  "mode": "professional",
  "projectTopic": "Hệ thống quản lý nhân sự"
}
```

**Mode values:** `improve` | `professional` | `friendly` | `concise` | `expand`

**Response 200:**
```json
{
  "rewritten": "<p>...</p>",
  "original": "<p>...</p>",
  "mode": "professional"
}
```

---

### `POST /api/projects/:id/mailbox/attachments?token=xxx`

Upload attachments cho draft email. Leader only. `multipart/form-data`.

**Form fields:**
- `files`: File[] (1 hoặc nhiều, max 5MB/file)
- `emailId`: string (optional — nếu draft đã có Email row)

**Response 200:**
```json
{
  "attachments": [
    { "id": "cmr3att1", "filename": "doc.pdf", "size": 102400, "mimeType": "application/pdf" }
  ]
}
```

---

### `GET /api/projects/:id/mailbox/attachments/:attId?token=xxx`

Download attachment (trả về binary stream với đúng Content-Type).

**Response 200:** Binary file với header `Content-Disposition: attachment; filename="..."`

---

### `DELETE /api/projects/:id/mailbox/attachments/:attId?token=xxx`

Delete attachment (leader only).

**Response 200:** `{ "success": true }`

---

## 📊 Dashboard

### `GET /api/dashboard/activity?token=xxx`

Recent ActivityLog entries across ALL projects user owns.

**Query params:**
| Param | Default | Mô tả |
|---|---|---|
| `limit` | `20` | Max 100 |
| `projectId` | (all) | Filter theo 1 project |

**Response 200:**
```json
{
  "activities": [
    {
      "id": "cmr3act1",
      "type": "TASK_COMPLETED",
      "status": "SUCCESS",
      "title": "Task hoàn thành",
      "details": "...",
      "actorName": "Nguyen Van A",
      "actorEmail": "a@example.com",
      "actorRole": "Frontend Developer",
      "actorAvatar": "",
      "projectId": "cmr3abc123",
      "projectTopic": "Hệ thống quản lý nhân sự",
      "relatedTaskId": "cmr3task1",
      "relatedTaskTitle": "Thiết kế layout",
      "relatedMailId": null,
      "actionUrl": "/?p=...&tab=tasks",
      "actionLabel": "Mở Task",
      "icon": "CheckSquare",
      "createdAt": "..."
    }
  ]
}
```

---

### `GET /api/dashboard/status?token=xxx`

Real system status cho NEXUS AI Status widget.

**Response 200:**
```json
{
  "agents": {
    "total": 10,
    "online": 8,
    "offline": 0,
    "busy": 1,
    "idle": 1,
    "error": 0,
    "list": [{ "id": "01", "name": "Requirement Analyst", "role": "Business Analyst", "status": "idle", "currentTask": "", "lastActiveAt": null }]
  },
  "apiKeys": {
    "total": 3,
    "active": 3,
    "expired": 0,
    "nearQuota": 0,
    "provider": "openrouter"
  },
  "pipeline": {
    "status": "ready",
    "currentAgent": "",
    "progress": 0,
    "stage": ""
  },
  "database": { "status": "connected", "details": "SQLite @ /db/custom.db" },
  "redis": { "status": "connected", "details": "Mock (in-memory)" },
  "vectorDB": { "status": "connected", "details": "Mock (in-memory)" },
  "storage": { "status": "connected", "details": "12.4 MB used" }
}
```

---

### `GET /api/dashboard/tasks?token=xxx`

Tasks relevant to user across all projects.

**Query param:** `?filter=in_progress|overdue|due_soon|assigned|all` (default: `all`)

**Response 200:**
```json
{
  "tasks": [
    {
      "id": "cmr3task1",
      "projectId": "cmr3abc123",
      "projectTopic": "Hệ thống quản lý nhân sự",
      "title": "Thiết kế layout chính",
      "status": "in_progress",
      "priority": "P0",
      "deadline": "...",
      "assigneeName": "Nguyen Van A",
      "sprintName": "Sprint 1"
    }
  ],
  "counts": {
    "inProgress": 5,
    "overdue": 2,
    "dueSoon": 3,
    "assigned": 8
  }
}
```

---

### `GET /api/dashboard/statistics?token=xxx`

Aggregate statistics across all projects user owns.

**Response 200:**
```json
{
  "totalProjects": 5,
  "activeProjects": 3,
  "completedProjects": 1,
  "totalMembers": 12,
  "totalTasks": 48,
  "completedTasks": 20,
  "overallCompletionRate": 41.7,
  "perProject": [
    {
      "projectId": "cmr3abc123",
      "topic": "Hệ thống quản lý nhân sự",
      "totalTasks": 12,
      "doneTasks": 8,
      "completionRate": 66.7,
      "status": "WORKSPACE"
    }
  ],
  "recentActivityCount": 15
}
```

---

## 📋 Activity Logs

### `GET /api/projects/:id/history?token=xxx`

All activity logs cho 1 project (pipeline, init, refine, task, mail, etc.).

**Response 200:**
```json
{
  "logs": [
    {
      "id": "cmr3log1",
      "type": "PIPELINE",
      "status": "SUCCESS",
      "title": "Pipeline hoàn tất",
      "details": "...",
      "agentId": null,
      "model": null,
      "duration": 45000,
      "logCount": 142,
      "createdAt": "..."
    }
  ]
}
```

> Trả về max 200 entries gần nhất.

---

### `GET /api/activity/logs?token=xxx`

ActivityLog entries — global (all user's projects) hoặc filter theo 1 project.

**Query params:** `?projectId=ID&limit=50` (max 200)

**Response 200:**
```json
{
  "logs": [
    {
      "id": "...",
      "type": "TASK_COMPLETED",
      "status": "SUCCESS",
      "title": "...",
      "details": "...",
      "actorName": "...",
      "actorEmail": "...",
      "actorRole": "...",
      "projectId": "...",
      "projectTopic": "...",
      "createdAt": "..."
    }
  ]
}
```

---

## 🤖 Agents

### `GET /api/agents`

Default 10 AI agent configurations (static from code).

**Response 200:**
```json
{
  "agents": [
    {
      "id": "01",
      "name": "Requirement Analyst",
      "role": "Business Analyst",
      "model": "nvidia/nemotron-3-ultra-550b-a55b:free",
      "provider": "openrouter",
      "temperature": 0.20,
      "status": "online",
      "description": "Phân tích yêu cầu, tech stack, features, actors, modules",
      "skills": ["Analysis", "Planning", "Documentation"]
    }
    // ... 02-10
  ],
  "stats": { "total": 10, "online": 10, "working": 0, "idle": 10, "error": 0 }
}
```

---

## 🐙 GitHub

### `GET /api/github/auth?projectId=xxx&token=xxx`

Redirect to GitHub OAuth.

**Response 302:** Redirect to `https://github.com/login/oauth/authorize?client_id=...&scope=repo&state=...`

---

### `GET /api/github/callback?code=xxx&state=xxx`

OAuth callback — exchange code for access token, save to Project.

**Response 302:** Redirect to `/?p=PROJECT_ID&token=LEADER_TOKEN`

---

### `GET /api/github/status?projectId=xxx&token=xxx`

Check OAuth status.

**Response 200:**
```json
{
  "connected": true,
  "username": "vanhoi04082006",
  "repoName": "nexus-hrm"
}
```

---

### `POST /api/github/push`

Push project files to GitHub + create Pull Request.

**Request body:**
```json
{
  "projectId": "cmr3abc123",
  "token": "cmr3xyz456",
  "repoName": "nexus-hrm"
}
```

**Response 200:**
```json
{
  "success": true,
  "repoUrl": "https://github.com/vanhoi04082006/nexus-hrm",
  "prUrl": "https://github.com/vanhoi04082006/nexus-hrm/pull/1",
  "filesPushed": 17
}
```

**Files pushed (17+):**
```
README.md
.gitignore
PROJECT_SUMMARY.md
FOLDER_STRUCTURE.txt
docs/CODING_CONVENTION.md
docs/API_STANDARD.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_ENDPOINTS.md
docs/SPRINT_PLAN.md
docs/TEAM.md
docs/TASKS.md
docs/UML/use-case.mmd
docs/UML/class-diagram.mmd
docs/UML/erd.mmd
docs/UML/sequence.mmd
.github/ISSUE_TEMPLATE/task.md
```

---

## 💬 Chat

### `GET /api/projects/:id/chat?token=xxx`

List chat messages.

**Response 200:**
```json
{
  "messages": [
    {
      "id": "cmr3msg1",
      "authorName": "Bùi Văn Hội",
      "authorRole": "leader",
      "message": "Mình bắt đầu làm nhé",
      "createdAt": "2024-07-01T10:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/projects/:id/chat?token=xxx`

Post a chat message (broadcast qua Socket.io nếu chat-service đang chạy).

**Request body:**
```json
{
  "message": "Mình bắt đầu làm nhé",
  "authorName": "Bùi Văn Hội",
  "authorRole": "leader"
}
```

**Response 200:** `{ "message": { ...created } }`

---

### `POST /api/projects/:id/chat/ai?token=xxx`

Trigger AI Assistant reply trong chat.

**Request body:**
```json
{
  "recentMessages": "Leader: ...\nMember: ...\n..."
}
```

**Response 200:**
```json
{
  "message": {
    "id": "cmr3msg2",
    "authorName": "NEXUS AI",
    "authorRole": "ai",
    "message": "Tôi đề xuất chia task theo module...",
    "createdAt": "2024-07-01T10:00:05.000Z"
  }
}
```

---

## 📝 Edit Proposals

### `GET /api/projects/:id/edit-proposals?token=xxx`

List edit proposals.

**Response 200:**
```json
{
  "proposals": [
    {
      "id": "cmr3prop1",
      "section": "analysis",
      "requestedChange": "Thêm feature export Excel",
      "status": "PENDING",
      "memberName": "Nguyen Van A",
      "createdAt": "..."
    }
  ]
}
```

**Status values:** `PENDING` | `APPROVED` | `REJECTED` | `APPLIED`

---

### `POST /api/projects/:id/edit-proposals?token=xxx`

Tạo edit proposal (member đề xuất, leader approve sau).

**Request body:**
```json
{
  "section": "analysis",
  "requestedChange": "Thêm feature export Excel"
}
```

**Response 200:** `{ "proposal": { ...created } }`

---

### `PUT /api/projects/:id/edit-proposals/:proposalId?token=xxx`

Leader approve / reject proposal.

**Request body:** `{ "status": "APPROVED" }` (valid: `APPROVED` | `REJECTED`)

**Response 200:** `{ "proposal": { ...updated } }`

---

## 📄 Sections

### `PUT /api/projects/:id/section?token=xxx`

Leader edit section content trực tiếp (không qua AI Refine).

**Request body:**
```json
{
  "section": "analysis",
  "content": { "desc": "...", "techStack": {...}, ... }
}
```

**Response 200:**
```json
{
  "section": {
    "type": "analysis",
    "content": "...",
    "version": 2
  }
}
```

> Version tự động bumped mỗi lần update. Tạo `ActivityLog` (`SECTION_EDIT`).

---

## 👥 Members

### `GET /api/projects/:id/members?token=xxx`

List members (chỉ leader thấy `inviteToken`).

**Response 200:**
```json
{
  "members": [
    {
      "id": "cmr3member1",
      "name": "Nguyen Van A",
      "email": "a@example.com",
      "strengths": "Backend, Database",
      "weaknesses": "Weak CSS",
      "role": "Backend Developer",
      "inviteToken": "cmr3token1",
      "joinedAt": null,
      "createdAt": "..."
    }
  ]
}
```

---

### `POST /api/projects/:id/members?token=xxx`

Add member (leader only).

**Request body:**
```json
{
  "name": "Nguyen Van B",
  "email": "b@example.com",
  "strengths": "Frontend, UI/UX",
  "weaknesses": "Weak DB"
}
```

**Response 200:** `{ "member": { ...created } }`

---

## 🧠 Context (Long-term Memory)

### `GET /api/projects/:id/context?token=xxx`

Get long-term memory (ProjectContext).

**Response 200:**
```json
{
  "context": {
    "projectId": "cmr3abc123",
    "summary": "{\"topic\":\"...\",\"modules\":[...],\"techStack\":{...},...}",
    "fullResults": "{...}",
    "tokensUsed": 15000,
    "runCount": 2,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Response 404:** No context yet (pipeline chưa chạy)

---

## 🪙 Tokens (Usage Logs)

### `GET /api/projects/:id/tokens?token=xxx`

List token usage logs (cost tracking).

**Response 200:**
```json
{
  "logs": [
    {
      "id": "cmr3token1",
      "agentId": "01",
      "agentName": "Requirement Analyst",
      "model": "openai/gpt-oss-120b:free",
      "apiKeyId": 1,
      "promptTokens": 1500,
      "completionTokens": 2000,
      "totalTokens": 3500,
      "success": true,
      "duration": 4500,
      "createdAt": "..."
    }
  ],
  "total": {
    "promptTokens": 15000,
    "completionTokens": 20000,
    "totalTokens": 35000
  }
}
```

---

## 🔧 Fix Mermaid

### `POST /api/projects/[id]/fix-mermaid?token=xxx`

AI-powered Mermaid diagram fixer — gửi code bị lỗi + error message → AI sửa syntax. Dùng bởi `MermaidRenderer` khi regex-based fixes (`fixMermaid` + `aggressiveFix`) thất bại.

**Request body:**
```json
{
  "code": "graph TD\n    A[Bệnh nhân] --> B[Dược sĩ]",
  "error": "Parse error on line 2...",
  "diagramType": "useCase"
}
```

**Response 200:**
```json
{
  "fixed": "graph TD\n    BenhNhan[\"Bệnh nhân\"] --> DuocSi[\"Dược sĩ\"]",
  "model": "openai/gpt-oss-120b:free"
}
```

> Models dùng để fix: `openai/gpt-oss-120b:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `google/gemma-4-31b-it:free`, `qwen/qwen3-coder:free`.

---

## ⚙️ Config & Templates

### `GET /api/config`

Get public URL config (cho email links).

**Response 200:**
```json
{
  "publicUrl": "https://xxx.trycloudflare.com"
}
```

> Nếu không có `.public-url` file → fallback `http://localhost:3000` (hoặc `NEXT_PUBLIC_APP_URL`).

---

### `GET /api/templates`

List project templates (blueprints cho quick create).

**Response 200:**
```json
{
  "templates": [
    {
      "id": "cmr3tpl1",
      "name": "Web App",
      "description": "Web application cơ bản",
      "category": "WEB",
      "icon": "Code2",
      "color": "from-cyan-500/20 to-blue-600/5",
      "topic": "...",
      "purpose": "Đồ án tốt nghiệp",
      "techPrefs": "...",
      "langPrefs": "...",
      "isBuiltIn": true
    }
  ]
}
```

**Categories:** `WEB`, `ECOMMERCE`, `MANAGEMENT`, `MOBILE`, `LMS`, `HOTEL`, `HOSPITAL`, `WAREHOUSE`, `BANKING`, `AI_SAAS`, `CHAT`, `MICROSERVICES`, `K8S`, `DASHBOARD`, `CUSTOM`.

---

## ❌ Error Responses

Tất cả endpoints trả về error theo format:

```json
{
  "error": "Short error message",
  "details": "Longer details (optional)"
}
```

### Common status codes

| Status | Meaning | When |
|---|---|---|
| `200` | OK | Success |
| `400` | Bad Request | Invalid body / missing required field |
| `401` | Unauthorized | Missing token |
| `403` | Forbidden | Invalid token / leader access required |
| `404` | Not Found | Project / task / proposal / mail not found |
| `500` | Internal Server Error | Unexpected error |
| `504` | Gateway Timeout | (rare — fixed by background+polling) |

### Common errors

| Error | Cause | Fix |
|---|---|---|
| `Access denied` | Invalid token | Check `?token=` param |
| `Leader access required` | Member trying leader-only action | Use `leaderToken` |
| `Project not found` | Wrong project ID | Check `projectId` |
| `You can only update your own tasks` | Member updating other's task | Use member's own task |
| `Invalid status` | Wrong status value | Check valid statuses |
| `Not addressed to you` | Notification not visible to user | Check `recipientEmail` |
| `Chỉ leader được upload attachment` | Member uploading attachment | Use `leaderToken` |
| `OPENROUTER_API_KEY khong hop le` | Invalid API key | Check `.env` |
| `GitHub not connected` | No OAuth token | Connect GitHub first |
| `code and error required` | Fix-mermaid missing fields | Include `code` + `error` |
| `No files provided` | Mailbox attachments empty | Include `files` in form-data |

---

## 🔌 Mini-service HTTP endpoints (internal)

NEXUS AI main app gọi các HTTP endpoint này trên mini-services (không public):

### Notification service (port 3002)

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/broadcast` | Broadcast notification → Socket.io room `project:ID` + user channel |
| `POST` | `/broadcast-mail` | Broadcast mail-received event |
| `POST` | `/broadcast-activity` | Broadcast new activity-log entry → `dashboard` + `project:ID` rooms |
| `POST` | `/broadcast-task` | Broadcast task update → `dashboard` + `project:ID` rooms |
| `POST` | `/broadcast-status` | Broadcast system-status update → `dashboard` room |
| `GET` | `/health` | Health check |

### Socket.io events (notification-service, port 3002)

| Direction | Event | Mô tả |
|---|---|---|
| Client → Server | `join` | `{ projectId, userEmail, token, dashboard? }` |
| Client → Server | `request_unread` | `{ projectId }` → triggers `unread_refresh` |
| Client → Server | `notification_read` | `{ projectId, notificationId, userEmail }` |
| Client → Server | `mail_read` | `{ projectId, mailId, userEmail }` |
| Server → Client | `notification:new` | `{ projectId, recipientEmail, notification, timestamp }` |
| Server → Client | `mail:new` | `{ projectId, recipientEmails, mail, timestamp }` |
| Server → Client | `activity:new` | `{ projectId, activity, timestamp }` |
| Server → Client | `task:update` | `{ projectId, taskId, action, task, timestamp }` |
| Server → Client | `status:update` | `{ subsystem, status, details, timestamp }` |
| Server → Client | `unread_refresh` | `{ projectId, timestamp }` |
| Server → Client | `notification_read` | Echo to other tabs |
| Server → Client | `mail_read` | Echo to other tabs |

### Chat service (port 3001)

| Direction | Event | Mô tả |
|---|---|---|
| Client → Server | `join` | `{ projectId, token }` |
| Client → Server | `chat_message` | `{ message, authorName, authorRole }` |
| Server → Client | `chat_message` | `{ id, message, authorName, authorRole, createdAt }` |

---

<p align="center">
  <strong>NEXUS AI API</strong> — 50+ REST endpoints + 2 Socket.io mini-services
</p>
