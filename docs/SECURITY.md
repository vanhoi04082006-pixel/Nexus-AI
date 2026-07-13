# 🔐 NEXUS AI — Security Documentation

> Tài liệu bảo mật cho **NEXUS AI v0.3.0** — Multi-Agent Project Architect.
> Mọi layer (auth, XSS, IDOR, SMTP, OAuth, rate-limit, validation, error handling) được implement
> theo nguyên tắc **defense-in-depth** (nhiều lớp bảo vệ độc lập).
>
> **Source files:**
> - [`src/lib/access.ts`](../src/lib/access.ts) — `resolveAccess` + `requireLeader`
> - [`src/lib/sanitize.ts`](../src/lib/sanitize.ts) — DOMPurify + `stripCrlf`
> - [`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts) — In-memory token bucket
> - [`src/lib/github-oauth.ts`](../src/lib/github-oauth.ts) — Nonce + AES-256-GCM
> - [`src/lib/schemas.ts`](../src/lib/schemas.ts) — Zod + `.refine()`
> - [`src/lib/error.ts`](../src/lib/error.ts) + [`src/components/ErrorBoundary.tsx`](../src/components/ErrorBoundary.tsx)

---

## 📑 Mục lục

1. [Authentication (Leader + Member token)](#1-authentication-leader--member-token)
2. [Authorization (requireLeader)](#2-authorization-requireleader)
3. [XSS Protection (DOMPurify)](#3-xss-protection-dompurify)
4. [IDOR Protection (Mailbox/Attachments)](#4-idor-protection-mailboxattachments)
5. [SMTP Header Injection](#5-smtp-header-injection)
6. [GitHub OAuth (Nonce + AES-256-GCM)](#6-github-oauth-nonce--aes-256-gcm)
7. [Rate Limiting](#7-rate-limiting)
8. [Input Validation (Zod)](#8-input-validation-zod)
9. [Error Handling (Production-safe)](#9-error-handling-production-safe)
10. [Environment Variables Security](#10-environment-variables-security)

---

## 1. Authentication (Leader + Member token)

NEXUS AI không dùng JWT/session truyền thống. Thay vào đó, mỗi project có **2 loại token**:

| Token | Sinh khi nào | Quyền |
|---|---|---|
| `leaderToken` | `Project.create()` → `@default(cuid())` | **Full access** — edit section, invite member, push GitHub, delete project |
| `member.inviteToken` | `Member.create()` → `@default(cuid())` | **View + chat** — xem project, chat, propose edit (leader phải approve) |

### `resolveAccess(projectId, token)` — Helper dùng ở mọi API route

```ts
// src/lib/access.ts
export async function resolveAccess(
  projectId: string,
  token?: string | null
): Promise<AccessInfo | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });
  if (!project) return null;

  // Leader token
  if (token && token === project.leaderToken) {
    return { role: "leader", projectId, name: project.leaderName, email: project.leaderEmail };
  }

  // Member token
  if (token) {
    const member = project.members.find((m) => m.inviteToken === token);
    if (member) {
      // Mark joinedAt (chỉ 1 lần đầu)
      if (!member.joinedAt) {
        await db.member.update({ where: { id: member.id }, data: { joinedAt: new Date() } });
        await logActivity({ /* MEMBER_JOINED */ });
      }
      return { role: "member", projectId, memberId: member.id, name: member.name, email: member.email };
    }
  }

  // No match → deny
  return null;
}
```

### Token truyền qua URL query (`?token=...`)

Lý do: NEXUS AI dùng email invite link (Mailbox system) → URL query là cách đơn giản nhất cho member click-to-join. Trade-off: token xuất hiện trong access log của reverse proxy (Caddy/Fly). Giải pháp:

- Token là `cuid()` (26 ký tự, không guessable)
- Member có thể regenerate token (leader invite lại)
- URL log rotation định kỳ

---

## 2. Authorization (requireLeader)

Mọi **write operation** (edit section, delete project, push GitHub, send mail, approve proposal...) đều kiểm tra:

```ts
import { resolveAccess, requireLeader } from "@/lib/access";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) return Response.json({ error: "Access denied" }, { status: 403 });

  // ✅ Chỉ leader mới được edit
  if (!requireLeader(access)) {
    return Response.json({ error: "Leader only" }, { status: 403 });
  }

  // ... write logic
}
```

### Bảng quyền

| Action | Leader | Member |
|---|:---:|:---:|
| View project + sections | ✅ | ✅ |
| Chat (send message) | ✅ | ✅ |
| Read mailbox (own inbox) | ✅ | ✅ |
| Download attachment (own mail) | ✅ | ✅ |
| Edit section (analysis, hr, sprint, design, uml, docs, git) | ✅ | ❌ (chỉ propose edit) |
| Approve / reject edit proposal | ✅ | ❌ |
| Invite member | ✅ | ❌ |
| Send mail (compose) | ✅ | ❌ |
| Push GitHub | ✅ | ❌ |
| Delete project | ✅ | ❌ |
| Configure AI agent (model, temp) | ✅ | ❌ |
| Download ANY attachment (any mail) | ✅ | ❌ (chỉ mail của mình) |

---

## 3. XSS Protection (DOMPurify)

Mọi HTML render qua `dangerouslySetInnerHTML` đều đi qua `sanitizeHtml()`:

```ts
// src/lib/sanitize.ts
import DOMPurify from "dompurify";

