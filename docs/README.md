# 📚 NEXUS AI — Documentation

> Tài liệu chính thức của **NEXUS AI v0.3.0** — Multi-Agent Project Architect.
> Hệ thống 10 AI Agents chạy pipeline 8 phase, sinh output đầy đủ cho project phần mềm (analysis → HR → sprint → design → UML → docs → git → test → security → merge).

---

## 📑 Mục lục

| File | Mô tả | Đối tượng |
|---|---|---|
| [**README.md**](../README.md) | Tổng quan dự án, Quick Start, scripts, deployment | Tất cả người dùng |
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | Kiến trúc modular AI (24 module), pipeline 8 phase, split architecture, OpenRouter client | Developer, Architect |
| [**API.md**](./API.md) | Tham chiếu đầy đủ **58 endpoint** REST + Socket.io events | Backend Developer |
| [**CONTRIBUTING.md**](./CONTRIBUTING.md) | Hướng dẫn đóng góp, code style, cách thêm Agent/Route/Model, Zod lenient schemas | Contributor |
| [**CHANGELOG.md**](../CHANGELOG.md) | Lịch sử phiên bản (Keep a Changelog format) | Mọi người |

> 📌 Mọi file docs trong `docs/` đều dùng **tiếng Việt** làm ngôn ngữ chính, code example bằng TypeScript.

---

## 🚀 Bắt đầu nhanh

