# 🔌 NEXUS AI — REST API Reference (v0.2.0)

> Tài liệu tham khảo **42 file route** (≈ 60 endpoint REST + 2 mini-service Socket.io) của NEXUS AI v0.2.0.
> Tất cả endpoint đã được verify trực tiếp từ `src/app/api/**/route.ts`.

**Base URL (local):** `http://localhost:3000`
**Base URL (production):** public URL qua Cloudflare Tunnel / Fly.io / Docker.
**Gateway:** Caddy (xem [Gateway Note](#-gateway-note) ở cuối tài liệu).

---

## 📑 Mục lục

- [Quy ước chung](#-quy-ước-chung)
- [Health Check](#-health-check)
- [Config & Templates](#-config--templates)
- [Agents](#-agents)
- [Activity Logs](#-activity-logs)
- [Notifications (Global)](#-notifications-global)
- [GitHub OAuth](#-github-oauth)
- [Dashboard](#-dashboard)
- [Projects Collection](#-projects-collection)
- [Project `[id]` — Workspace](#-project-id--workspace)
  - [Metadata (GET / PATCH / DELETE)](#metadata-get--patch--delete)
  - [Pipeline Progress](#pipeline-progress)
  - [Initialize (todolist)](#initialize-todolist)
  - [Refine (AI)](#refine-ai)
  - [Section (single edit)](#section-single-edit)
  - [Context (Long-term Memory)](#context-long-term-memory)
  - [History & Tokens](#history--tokens)
  - [Tasks](#tasks)
  - [Members](#members)
  - [Chat](#chat)
  - [Mailbox](#mailbox)
  - [Notifications (Project-scoped)](#notifications-project-scoped)
  - [Fix Mermaid](#fix-mermaid)
  - [Edit Proposals](#edit-proposals)
  - [Duplicate](#duplicate)
- [Mini-services (Socket.io)](#-mini-services-socketio)
- [Gateway Note](#-gateway-note)
- [Error Responses](#-error-responses)

---

## 🔐 Quy ước chung

| Quy ước | Mô tả |
|---|---|
| **Auth** | Hầu hết endpoint yêu cầu `?token=<leaderToken>`. Token được trả về khi `POST /api/projects` và gắn cho leader. Một số route public (health, agents, config, templates, github/auth) không cần. |
| **Content-Type** | `application/json` (trừ upload attachment là `multipart/form-data`). |
| **Path params** | `[id]` = `projectId`, `[taskId]`, `[mailId]`, `[attId]`, `[notifId]`, `[proposalId]`. |
| **Side effects** | Nhiều endpoint gọi `logActivity()` để ghi `ActivityLog` và/hoặc broadcast realtime tới mini-service `notification-service` / `chat-service`. |
| **Background jobs** | Các pipeline dài (create project, initialize, refine) chạy bất đồng bộ — frontend poll endpoint `/progress` tương ứng. |

### Response envelope chuẩn

```jsonc
// Thành công (200 / 201)
{ "ok": true, "data": { /* ... */ } }

// Hoặc trả object trực tiếp tuỳ route (xem từng endpoint)

// Lỗi (400 / 401 / 403 / 404 / 500)
{ "error": "MESSAGE_CODE", "message": "Mô tả tiếng Anh / tiếng Việt" }
```

---

## 🩺 Health Check

### `GET /api`

Health check đơn giản, không cần auth.

- **Auth:** ❌ không
- **Query:** —
- **Body:** —
- **Response:**
```json
{ "status": "ok", "service": "nexus-ai", "version": "0.2.0" }
```
- **Side effects:** —

---

## ⚙️ Config & Templates

### `GET /api/config`

Trả về cấu hình public cho frontend (APP_URL, publicUrl, số lượng API key đã cấu hình).

- **Auth:** ❌ không
- **Query:** —
- **Body:** —
- **Response:**
```json
{
  "APP_URL": "http://localhost:3000",
  "publicUrl": "https://nexus.example.com",
  "apiKeyCount": 3
}
```
- **Side effects:** —

### `GET /api/templates`

Liệt kê project templates (preset cấu hình dự án dùng để khởi tạo nhanh).

- **Auth:** ❌ không
- **Query:** —
- **Body:** —
- **Response:**
```json
{
  "templates": [
    {
      "id": "saas-mvp",
      "name": "SaaS MVP",
      "description": "Khởi động SaaS trong 1 tuần",
      "icon": "🚀",
      "defaultStack": ["next", "prisma", "postgres"]
    }
  ]
}
```
- **Side effects:** —

---

## 🤖 Agents

### `GET /api/agents`

Liệt kê cấu hình các AI agent có trong pipeline (researcher, planner, architect, coder, reviewer, ...).

- **Auth:** ❌ không
- **Query:** —
- **Body:** —
- **Response:**
```json
{
  "agents": [
    {
      "id": "researcher",
      "name": "Researcher",
      "role": "Nghiên cứu yêu cầu & đối thủ",
      "model": "gpt-4o-mini",
      "enabled": true
    }
  ]
}
```
- **Side effects:** —

---

## 📜 Activity Logs

### `GET /api/activity/logs`

Liệt kê activity log (toàn hệ thống hoặc lọc theo project).

- **Auth:** ✅ `?token=` (leader token)
- **Query:**
  | Param | Bắt buộc | Mặc định | Mô tả |
  |---|---|---|---|
  | `token` | ✅ | — | Leader token |
  | `projectId` | ❌ | — | Lọc theo project |
  | `limit` | ❌ | `100` | Số dòng tối đa |
- **Body:** —
- **Response:**
```json
{
  "logs": [
    {
      "id": "log_01H...",
      "projectId": "prj_abc",
      "type": "pipeline.start",
      "message": "Pipeline started",
      "meta": { "topic": "Xây SaaS ERP" },
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```
- **Side effects:** —

---

## 🔔 Notifications (Global)

### `GET /api/notifications`

Liệt kê notification toàn cục của user (leader) — không gắn project cụ thể.

- **Auth:** ✅ `?token=`
- **Query:** `token` (bắt buộc)
- **Body:** —
- **Response:**
```json
{
  "notifications": [
    {
      "id": "ntf_01H...",
      "title": "Pipeline hoàn tất",
      "body": "Dự án X đã xong giai đoạn research",
      "read": false,
      "type": "pipeline",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```
- **Side effects:** —

### `PATCH /api/notifications/[id]`

Đánh dấu đã đọc / chưa đọc một notification.

- **Auth:** ✅ `?token=`
- **Query:** `token`
- **Body:**
```json
{ "read": true }
```
- **Response:**
```json
{ "id": "ntf_01H...", "read": true }
```
- **Side effects:** —

---

## 🐙 GitHub OAuth

### `GET /api/github/auth`

Khởi động luồng OAuth — redirect user tới GitHub authorize URL.

- **Auth:** ❌ không (chính nó là auth)
- **Query:** —
- **Body:** —
- **Response:** HTTP 302 redirect tới `https://github.com/login/oauth/authorize?...`
- **Side effects:** — (state được lưu session/cookie)

### `GET /api/github/callback`

OAuth callback — GitHub redirect về đây kèm `?code=&state=`. Sau khi đổi code lấy access token, lưu vào user/leader record và redirect về frontend.

- **Auth:** ❌ không
- **Query:** `code`, `state` (do GitHub trả về)
- **Body:** —
- **Response:** HTTP 302 về `${APP_URL}/settings/github?connected=true`
- **Side effects:** Lưu `githubAccessToken` (encrypted) vào DB.

### `POST /api/github/push`

Push project lên GitHub repo (tạo repo mới nếu cần).

- **Auth:** ✅ `?token=`
- **Query:**
  | Param | Bắt buộc | Mô tả |
  |---|---|---|
  | `token` | ✅ | Leader token |
  | `projectId` | ✅ | Project cần push |
- **Body:**
```json
{ "repoName": "nexus-project-abc", "private": true }
```
- **Response:**
```json
{
  "ok": true,
  "repoUrl": "https://github.com/user/nexus-project-abc",
  "commitSha": "a1b2c3d"
}
```
- **Side effects:** `logActivity({ type: "github.push", ... })`; broadcast notification.

### `GET /api/github/status`

Kiểm tra xem leader đã kết nối GitHub chưa (và có quyền repo hay không).

- **Auth:** ✅ `?token=`
- **Query:** `token`, `projectId`
- **Body:** —
- **Response:**
```json
{
  "connected": true,
  "username": "octocat",
  "scopes": ["repo", "user:email"]
}
```
- **Side effects:** —

---

## 📊 Dashboard

### `GET /api/dashboard/activity`

Activity feed gần nhất của leader (đa project).

- **Auth:** ✅ `?token=`
- **Query:**
  | Param | Bắt buộc | Mặc định |
  |---|---|---|
  | `token` | ✅ | — |
  | `limit` | ❌ | `20` |
- **Body:** —
- **Response:**
```json
{
  "activity": [
    { "id": "log_01H", "projectId": "prj_abc", "type": "task.done", "message": "Task #12 done", "createdAt": "..." }
  ]
}
```
- **Side effects:** —

### `GET /api/dashboard/statistics`

Thống kê tổng hợp: số project, task, token dùng, v.v.

- **Auth:** ✅ `?token=`
- **Query:** `token`
- **Body:** —
- **Response:**
```json
{
  "projects": 12,
  "tasksDone": 87,
  "tasksPending": 14,
  "tokensUsed": 234560,
  "emailsSent": 23,
  "activeAgents": 6
}
```
- **Side effects:** —

### `GET /api/dashboard/status`

Trạng thái hệ thống: DB, pipeline, agents, mini-services.

- **Auth:** ✅ `?token=`
- **Query:** `token`
- **Body:** —
- **Response:**
```json
{
  "db": "ok",
  "pipeline": { "running": 2, "queued": 0 },
  "agents": [{ "id": "researcher", "status": "idle" }],
  "services": {
    "chat": "up",
    "notification": "up"
  }
}
```
- **Side effects:** —

### `GET /api/dashboard/tasks`

Danh sách task của leader (có filter).

- **Auth:** ✅ `?token=`
- **Query:**
  | Param | Bắt buộc | Mặc định | Mô tả |
  |---|---|---|---|
  | `token` | ✅ | — | |
  | `filter` | ❌ | `all` | `all` \| `pending` \| `in_progress` \| `done` \| `overdue` |
- **Body:** —
- **Response:**
```json
{
  "tasks": [
    { "id": "tsk_01", "projectId": "prj_abc", "title": "Viết spec", "status": "pending", "assignee": "leader", "deadline": "..." }
  ]
}
```
- **Side effects:** —

---

## 🗂 Projects Collection

### `GET /api/projects`

Liệt kê toàn bộ project với aggregate count.

- **Auth:** ❌ không (public list — hoặc có thể check token tuỳ deployment)
- **Query:** —
- **Body:** —
- **Response:**
```json
{
  "projects": [
    {
      "id": "prj_abc",
      "topic": "Xây SaaS ERP",
      "description": "...",
      "status": "in_progress",
      "priority": "high",
      "deadline": "2025-02-01",
      "techStack": ["next", "prisma"],
      "tags": ["saas"],
      "coverColor": "#3b82f6",
      "isFavorite": false,
      "isArchived": false,
      "_count": { "members": 4, "tasks": 12, "analyses": 2 },
      "createdAt": "..."
    }
  ]
}
```
- **Side effects:** —

### `POST /api/projects`

Tạo project mới + khởi động pipeline AI bất đồng bộ (research → plan → architect → code).

- **Auth:** ❌ không (tự sinh leaderToken)
- **Query:** —
- **Body:**
```json
{
  "topic": "Xây SaaS ERP cho SME",
  "description": "ERP đa module: kế toán, kho, HR",
  "purpose": "MVP trong 4 tuần",
  "extraInfo": {
    "requirements": ["multi-tenant", "i18n"],
    "specialReqs": "Tuân thủ hoá đơn điện tử VN",
    "techPrefs": ["Next.js", "Prisma", "PostgreSQL"],
    "langPrefs": ["vi", "en"]
  },
  "members": [
    { "name": "An", "email": "an@x.vn", "strengths": ["backend"], "weaknesses": ["ui"] },
    { "name": "Bình", "email": "binh@x.vn", "strengths": ["frontend"], "weaknesses": ["devops"] }
  ],
  "leaderName": "Leader Name",
  "leaderEmail": "leader@x.vn",
  "leaderSmtpPassword": "smtp-app-password",
  "parallel": true
}
```
- **Response (201):**
```json
{
  "projectId": "prj_abc",
  "leaderToken": "tok_..."
}
```
- **Side effects:**
  - Tạo `Project` + `Member` (leader + members).
  - Gọi `updatePipelineStatus({ status: "running" })`.
  - Chạy pipeline nền (researcher → planner → architect → coder → reviewer).
  - `logActivity({ type: "project.created" })`, `logActivity({ type: "pipeline.start" })`.
  - Broadcast notification qua `notification-service`.

---

## 🧩 Project `[id]` — Workspace

Tất cả endpoint dưới đây có prefix `/api/projects/[id]` và yêu cầu `?token=<leaderToken>` (trừ `GET /progress` có thể public cho polling).

### Metadata (GET / PATCH / DELETE)

#### `GET /api/projects/[id]?token=`

Lấy toàn bộ workspace data: project, pipeline result, members, access, tasks, chat messages (gần đây), edit proposals.

- **Auth:** ✅ `token`
- **Response:**
```json
{
  "project": { /* full project */ },
  "result": { "research": "...", "plan": "...", "architecture": "...", "code": "..." },
  "members": [ /* ... */ ],
  "access": [ /* leader + members */ ],
  "tasks": [ /* ... */ ],
  "chatMessages": [ /* 50 gần đây */ ],
  "editProposals": [ /* ... */ ]
}
```
- **Side effects:** —

#### `PATCH /api/projects/[id]?token=`

Cập nhật metadata project.

- **Auth:** ✅ `token`
- **Body (mọi field tuỳ chọn):**
```json
{
  "topic": "Tên mới",
  "description": "...",
  "isFavorite": true,
  "isArchived": false,
  "priority": "high",
  "deadline": "2025-03-01",
  "techStack": ["next", "prisma"],
  "tags": ["saas", "erp"],
  "coverColor": "#10b981",
  "status": "in_progress"
}
```
- **Response:**
```json
{ "project": { /* updated */ } }
```
- **Side effects:** `logActivity({ type: "project.updated" })`.

#### `DELETE /api/projects/[id]?token=`

Xoá project + cascade (tasks, members, chat, mailbox, notifications, edit proposals, activity logs).

- **Auth:** ✅ `token`
- **Response:**
```json
{ "ok": true, "deleted": "prj_abc" }
```
- **Side effects:** `logActivity({ type: "project.deleted" })` (trước khi cascade).

---

### Pipeline Progress

#### `GET /api/projects/[id]/progress`

Trạng thái pipeline (public, dùng cho SSE/polling).

- **Auth:** ❌ không (hoặc `token` tuỳ config)
- **Response:**
```json
{
  "status": "running",
  "agents": [
    { "id": "researcher", "status": "done", "startedAt": "...", "endedAt": "..." },
    { "id": "planner",    "status": "running" }
  ],
  "logs": [
    { "ts": "...", "level": "info", "agent": "researcher", "message": "..." }
  ],
  "error": null
}
```
- **Side effects:** —

---

### Initialize (todolist)

#### `POST /api/projects/[id]/initialize?token=`

Sinh todolist ban đầu bằng AI (chạy nền). Trả về ngay `started: true`, frontend poll `/initialize/progress`.

- **Auth:** ✅ `token`
- **Body:** — (hoặc `{ "force": true }` để regenerate)
- **Response:**
```json
{ "started": true }
```
- **Side effects:** `logActivity({ type: "initialize.start" })`.

#### `GET /api/projects/[id]/initialize/progress`

- **Auth:** ❌ (poll-friendly)
- **Response:**
```json
{
  "status": "running",
  "logs": [{ "ts": "...", "message": "Generating 12 tasks..." }],
  "taskCount": 12,
  "error": null
}
```
- **Side effects:** —

---

### Refine (AI)

#### `POST /api/projects/[id]/refine?token=`

Yêu cầu AI tinh chỉnh lại các section (research/plan/architecture/code) — chạy nền.

- **Auth:** ✅ `token`
- **Body:**
```json
{
  "sections": ["plan", "architecture"],
  "instructions": "Làm gọn phần plan, thêm sơ đồ kiến trúc"
}
```
- **Response:** `{ "started": true }`
- **Side effects:** `logActivity({ type: "refine.start" })`.

#### `GET /api/projects/[id]/refine/progress`

- **Auth:** ❌ (poll)
- **Response:**
```json
{
  "status": "running",
  "section": "plan",
  "logs": [ /* ... */ ],
  "error": null
}
```
- **Side effects:** —

---

### Section (single edit)

#### `PUT /api/projects/[id]/section?token=`

Edit trực tiếp một section (không qua AI). Dùng cho inline editor.

- **Auth:** ✅ `token`
- **Body:**
```json
{ "section": "plan", "content": "# Plan\n## Milestone 1\n..." }
```
- **Response:**
```json
{ "ok": true, "section": "plan", "updatedAt": "..." }
```
- **Side effects:** `logActivity({ type: "section.updated", meta: { section: "plan" } })`.

---

### Context (Long-term Memory)

#### `GET /api/projects/[id]/context?token=`

Lấy `ProjectContext` — bộ nhớ dài hạn mà các agent dùng để giữ continuum giữa các lần refine.

- **Auth:** ✅ `token`
- **Response:**
```json
{
  "context": {
    "summary": "Project ERP SME, stack Next + Prisma...",
    "decisions": ["Dùng multi-tenant qua schema", "RBAC đơn giản"],
    "openQuestions": ["Mức giá plan?"],
    "updatedAt": "..."
  }
}
```
- **Side effects:** —

---

### History & Tokens

#### `GET /api/projects/[id]/history?token=`

Activity log của project (tối đa 200 dòng gần nhất).

- **Auth:** ✅ `token`
- **Response:**
```json
{
  "logs": [ /* ActivityLog[] */ ]
}
```
- **Side effects:** —

#### `GET /api/projects/[id]/tokens?token=`

Log usage token (input/output/cost) theo từng call AI trong project.

- **Auth:** ✅ `token`
- **Response:**
```json
{
  "usage": [
    { "id": "tok_01", "agent": "researcher", "model": "gpt-4o-mini",
      "inputTokens": 1200, "outputTokens": 800, "costUsd": 0.0021, "createdAt": "..." }
  ],
  "total": { "inputTokens": 12000, "outputTokens": 8400, "costUsd": 0.021 }
}
```
- **Side effects:** —

---

### Tasks

#### `GET /api/projects/[id]/tasks?token=`

- **Auth:** ✅ `token`
- **Response:**
```json
{ "tasks": [ { "id": "tsk_01", "title": "...", "status": "pending", "assignee": "leader", "deadline": "..." } ] }
```

#### `POST /api/projects/[id]/tasks?token=`

- **Auth:** ✅ `token`
- **Body:**
```json
{ "title": "Viết spec API", "description": "...", "assignee": "an@x.vn", "status": "pending", "priority": "high", "deadline": "2025-02-10" }
```
- **Response:** `{ "task": { /* created */ } }`
- **Side effects:** `logActivity({ type: "task.created" })`; broadcast notification tới assignee.

#### `PATCH /api/projects/[id]/tasks/[taskId]?token=`

- **Auth:** ✅ `token`
- **Body (tuỳ chọn):**
```json
{ "status": "done", "title": "Đổi tên", "assignee": "binh@x.vn" }
```
- **Response:** `{ "task": { /* updated */ } }`
- **Side effects:** `logActivity({ type: "task.updated" })`; nếu `status=done` → broadcast notification cho leader.

---

### Members

#### `GET /api/projects/[id]/members?token=`

- **Auth:** ✅ `token`
- **Response:**
```json
{
  "members": [
    { "id": "mem_01", "name": "An", "email": "an@x.vn", "role": "member",
      "strengths": ["backend"], "weaknesses": ["ui"], "userId": "..." }
  ]
}
```

> **Lưu ý:** Các thao tác `POST / PATCH / DELETE` member có thể được expose qua UI settings, nhưng route file `members/route.ts` hiện chỉ export `GET`. Để thêm/sửa/xoá member, dùng `PATCH /api/projects/[id]` cập nhật mảng `members`, hoặc endpoints admin (nếu có).

---

### Chat

#### `GET /api/projects/[id]/chat?token=`

50 tin nhắn gần nhất (realtime đi qua Socket.io — endpoint này chỉ để hydrate).

- **Auth:** ✅ `token`
- **Response:**
```json
{
  "messages": [
    { "id": "msg_01", "userId": "...", "author": "An", "content": "Hello", "createdAt": "..." }
  ]
}
```

#### `POST /api/projects/[id]/chat?token=`

Persist một tin nhắn (realtime broadcast do `chat-service` Socket.io xử lý).

- **Auth:** ✅ `token`
- **Body:**
```json
{ "content": "Có ai review PR #12 chưa?" }
```
- **Response:** `{ "message": { /* saved */ } }`
- **Side effects:** `logActivity({ type: "chat.message" })`. **Không** gọi HTTP tới `chat-service` (realtime tách rời).

#### `POST /api/projects/[id]/chat/ai?token=`

Yêu cầu AI assistant trả lời trong chat (context-aware với ProjectContext + tin nhắn gần đây).

- **Auth:** ✅ `token`
- **Body:**
```json
{ "prompt": "Tóm tắt progress hiện tại", "history": [ /* optional */ ] }
```
- **Response:**
```json
{ "reply": "Dự án đang ở giai đoạn planner, 12 task đã sinh...", "model": "gpt-4o-mini" }
```
- **Side effects:** Ghi token usage; `logActivity({ type: "chat.ai" })`.

---

### Mailbox

#### `GET /api/projects/[id]/mailbox?token=`

List email trong mailbox của project (inbox/sent/drafts theo `?folder=`).

- **Auth:** ✅ `token`
- **Query (tuỳ chọn):** `folder=inbox|sent|drafts|trash`, `limit`, `unreadOnly`
- **Response:**
```json
{
  "mails": [
    { "id": "mail_01", "from": "leader@x.vn", "to": ["an@x.vn"], "subject": "Kickoff",
      "preview": "Chào cả nhà...", "read": false, "starred": false, "folder": "inbox", "createdAt": "..." }
  ]
}
```

#### `POST /api/projects/[id]/mailbox?token=`

Soạn + gửi email (qua SMTP của leader). Tạo mailbox entry cho từng recipient in-project.

- **Auth:** ✅ `token`
- **Body:**
```json
{
  "to": ["an@x.vn", "binh@x.vn"],
  "cc": [],
  "subject": "Kickoff meeting",
  "body": "Hẹn cả team 9h sáng mai...",
  "attachments": ["att_01"]
}
```
- **Response:** `{ "mail": { /* saved */ }, "sent": true }`
- **Side effects:**
  - Gửi SMTP.
  - Tạo `Mail` row cho từng recipient.
  - `logActivity({ type: "mail.sent" })`.
  - Broadcast realtime qua `notification-service` `/broadcast-mail`.

#### `GET /api/projects/[id]/mailbox/[mailId]?token=`

Chi tiết một email.

- **Auth:** ✅ `token`
- **Response:**
```json
{ "mail": { "id": "mail_01", "body": "<full html/text>", "attachments": [ /* ref */ ] } }
```

#### `PATCH /api/projects/[id]/mailbox/[mailId]?token=`

Cập nhật trạng thái email.

- **Auth:** ✅ `token`
- **Body:**
```json
{ "read": true, "starred": true, "folder": "inbox" }
```
- **Response:** `{ "mail": { /* updated */ } }`

#### `POST /api/projects/[id]/mailbox/ai-rewrite?token=`

AI viết lại email theo 1 trong 5 mode: `professional`, `friendly`, `concise`, `persuasive`, `apologetic`.

- **Auth:** ✅ `token`
- **Body:**
```json
{ "content": "Gửi sếp, em nghỉ mai.", "mode": "professional", "tone": "polite" }
```
- **Response:**
```json
{ "rewritten": "Kính gửi Anh/Chị,\n\nTôi xin phép báo cáo ngày mai tôi sẽ nghỉ...", "mode": "professional", "model": "gpt-4o-mini" }
```
- **Side effects:** Ghi token usage.

#### `GET /api/projects/[id]/mailbox/attachments?token=`

Liệt kê attachment của project.

- **Response:**
```json
{ "attachments": [ { "id": "att_01", "filename": "spec.pdf", "size": 123456, "mimeType": "application/pdf", "uploadedAt": "..." } ] }
```

#### `POST /api/projects/[id]/mailbox/attachments?token=`

Upload attachment (`multipart/form-data`).

- **Body (form):** `file=<binary>`
- **Response:** `{ "attachment": { "id": "att_01", "filename": "...", "size": 123456 } }`
- **Side effects:** Lưu file vào storage (local/OSS), `logActivity({ type: "mail.attachment" })`.

#### `GET /api/projects/[id]/mailbox/attachments/[attId]?token=`

Download attachment (stream file).

- **Response:** `Content-Type: <mime>`, `Content-Disposition: attachment; filename="..."`, binary stream.

---

### Notifications (Project-scoped)

#### `GET /api/projects/[id]/notifications?token=`

List notification thuộc project (khác với global `GET /api/notifications`).

- **Auth:** ✅ `token`
- **Response:**
```json
{
  "notifications": [
    { "id": "ntf_01", "projectId": "prj_abc", "title": "Task done", "body": "...", "read": false, "createdAt": "..." }
  ]
}
```

#### `PATCH /api/projects/[id]/notifications/[notifId]?token=`

Toggle read/unread.

- **Body:** `{ "read": true }`
- **Response:** `{ "id": "ntf_01", "read": true }`

---

### Fix Mermaid

#### `POST /api/projects/[id]/fix-mermaid?token=`

Gửi code Mermaid bị lỗi + error message → AI trả về code đã sửa (hoặc fallback nếu AI không fix được).

- **Auth:** ✅ `token`
- **Body:**
```json
{
  "code": "graph TD\n  A-->B\n  B-→C",
  "error": "Syntax error at line 3",
  "diagramType": "flowchart"
}
```
- **Response (thành công):**
```json
{ "fixedCode": "graph TD\n  A-->B\n  B-->C", "model": "gpt-4o-mini" }
```
- **Response (fallback):**
```json
{ "fixedCode": "graph TD\n  A[Error rendering diagram]", "fallback": true, "reason": "AI unable to parse" }
```
- **Side effects:** Ghi token usage.

---

### Edit Proposals

Cho phép member đề xuất sửa section; leader approve/reject.

#### `GET /api/projects/[id]/edit-proposals?token=`

- **Response:**
```json
{
  "proposals": [
    { "id": "prop_01", "section": "plan", "proposedBy": "an@x.vn", "oldContent": "...", "newContent": "...",
      "status": "pending", "createdAt": "..." }
  ]
}
```

#### `POST /api/projects/[id]/edit-proposals?token=`

Tạo proposal mới.

- **Body:**
```json
{ "section": "plan", "oldContent": "...", "newContent": "...", "comment": "Thêm milestone 0" }
```
- **Response:** `{ "proposal": { /* created */ } }`
- **Side effects:** `logActivity({ type: "proposal.created" })`; tạo + broadcast notification cho leader.

#### `PATCH /api/projects/[id]/edit-proposals/[proposalId]?token=`

Approve (apply vào section) hoặc reject proposal.

- **Body:**
```json
{ "action": "approve", "comment": "OK, apply" }
```
- **Response:** `{ "proposal": { "id": "prop_01", "status": "approved", "appliedAt": "..." } }`
- **Side effects:**
  - Nếu approve: cập nhật section content + `logActivity({ type: "proposal.applied" })`.
  - Tạo + broadcast notification cho member đề xuất.

---

### Duplicate

#### `POST /api/projects/[id]/duplicate?token=`

Nhân bản project (không copy tasks done / mailbox đã gửi).

- **Body (tuỳ chọn):**
```json
{ "newTopic": "ERP v2", "copyTasks": true, "copyMembers": true }
```
- **Response:**
```json
{ "projectId": "prj_xyz", "leaderToken": "tok_..." }
```
- **Side effects:** `logActivity({ type: "project.duplicated", meta: { from: "prj_abc" } })`.

---

## 🛰 Mini-services (Socket.io)

NEXUS AI tách realtime ra 2 mini-service chạy port riêng (Caddy gateway forward qua `XTransformPort`).

### `chat-service` — port 3001

Socket.io namespace `/`. Client connect: `io("/?XTransformPort=3001")`.

| Event | Hướng | Payload | Mô tả |
|---|---|---|---|
| `join` | client → server | `{ projectId, userId, token }` | Tham gia room `project:<id>` |
| `send_message` | client → server | `{ projectId, content }` | Broadcast tới room |
| `typing` | client → server | `{ projectId, userId, isTyping }` | Indicator |
| `message` | server → client | `{ id, userId, author, content, createdAt }` | Tin nhắn mới |
| `user_joined` | server → client | `{ userId, projectId }` | Có người vào room |
| `user_left` | server → client | `{ userId, projectId }` | Có người rời room |

### `notification-service` — port 3002

Socket.io namespace `/`. Client connect: `io("/?XTransformPort=3002")`.

| Event | Hướng | Payload | Mô tả |
|---|---|---|---|
| `subscribe` | client → server | `{ userId, token }` | Đăng ký nhận noti realtime |
| `notification` | server → client | `{ id, title, body, type, projectId, createdAt }` | Push noti mới |

Ngoài Socket.io, `notification-service` cũng expose endpoint HTTP nội bộ `/broadcast-mail` (gọi bởi `POST /api/projects/[id]/mailbox`).

---

## 🌐 Gateway Note

Tất cả request đi qua **Caddy gateway** với relative path (không prefix port).

- **HTTP qua cổng khác 3000:** thêm query `?XTransformPort=PORT`.
  - Ví dụ mini-service chat: `GET /api/chat?XTransformPort=3001`.
- **WebSocket qua mini-service:** khởi tạo `io("/?XTransformPort=3001")` (Socket.io client sẽ gửi handshake qua Caddy → forward tới port 3001).
- **Default port (không có `XTransformPort`):** 3000 — gateway forward tới Next.js API.
- Caddy rule mẫu:
  ```caddy
  @chat query XTransformPort=3001
  reverse_proxy @chat localhost:3001

  @notif query XTransformPort=3002
  reverse_proxy @notif localhost:3002

  reverse_proxy localhost:3000   # fallback
  ```

---

## ❌ Error Responses

Mọi endpoint lỗi trả về JSON thống nhất:

```json
{
  "error": "ERROR_CODE",
  "message": "Mô tả chi tiết",
  "details": { /* optional */ }
}
```

### Bảng mã lỗi phổ biến

| HTTP | `error` | Nguyên nhân |
|---|---|---|
| 400 | `BAD_REQUEST` | Body / query param thiếu hoặc sai format |
| 401 | `UNAUTHORIZED` | Thiếu `token` hoặc token không hợp lệ |
| 403 | `FORBIDDEN` | Token hợp lệ nhưng không có quyền trên project |
| 404 | `NOT_FOUND` | Project / task / mail / proposal không tồn tại |
| 409 | `CONFLICT` | Trạng thái không cho phép thao tác (vd. approve proposal đã reject) |
| 422 | `VALIDATION_ERROR` | Prisma/Zod validation fail |
| 429 | `RATE_LIMITED` | Vượt giới hạn gọi AI / SMTP |
| 500 | `INTERNAL_ERROR` | Lỗi server — check `logs[]` trong `/progress` để debug pipeline |
| 502 | `UPSTREAM_ERROR` | Mini-service (chat/notification) hoặc LLM provider lỗi |

### Ví dụ 401

```http
GET /api/projects/prj_abc/tasks?token=invalid
```
```json
{ "error": "UNAUTHORIZED", "message": "Invalid or expired leader token" }
```

### Ví dụ 500 (pipeline)

```json
{
  "error": "INTERNAL_ERROR",
  "message": "Pipeline failed at agent 'architect'",
  "details": { "agent": "architect", "lastLog": "Token limit exceeded" }
}
```

---

## 📌 Appendix — Route inventory (42 files)

```
src/app/api/route.ts                                    GET  /api
src/app/api/activity/logs/route.ts                      GET  /api/activity/logs
src/app/api/agents/route.ts                             GET  /api/agents
src/app/api/config/route.ts                             GET  /api/config
src/app/api/dashboard/activity/route.ts                 GET  /api/dashboard/activity
src/app/api/dashboard/statistics/route.ts               GET  /api/dashboard/statistics
src/app/api/dashboard/status/route.ts                   GET  /api/dashboard/status
src/app/api/dashboard/tasks/route.ts                    GET  /api/dashboard/tasks
src/app/api/github/auth/route.ts                        GET  /api/github/auth
src/app/api/github/callback/route.ts                    GET  /api/github/callback
src/app/api/github/push/route.ts                        POST /api/github/push
src/app/api/github/status/route.ts                      GET  /api/github/status
src/app/api/notifications/route.ts                      GET  /api/notifications
src/app/api/notifications/[id]/route.ts                 PATCH /api/notifications/[id]
src/app/api/projects/route.ts                           GET  /api/projects
                                                        POST /api/projects
src/app/api/templates/route.ts                          GET  /api/templates
src/app/api/projects/[id]/route.ts                      GET | PATCH | DELETE /api/projects/[id]
src/app/api/projects/[id]/progress/route.ts             GET  /api/projects/[id]/progress
src/app/api/projects/[id]/initialize/route.ts           POST /api/projects/[id]/initialize
src/app/api/projects/[id]/initialize/progress/route.ts  GET  /api/projects/[id]/initialize/progress
src/app/api/projects/[id]/refine/route.ts               POST /api/projects/[id]/refine
src/app/api/projects/[id]/refine/progress/route.ts      GET  /api/projects/[id]/refine/progress
src/app/api/projects/[id]/section/route.ts              PUT  /api/projects/[id]/section
src/app/api/projects/[id]/context/route.ts              GET  /api/projects/[id]/context
src/app/api/projects/[id]/history/route.ts              GET  /api/projects/[id]/history
src/app/api/projects/[id]/tokens/route.ts               GET  /api/projects/[id]/tokens
src/app/api/projects/[id]/tasks/route.ts                GET | POST /api/projects/[id]/tasks
src/app/api/projects/[id]/tasks/[taskId]/route.ts       PATCH /api/projects/[id]/tasks/[taskId]
src/app/api/projects/[id]/members/route.ts              GET  /api/projects/[id]/members
src/app/api/projects/[id]/chat/route.ts                 GET | POST /api/projects/[id]/chat
src/app/api/projects/[id]/chat/ai/route.ts              POST /api/projects/[id]/chat/ai
src/app/api/projects/[id]/mailbox/route.ts              GET | POST /api/projects/[id]/mailbox
src/app/api/projects/[id]/mailbox/[mailId]/route.ts     GET | PATCH /api/projects/[id]/mailbox/[mailId]
src/app/api/projects/[id]/mailbox/ai-rewrite/route.ts   POST /api/projects/[id]/mailbox/ai-rewrite
src/app/api/projects/[id]/mailbox/attachments/route.ts  GET | POST /api/projects/[id]/mailbox/attachments
src/app/api/projects/[id]/mailbox/attachments/[attId]/route.ts
                                                        GET  /api/projects/[id]/mailbox/attachments/[attId]
src/app/api/projects/[id]/notifications/route.ts        GET  /api/projects/[id]/notifications
src/app/api/projects/[id]/notifications/[notifId]/route.ts
                                                        PATCH /api/projects/[id]/notifications/[notifId]
src/app/api/projects/[id]/fix-mermaid/route.ts          POST /api/projects/[id]/fix-mermaid
src/app/api/projects/[id]/edit-proposals/route.ts       GET | POST /api/projects/[id]/edit-proposals
src/app/api/projects/[id]/edit-proposals/[proposalId]/route.ts
                                                        PATCH /api/projects/[id]/edit-proposals/[proposalId]
src/app/api/projects/[id]/duplicate/route.ts            POST /api/projects/[id]/duplicate
```

> **Tổng:** 42 file route ≈ 60 HTTP endpoint + 2 mini-service Socket.io (chat-service:3001, notification-service:3002).
> **Phiên bản tài liệu:** `API.md` v0.2.0 — đồng bộ với `package.json` version.