const HTML_PROFILE = {
  ALLOWED_TAGS: ["p", "br", "h1"-"h6", "ul", "ol", "li", "strong", "em", "code",
                 "pre", "table", "thead", "tbody", "tr", "th", "td", "a", "img",
                 "blockquote", "details", "summary", "figure", "figcaption", /* ... */],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "id", "width", "height",
                 "colspan", "rowspan", "target", "rel", "datetime", "style"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "object", "embed", "iframe", "form", "input", "button",
                "textarea", "select", "style", "link", "meta", "base"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onmouseout",
                "onfocus", "onblur", "onsubmit", "javascript"],
  ADD_ATTR: ["target"],  // force rel=noopener noreferrer trên target=_blank
};

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  try {
    return DOMPurify.sanitize(dirty, HTML_PROFILE);
  } catch {
    // SSR fallback (no window): escape everything
    return dirty.replace(/&/g, "&amp;").replace(/</g, "&lt;") /* ... */;
  }
}
```

### Áp dụng ở đâu?

| Component | Sử dụng |
|---|---|
| **DocsTab** | Render Markdown → HTML từ Agent 06 (`readme`, `convention`, `apiStandard`) |
| **MailboxTab** | Render email body (`bodyHtml`) từ user compose hoặc AI rewrite |
| **AnalysisTab / DesignTab / UMLTab** | Render Mermaid diagram (sau khi sanitize) |

```tsx
// Example usage
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.bodyHtml) }} />
```

### Escaping text context

Khi insert untrusted text vào HTML string (không phải HTML context), dùng `escapeHtml()`:

```ts
import { escapeHtml } from "@/lib/sanitize";
const safe = escapeHtml(userInput);  // & < > " ' → entities
```

---

## 4. IDOR Protection (Mailbox/Attachments)

**IDOR** (Insecure Direct Object Reference) — user có quyền truy cập project nhưng **không có quyền** truy cập resource cụ thể trong project đó.

### Vulnerability (v0.2.x)

```ts
// ❌ Cũ: bất kỳ member nào cũng download được attachment bất kỳ
const att = await db.emailAttachment.findUnique({ where: { id: attId } });
return new Response(att.content);
```

### Fix (v0.3.0)

```ts
// src/app/api/projects/[id]/mailbox/attachments/[attId]/route.ts
const access = await resolveAccess(id, token);
if (!access) return Response.json({ error: "Access denied" }, { status: 403 });

const att = await db.emailAttachment.findUnique({ where: { id: attId } });
if (!att) return Response.json({ error: "Not found" }, { status: 404 });