### Yêu cầu
- **Bun** 1.x ([cài tại bun.sh](https://bun.sh))
- **Node.js** 20+ (cho Prisma generate)
- **OpenRouter API key** ([lấy miễn phí tại openrouter.ai/keys](https://openrouter.ai/keys))
- (Tùy chọn) **GitHub OAuth App** để push project → repo

### Cài đặt
```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
bun install
cp .env.example .env          # điền OPENROUTER_API_KEY + GITHUB_TOKEN_ENCRYPTION_KEY
bun run db:push               # tạo SQLite schema
bun run dev                   # http://localhost:3000
```

### Tunnel (public URL)
```cmd
:: Windows
run

:: Linux/Mac
bash scripts/run-local.sh
```

Xem [tunnel.conf](../tunnel.conf) để cấu hình URL cố định (Cloudflare/ngrok).

---

## 🤖 10 AI Agents

| # | Agent | Section | Mô tả |
|---|---|---|---|
| 01 | Requirement Analyst | `analysis` | Phân tích chủ đề → tech stack, features, actors, modules |
| 02 | HR Planner | `hr` | Phân vai trò cho từng thành viên |
| 03 | Sprint Planner | `sprint` | Chia sprint 2 tuần, gán task, deadline |
| 04 | System Architect | `design` ⚡split | DB schema, API endpoints, folder structure |
| 05 | UML Generator | `uml` ⚡split | 4 diagram: Use Case, Class, ERD, Sequence |
| 06 | Technical Writer | `docs` ⚡split | README, Coding Convention, API Standard |
| 07 | Git/DevOps | `git` | Git commands, branch strategy, CI/CD |
| 08 | Software Tester | `test` | Unit/Integration/E2E/API/Performance tests |
| 09 | Security Reviewer | `security` | Threats, OWASP Top 10, auth flow |
| 10 | Quality Reviewer | (merge) | Tổng hợp + Zod validation + feedback loop |

> ⚡ **split** = agent được tách thành 3 sub-task (Single Responsibility) — xem [Split Architecture](#-split-architecture) bên dưới.

Chi tiết pipeline → [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## ⚙️ Pipeline (8 phase)

```
Phase 0: Planner Agent (pre-plan modules)
    ↓
Phase 1: analysis → hr → sprint (sequential)
    ↓
Phase 2: design⚡ + uml⚡ + docs⚡ + git (parallel — split agents)
    ↓
Phase 3: test + security (parallel)
    ↓
Phase 4: Retry failed agents (5s wait)
    ↓
Phase 5: Static fallback data (no crash)
    ↓
Phase 5.5: Output Normalizer + Consistency Checker + Self-Healing Mermaid
    ↓
Phase 6: Quality Reviewer (merge + Zod + feedback loop)
```

---

## 🧩 Split Architecture

**v0.3.0** giới thiệu **Split Prompt + Merge Output**: 3 agent phức tạp (`design`, `uml`, `docs`) được tách thành **3 sub-task** nhỏ, mỗi sub-task có prompt riêng (Single Responsibility) → chạy song song → merge kết quả.

### Tại sao cần split?
- Prompt quá dài → AI bị mất focus, skip section, sinh JSON thiếu field
- Một call fail nguyên cả agent → fallback toàn bộ → mất công sức
- Quality output thấp vì agent phải làm quá nhiều việc cùng lúc

### Bảng split

| Agent | Sub-task 1 | Sub-task 2 | Sub-task 3 | Merge output |
|---|---|---|---|---|
| **Design** | DB schema | API endpoints | Architecture | `{ dbTables, apiEndpoints, folderStructure, architectureDesc }` |
| **UML** | Use Case | Class + ERD | Sequence | `{ useCase, classDiagram, erd, sequence }` |
| **Docs** | README | Coding Convention | API Standard | `{ readme, codingConvention, apiStandard }` |

### Sub-task validation
Mỗi sub-task có **Zod schema riêng** với `.refine()` validation (ví dụ Mermaid phải bắt đầu bằng `classDiagram`, `erDiagram`, `sequenceDiagram`). Nếu 1 sub-task fail → chỉ sub-task đó fallback, các sub-task khác vẫn dùng được → output tổng vẫn đầy đủ.

Xem implement: [`src/lib/ai/pipeline/index.ts`](../src/lib/ai/pipeline/index.ts) — hàm `runSplitDesign`, `runSplitUML`, `runSplitDocs`.

---

## 🛡️ Anti-rate-limit Features

| Feature | Mô tả |
|---|---|
| Multi-key rotation | Tự switch key khi 429 (hỗ trợ 100+ keys) |
| 60s wait cho 429 | Đợi đúng 60s (không spam) trước retry |
| Circuit Breaker | 3 fail liên tiếp → skip model 3 phút |
| Dead Model Recovery | All keys 429 → mark dead 2 phút, auto-recover |
| Health Score | Priority sort model theo success rate (preserved across restarts) |
| Adaptive Timeout | Timeout riêng cho từng model |
| In-memory cache | Prompt cache 1h TTL (temp < 0.5) |
| Structured Outputs | `response_format: { type: "json_object" }` |
| Self-Healing Mermaid | `cleanMermaidSyntax` + `healUMLData` auto-fix Mermaid syntax |

---

## 📁 Cấu trúc dự án

```
Nexus-AI/
├── src/
│   ├── app/              # Next.js App Router (42 API routes → 58 endpoints)
│   ├── components/       # UI (48 shadcn) + Nexus (14 view + 13 tabs)
│   │   └── nexus/
│   │       ├── MermaidLoader.tsx       # Client component (fix removeChild)
│   │       ├── KnowledgeBaseView.tsx   # NEW v0.3.0
│   │       ├── WorkflowView.tsx        # NEW v0.3.0
│   │       ├── SettingsView.tsx        # NEW v0.3.0
│   │       └── IntegrationsView.tsx    # NEW v0.3.0
│   ├── lib/              # AI (24 module) + openrouter + schemas + ...
│   │   ├── schemas.ts                  # Zod schemas + Mermaid .refine()
│   │   ├── rate-limit.ts               # Rate limiting (NEW v0.3.0)
│   │   ├── sanitize.ts                 # XSS sanitization (NEW v0.3.0)
│   │   └── github-oauth.ts             # OAuth nonce (NEW v0.3.0)
│   ├── store/            # Zustand
│   └── hooks/
├── prisma/schema.prisma  # 23 models (SQLite)
├── mini-services/        # chat (3001) + notification (3002)
├── scripts/              # run-local.bat/.sh + deploy-fly.sh
├── docs/                 # ← bạn đang ở đây
├── Dockerfile, fly.toml, Caddyfile, tunnel.conf
└── package.json
```

---

## 🔌 Mini-services

| Service | Port | Tech | Vai trò |
|---|---|---|---|
| **chat-service** | 3001 | Socket.io | Realtime chat giữa thành viên |
| **notification-service** | 3002 | Socket.io | Realtime notifications broadcast |

Xem [mini-services/chat-service/README.md](../mini-services/chat-service/README.md) và [mini-services/notification-service/README.md](../mini-services/notification-service/README.md).

---

## 🐳 Deployment

### Docker
```bash
docker build -t nexus-ai .
docker run -p 3000:3000 --env-file .env nexus-ai
```

### Fly.io
```bash
fly deploy                       # Next.js app
fly deploy -c fly.chat.toml      # chat-service
```

### Caddy + Tunnel
- Caddyfile cấu hình reverse proxy + auto HTTPS
- tunnel.conf chọn 1 trong 3 mode: `quick` / `cloudflare-named` / `ngrok`

Chi tiết → [README.md#deployment](../README.md#-deployment)

---

## 🔐 Security (v0.3.0)

| Layer | Cơ chế |
|---|---|
| **Rate Limiting** | In-memory token bucket per IP + per route |
| **OAuth nonce** | GitHub OAuth dùng state nonce chống CSRF |
| **AES-256-GCM** | GitHub access token encrypt trước khi lưu DB (`GITHUB_TOKEN_ENCRYPTION_KEY`) |
| **XSS sanitization** | Tất cả input người dùng đi qua `sanitize()` trước khi render |

---

## 🤝 Đóng góp

Xem [CONTRIBUTING.md](./CONTRIBUTING.md) để biết:
- Code style + conventional commits
- Cách thêm AI Agent mới (9 bước)
- Cách thêm Model / API Route / shadcn component
- Zod lenient schemas (toString, toStringArray, toNumber) + Mermaid `.refine()`
- Live Log Console (AsyncLocalStorage)
- Testing checklist + PR checklist

---

## 📄 License

MIT — xem [LICENSE](../LICENSE)

## 🔗 Links

- [GitHub Repository](https://github.com/vanhoi04082006-pixel/Nexus-AI)
- [Changelog](../CHANGELOG.md)
- [OpenRouter](https://openrouter.ai) — AI provider
- [Next.js 16](https://nextjs.org) — Framework
- [Prisma 6](https://prisma.io) — ORM
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Mermaid 11](https://mermaid.js.org) — Diagrams
- [Bun](https://bun.sh) — Runtime
