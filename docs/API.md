# 🔌 NEXUS AI — REST API Reference

> Toàn bộ 23 API endpoints. Base URL: `http://localhost:3000` (local) hoặc `https://xxx.trycloudflare.com` (tunnel).

## 📑 Mục lục

- [Authentication](#-authentication)
- [Projects](#-projects)
- [Pipeline Progress](#-pipeline-progress)
- [Initialize (Todolist)](#-initialize-todolist)
- [Refine](#-refine)
- [Tasks](#-tasks)
- [Chat](#-chat)
- [Edit Proposals](#-edit-proposals)
- [Sections](#-sections)
- [Members](#-members)
- [Mailbox](#-mailbox)
- [Context (Long-term Memory)](#-context-long-term-memory)
- [Tokens (Usage Logs)](#-tokens-usage-logs)
- [GitHub](#-github)
- [Config](#-config)
- [Error Responses](#-error-responses)

---

## 🔐 Authentication

Tất cả endpoints (trừ `/api/config`) yêu cầu `token` query parameter:

```
GET /api/projects/abc123?token=cmr3xyz456
```

| Token type | Source | Permissions |
|---|---|---|
| `leaderToken` | `Project.leaderToken` (cuid) | Full access (edit, refine, push GitHub, delete) |
| `inviteToken` | `Member.inviteToken` (cuid) | View + chat + update own tasks |

**Token truyền qua:**
- Query param: `?token=xxx`
- Chat service: `{ token }` trong `join` event (verify via HTTP call to API)

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

List tất cả projects (cho Home page).

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
      "leaderToken": "cmr3xyz456",
      "createdAt": "2024-07-01T10:00:00.000Z",
      "updatedAt": "2024-07-01T10:05:00.000Z",
      "_count": {
        "members": 3,
        "tasks": 12,
        "analyses": 7
      }
    }
  ]
}
```

---

### `POST /api/projects`

Tạo project mới + chạy 8-agent pipeline trong background.

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

**Response 500:**
```json
{ "error": "Failed to create project", "details": "..." }
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
    "memberId": null
  },
  "project": {
    "id": "cmr3abc123",
    "topic": "Hệ thống quản lý nhân sự",
    "description": "...",
    "status": "WORKSPACE",
    "leaderName": "Bùi Văn Hội",
    "leaderEmail": "leader@gmail.com",
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
    "git": { "gitCommands": "...", "branchStrategy": "...", "issueTemplate": "..." }
  },
  "members": [...],
  "tasks": [...],
  "chatMessages": [...],
  "editProposals": [...]
}
```

**Response 403:** Access denied (invalid token)
**Response 404:** Project not found

---

### `DELETE /api/projects/:id?token=xxx`

Xóa project (leader only). Xóa cascade: members, analyses, tasks, chat, proposals, emails, context, token logs.

**Response 200:**
```json
{ "success": true }
```

**Response 403:** Leader access required

---

## 📊 Pipeline Progress

### `GET /api/projects/:id/progress`

Poll pipeline progress (tạo project mới). Trả về ngay, không block.

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
  ],
  "logs": [
    {
      "id": "log-123",
      "ts": 1719800000000,
      "level": "info",
      "agentId": "01",
      "provider": "pipeline",
      "message": "[AGENT-01] Requirement Analyst → start (models: 5)"
    },
    {
      "id": "log-124",
      "ts": 1719800001000,
      "level": "info",
      "provider": "openrouter",
      "model": "openai/gpt-oss-120b:free",
      "keyIndex": 1,
      "message": "[OpenRouter] Key #1, model: openai/gpt-oss-120b:free"
    },
    ...
  ],
  "startedAt": 1719800000000
}
```

**Status values:**
- `running` — pipeline đang chạy
- `done` — pipeline hoàn tất (có `result`)
- `error` — pipeline fail (có `error`)

**Response 404:**
```json
{ "status": "unknown", "message": "Khong tim thay tien do. Co the da het han." }
```
> Progress expire sau 5 phút. Client detect 404 → check project status.

---

## 🚀 Initialize (Todolist)

### `POST /api/projects/:id/initialize?token=xxx`

Sinh todolist (Kanban) qua AI. Leader only. Xóa task cũ (clean slate).

**Request body:** `{}` (empty)

**Response 200:**
```json
{ "started": true }
```

> Client polls `GET /api/projects/:id/initialize/progress` mỗi 2.5s.

---

### `GET /api/projects/:id/initialize/progress`

Poll init progress + logs.

**Response 200:**
```json
{
  "projectId": "cmr3abc123",
  "status": "running",
  "message": "Dang sinh todolist...",
  "logs": [
    {
      "id": "log-1",
      "ts": 1719800000000,
      "level": "info",
      "agentId": "TASK",
      "provider": "pipeline",
      "message": "▶ INIT STARTED — project: \"Hệ thống quản lý nhân sự\" — 3 member(s)"
    },
    {
      "id": "log-2",
      "ts": 1719800001000,
      "level": "info",
      "agentId": "TASK",
      "provider": "pipeline",
      "message": "👤 Nguyen Van A → vai trò: Frontend Developer · module: UI, Notification"
    },
    {
      "id": "log-3",
      "ts": 1719800010000,
      "level": "success",
      "agentId": "TASK",
      "provider": "pipeline",
      "message": "✓ Sinh task cho Nguyen Van A: Thiết kế layout chính"
    }
  ],
  "startedAt": 1719800000000
}
```

**Status values:** `running` | `done` (có `taskCount`) | `error` (có `error`)

---

## 🔄 Refine

### `POST /api/projects/:id/refine?token=xxx`

AI Refine — sinh lại tất cả 7 sections dựa trên chat + edit requests. Leader only.

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

**Response 200:**
```json
{ "started": true }
```

---

### `GET /api/projects/:id/refine/progress`

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
    "git": false
  },
  "logs": [
    {
      "id": "log-1",
      "ts": 1719800000000,
      "level": "info",
      "agentId": "REFINE",
      "provider": "pipeline",
      "message": "▶ AI REFINE STARTED — 7 sections to re-generate"
    },
    {
      "id": "log-2",
      "ts": 1719800001000,
      "level": "info",
      "agentId": "REFINE",
      "provider": "pipeline",
      "message": "📝 Leader edit request [analysis]: Thêm feature export Excel"
    },
    {
      "id": "log-3",
      "ts": 1719800002000,
      "level": "info",
      "agentId": "REFINE",
      "provider": "pipeline",
      "message": "🔧 [REFINE] Phân tích (analysis) → đang đọc nội dung hiện tại + yêu cầu chỉnh sửa..."
    },
    {
      "id": "log-4",
      "ts": 1719800010000,
      "level": "success",
      "agentId": "REFINE",
      "provider": "pipeline",
      "model": "openai/gpt-oss-120b:free",
      "message": "✓ [REFINE] Phân tích → đã chỉnh sửa xong (openai/gpt-oss-120b:free)"
    }
  ],
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
      "dependencies": "Can setup project xong truoc",
      "acceptanceCriteria": "...",
      "deadline": "2024-07-08T00:00:00.000Z",
      "sprintName": "Sprint 1",
      "status": "todo",
      "hours": 8,
      "priority": "P0",
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

**Response 200:**
```json
{
  "task": {
    "id": "cmr3task1",
    "status": "in_progress",
    ...
  }
}
```

**Response 400:** Invalid status
**Response 403:** You can only update your own tasks
**Response 404:** Task not found

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

Post a chat message (cũng broadcast qua Socket.io nếu đang chạy).

**Request body:**
```json
{
  "message": "Mình bắt đầu làm nhé",
  "authorName": "Bùi Văn Hội",
  "authorRole": "leader"
}
```

**Response 200:**
```json
{
  "message": {
    "id": "cmr3msg1",
    "authorName": "Bùi Văn Hội",
    "authorRole": "leader",
    "message": "Mình bắt đầu làm nhé",
    "createdAt": "2024-07-01T10:00:00.000Z"
  }
}
```

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

**Response 500:**
```json
{ "error": "AI khong phan hoi duoc" }
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

**Response 200:**
```json
{
  "proposal": {
    "id": "cmr3prop1",
    "section": "analysis",
    "requestedChange": "Thêm feature export Excel",
    "status": "PENDING",
    ...
  }
}
```

---

### `PUT /api/projects/:id/edit-proposals/:proposalId?token=xxx`

Leader approve / reject proposal.

**Request body:**
```json
{ "status": "APPROVED" }
```

**Valid statuses:** `APPROVED` | `REJECTED`

**Response 200:**
```json
{
  "proposal": {
    "id": "cmr3prop1",
    "status": "APPROVED",
    ...
  }
}
```

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

> Version tự động bumped mỗi lần update.

---

## 👥 Members

### `GET /api/projects/:id/members?token=xxx`

List members (chỉ leader thấy inviteToken).

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
      "inviteToken": "cmr3token1",  // only for leader
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

**Response 200:**
```json
{
  "member": {
    "id": "cmr3member2",
    "name": "Nguyen Van B",
    ...
  }
}
```

---

## 📬 Mailbox

### `GET /api/projects/:id/mailbox?token=xxx`

List emails đã gửi (cho Mailbox tab).

**Response 200:**
```json
{
  "emails": [
    {
      "id": "cmr3email1",
      "toEmail": "a@example.com",
      "toName": "Nguyen Van A",
      "subject": "NEXUS AI — Lời mời tham gia dự án",
      "body": "Chào Nguyen Van A, ...",
      "type": "INVITATION",
      "sentAt": "2024-07-01T10:00:00.000Z"
    }
  ]
}
```

**Email types:** `INVITATION` | `TASK_ASSIGNED` | `REMINDER`

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

## 🔌 GitHub

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

**Response 400:**
```json
{ "error": "GitHub not connected" }
```

**Files pushed (15+):**
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

## ⚙️ Config

### `GET /api/config`

Get public URL config (cho email link).

**Response 200:**
```json
{
  "publicUrl": "https://xxx.trycloudflare.com"
}
```

> Nếu không có `.public-url` file → fallback `http://localhost:3000`.

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
| `404` | Not Found | Project / task / proposal not found |
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
| `OPENROUTER_API_KEY khong hop le` | Invalid API key | Check `.env` |
| `GitHub not connected` | No OAuth token | Connect GitHub first |

---

<p align="center">
  <strong>NEXUS AI API</strong> — 23 REST endpoints
</p>