// Verify attachment's email belongs to THIS project
const email = await db.email.findUnique({
  where: { id: att.emailId },
  select: { projectId: true, fromEmail: true, toEmails: true, ccEmails: true, bccEmails: true },
});
if (!email || email.projectId !== id) {
  return Response.json({ error: "Not found" }, { status: 404 });
}

// ✅ FIX IDOR: caller phải là recipient hoặc sender
const isLeader = access.role === "leader";
const userEmail = (access.email || access.name).toLowerCase();
const parseArr = (raw: string): string[] => { /* JSON.parse safe */ };
const recipients = [
  email.fromEmail,
  ...parseArr(email.toEmails),
  ...parseArr(email.ccEmails),
  ...parseArr(email.bccEmails),
].map((e) => e.toLowerCase());
if (!isLeader && !recipients.includes(userEmail)) {
  return Response.json({ error: "Bạn không có quyền tải file đính kèm này" }, { status: 403 });
}
```

### Bonus: Safe Content-Type

```ts
// ✅ Force safe MIME type → chống XSS qua SVG/HTML attachment
const SAFE_MIME_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp",
  "text/plain", "application/zip", /* Office docs */
]);
const safeMimeType = SAFE_MIME_TYPES.has(att.mimeType) ? att.mimeType : "application/octet-stream";
return new Response(buffer, {
  headers: {
    "Content-Type": safeMimeType,
    "Content-Disposition": `attachment; filename="${encodeURIComponent(att.filename)}"`,
    "X-Content-Type-Options": "nosniff",  // ✅ prevent MIME sniffing
  },
});
```

---

## 5. SMTP Header Injection

Email header injection xảy ra khi user input chứa CRLF (`\r\n`) → attacker chèn thêm header (BCC, custom subject) hoặc email body.

### Fix — `stripCrlf()` cho mọi email field

```ts
// src/lib/sanitize.ts
export function stripCrlf(s: unknown): string {
  return String(s ?? "").replace(/[\r\n]/g, "");
}
```

```ts
// src/lib/email.ts — sử dụng structured from + stripCrlf
const transporter = await getTransporter(projectId);
await transporter.sendMail({
  from: `"${stripCrlf(project.leaderName)}" <${stripCrlf(project.leaderEmail)}>`,  // ✅
  to: stripCrlf(args.toEmail),                                                    // ✅
  subject: stripCrlf(args.subject),                                               // ✅
  text: args.body,  // body có thể có \n (không strip)
});
```

### Structured `from` field

```ts
// ❌ Sai — string concat → dễ injection nếu name có ", <"
from: `${project.leaderName} <${project.leaderEmail}>`

// ✅ Đúng — structured object + stripCrlf
from: { name: stripCrlf(project.leaderName), address: stripCrlf(project.leaderEmail) }
// hoặc
from: `"${stripCrlf(project.leaderName)}" <${stripCrlf(project.leaderEmail)}>`
```

---

## 6. GitHub OAuth (Nonce + AES-256-GCM)

### Vulnerability (v0.2.x)

```ts
// ❌ Cũ: state = projectId|leaderToken → lộ token qua redirect URL
const state = `${projectId}|${leaderToken}`;
const authUrl = `https://github.com/login/oauth/authorize?...&state=${state}`;
```

### Fix 1 — Nonce state (chống CSRF + token reuse)

```ts
// src/lib/github-oauth.ts
const nonces = new Map<string, { projectId, leaderToken, createdAt }>();
const NONCE_TTL = 10 * 60 * 1000;  // 10 minutes

export function createOauthState(projectId: string, leaderToken: string): string {
  const nonce = crypto.randomBytes(32).toString("hex");  // 64-char hex
  nonces.set(nonce, { projectId, leaderToken, createdAt: Date.now() });
  return nonce;
}

export function consumeOauthState(state: string): OauthContext | null {
  const ctx = nonces.get(state);
  if (!ctx) return null;
  if (Date.now() - ctx.createdAt > NONCE_TTL) { nonces.delete(state); return null; }
  nonces.delete(state);  // ✅ One-time use — delete after read (chống replay)
  return ctx;
}
```

### Fix 2 — AES-256-GCM encrypt token at rest

GitHub access token lưu DB dưới dạng **encrypted** (`Project.githubToken`). DB leak → attacker không đọc được token.

```ts
// src/lib/github-oauth.ts
const ENCRYPTION_KEY = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || "";

function getKey(): Buffer {
  if (ENCRYPTION_KEY) {
    return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();  // 32 bytes
  }
  // Dev fallback (NOT secure for production)
  if (process.env.NODE_ENV === "production") {
    console.warn("WARNING: GITHUB_TOKEN_ENCRYPTION_KEY not set in production");
  }
  return crypto.createHash("sha256").update("nexus-ai-dev-key-not-secure").digest();
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);  // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(encrypted: string): string | null {
  if (!encrypted || !encrypted.includes(":")) return encrypted;  // legacy (not encrypted)
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}
```

**Format:** `iv:authTag:ciphertext` (hex) — `authTag` đảm bảo tính toàn vẹn (tamper detection).

---

## 7. Rate Limiting

In-memory token bucket — không cần Redis, phù hợp single-instance.

```ts
// src/lib/rate-limit.ts
export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) return false;  // rate-limited
  bucket.count++;
  return true;
}
```

### Routes có rate limit

| Route | Key | Max | Window | Lý do |
|---|---|---|---|---|
| `POST /api/projects/[id]/fix-mermaid` | `fix-mermaid:${access.email}` | **5** | 60s | LLM call đắt — chống spam |
| `POST /api/projects/[id]/chat/ai` | `chat-ai:${access.email}` | **10** | 60s | LLM call cho chat |
| `POST /api/projects/[id]/mailbox/ai-rewrite` | `ai-rewrite:${access.email}` | **10** | 60s | LLM rewrite email body |

### Response khi rate-limited

```ts
if (!rateLimit(rlKey, RL_MAX, RL_WINDOW)) {
  return Response.json(
    { error: "Too many requests", retryAfter: 60 },
    { status: 429, headers: rateLimitHeaders(rlKey, RL_MAX, RL_WINDOW) }
  );
}
// Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

### Cleanup

Bucket expired được dọn mỗi 5 phút (chống memory leak):

```ts
let lastCleanup = Date.now();
function cleanupExpired(): void {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;  // 5 min
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}
```

> 📌 **Multi-instance:** Cần thay bằng Upstash Redis hoặc Cloudflare KV (rate-limit.ts đã có comment chỉ dẫn).

---

## 8. Input Validation (Zod)

Mọi AI output + user input đều validate qua **Zod schemas** với preprocessor lenient + `.refine()` strict.

### Lenient preprocessors (chấp nhận AI output biến thể)

```ts
// src/lib/schemas.ts
const toString = z.preprocess((v) => {
  if (Array.isArray(v)) return v.join(", ");   // AI hay trả array thay string
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}, z.string());

const toStringArray = z.preprocess((v) => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  return [];
}, z.array(z.string()));

const toNumber = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v); if (!isNaN(n)) return n; }
  return 0;
}, z.number());
```

### `.refine()` cho Mermaid diagrams

```ts
classDiagram: z.string().refine(
  (s) => s.trim().startsWith("classDiagram"),
  "classDiagram must start with 'classDiagram'"
);
erd: z.string().refine(
  (s) => s.trim().startsWith("erDiagram"),
  "erd must start with 'erDiagram'"
);
sequence: z.string().refine(
  (s) => s.trim().startsWith("sequenceDiagram"),
  "sequence must start with 'sequenceDiagram'"
);
```

→ Nếu AI trả `classDiagram` không bắt đầu bằng keyword đúng → schema fail → fallback + Self-Healing Mermaid auto-fix.

### Validation flow

```
AI JSON output
    ↓ Zod preprocess (toString / toStringArray / toNumber)
    ↓ Zod object schema (analysisSchema, hrSchema, ...)
    ↓ .refine() (Mermaid syntax)
    ↓
✅ Pass → save to DB
❌ Fail → fallback static data + log warning
```

---

## 9. Error Handling (Production-safe)

### Nguyên tắc: **không bao giờ leak internal error ra client**

```ts
// ❌ Sai (v0.2.x) — leak stack trace
return Response.json({ error: err.message, stack: err.stack }, { status: 500 });

// ✅ Đúng (v0.3.0) — production-safe
return Response.json(
  { error: "Internal server error", requestId: crypto.randomUUID() },
  { status: 500 }
);
// Log stack chỉ ở server:
console.error("[API] route error:", err);
```

### ErrorBoundary (React component)

```tsx
// src/components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to monitoring (Sentry, Datadog, etc.) — không leak ra UI
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} reset={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

### Global error pages

| File | Vai trò |
|---|---|
| `src/app/error.tsx` | Next.js App Router error boundary (route-level) |
| `src/app/global-error.tsx` | Global error boundary (root layout level) |
| `src/app/not-found.tsx` | 404 page |
| `src/app/loading.tsx` | Loading skeleton |
| `src/components/ErrorBoundary.tsx` | React class component error boundary |

---

## 10. Environment Variables Security

### `.env` in `.gitignore`

```gitignore
# .gitignore
.env
.env.local
.env.*.local
.public-url      # tunnel URL (chứa public URL — không commit)
*.db             # SQLite database
db/*.db
```

### SMTP password stripped từ Zustand persist

```ts
// src/store/useNexus.ts — partialize để KHÔNG persist SMTP password
import { persist } from "zustand/middleware";

export const useNexus = create(
  persist(
    (set, get) => ({
      project: null,
      leaderSmtpPassword: "",  // runtime only
      // ...
    }),
    {
      name: "nexus-storage",
      partialize: (state) => ({
        // ✅ Strip SMTP password khỏi localStorage
        project: state.project
          ? { ...state.project, leaderSmtpPassword: undefined }
          : null,
        // Chỉ persist những field cần thiết
      }),
    }
  )
);
```

### Environment variables table

| Variable | Required | Description | Stored where |
|---|:---:|---|---|
| `DATABASE_URL` | ✅ | `file:./db/custom.db` (dev) / `file:/data/custom.db` (prod) | `.env` |
| `OPENROUTER_API_KEY` | ✅ | API key(s) — comma-separated cho multi-key rotation | `.env` |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | ✅ (prod) | Passphrase for AES-256-GCM (hash → 32 bytes) | `.env` |
| `GITHUB_CLIENT_ID` | ❌ | GitHub OAuth App client ID | `.env` |
| `GITHUB_CLIENT_SECRET` | ❌ | GitHub OAuth App client secret | `.env` |
| `NEXT_PUBLIC_APP_URL` | ❌ | Public URL (override `.public-url` file) | `.env` |
| `SMTP_HOST` / `SMTP_PORT` | ❌ | SMTP server (Gmail: `smtp.gmail.com:465`) | `.env` |

### Production checklist

- [ ] `GITHUB_TOKEN_ENCRYPTION_KEY` đã set (random 32+ char string)
- [ ] `OPENROUTER_API_KEY` có ít nhất 2 key (multi-key rotation)
- [ ] `.env` **không** commit lên git (`git status` clean)
- [ ] `db/custom.db` **không** commit (chứa user data)
- [ ] `NODE_ENV=production` → tắt verbose logging
- [ ] CORS: chỉ allow domain của app (Caddy reverse proxy config)
- [ ] HTTPS: Caddy auto HTTPS hoặc Fly.io force_https = true
- [ ] Rate limit headers (`X-RateLimit-*`) trả về client
- [ ] Error response không leak stack trace

---

## 🔗 Liên kết

- [Deployment guide](./DEPLOYMENT.md) — bảo mật production
- [Architecture overview](./ARCHITECTURE.md)
- [Contributing (security checklist)](./CONTRIBUTING.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) — reference
