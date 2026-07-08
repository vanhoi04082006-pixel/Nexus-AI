# 📚 NEXUS AI — Documentation

> Tài liệu chính thức của NEXUS AI v0.2.0 — Multi-Agent Project Architect.

---

## 📑 Mục lục

| File | Mô tả | Đối tượng |
|---|---|---|
| [**README.md**](../README.md) | Tổng quan dự án, Quick Start, scripts | Tất cả người dùng |
| [**ARCHITECTURE.md**](./ARCHITECTURE.md) | Kiến trúc modular AI (24 module), pipeline 8 phase, OpenRouter client | Developer, Architect |
| [**API.md**](./API.md) | Tham chiếu đầy đủ 58 endpoint + Socket.io events | Backend Developer |
| [**CONTRIBUTING.md**](./CONTRIBUTING.md) | Hướng dẫn đóng góp, code style, cách thêm Agent/Route/Model | Contributor |

---

## 🚀 Bắt đầu nhanh

### Yêu cầu
- **Bun** 1.x ([cài tại bun.sh](https://bun.sh))
- **Node.js** 20+ (cho Prisma)
- **OpenRouter API key** ([lấy miễn phí tại openrouter.ai/keys](https://openrouter.ai/keys))

### Cài đặt
```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
bun install
cp .env.example .env  # điền OPENROUTER_API_KEY
bun run db:push
bun run dev           # http://localhost:3000
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
| 04 | System Architect | `design` | DB schema, API endpoints, folder structure |
| 05 | UML Generator | `uml` | 4 diagram: Use Case, Class, ERD, Sequence |
| 06 | Technical Writer | `docs` | README, Coding Convention, API Standard |
| 07 | Git/DevOps | `git` | Git commands, branch strategy, CI/CD |
| 08 | Software Tester | `test` | Unit/Integration/E2E/API/Performance tests |
| 09 | Security Reviewer | `security` | Threats, OWASP Top 10, auth flow |
| 10 | Quality Reviewer | (merge) | Tổng hợp + Zod validation + feedback loop |

Chi tiết pipeline → [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## ⚙️ Pipeline (8 phase)

```
Phase 0: Planner Agent (pre-plan modules)
    ↓
Phase 1: analysis → hr → sprint (sequential)
    ↓
Phase 2: design + uml + docs + git (parallel)
    ↓
Phase 3: test + security (parallel)
    ↓
Phase 4: Retry failed agents (5s wait)
    ↓
Phase 5: Static fallback data (no crash)
    ↓
Phase 5.5: Output Normalizer + Consistency Checker
    ↓
Phase 6: Quality Reviewer (merge + Zod + feedback loop)
```

---

## 🛡️ Anti-rate-limit Features

| Feature | Mô tả |
|---|---|
| Multi-key rotation | Tự switch key khi 429 (hỗ trợ 100+ keys) |
| 60s wait cho 429 | Đợi đúng 60s (không spam) trước retry |
| Circuit Breaker | 3 fail liên tiếp → skip model 3 phút |
| Dead Model Recovery | All keys 429 → mark dead 2 phút, auto-recover |
| Health Score | Priority sort model theo success rate |
| Adaptive Timeout | Timeout riêng cho từng model |
| In-memory cache | Prompt cache 1h TTL (temp < 0.5) |
| Structured Outputs | `response_format: { type: "json_object" }` |

---

## 📁 Cấu trúc dự án

```
Nexus-AI/
├── src/
│   ├── app/              # Next.js App Router (42 API routes)
│   ├── components/       # UI (48 shadcn) + Nexus (14 + 13 tabs)
│   ├── lib/              # AI (24 module) + openrouter + schemas + ...
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
fly deploy
fly deploy -c fly.chat.toml  # chat-service
```

### Caddy + Tunnel
- Caddyfile cấu hình reverse proxy
- tunnel.conf chọn 1 trong 3 mode: `quick` / `cloudflare-named` / `ngrok`

Chi tiết → [README.md#deployment](../README.md#-deployment)

---

## 🤝 Đóng góp

Xem [CONTRIBUTING.md](./CONTRIBUTING.md) để biết:
- Code style + conventional commits
- Cách thêm AI Agent mới (9 bước)
- Cách thêm Model / API Route / shadcn component
- Zod lenient schemas (toString, toStringArray, toNumber)
- Live Log Console (AsyncLocalStorage)
- Testing checklist + PR checklist

---

## 📄 License

MIT — xem [LICENSE](../LICENSE)

## 🔗 Links

- [GitHub Repository](https://github.com/vanhoi04082006-pixel/Nexus-AI)
- [OpenRouter](https://openrouter.ai) — AI provider
- [Next.js 16](https://nextjs.org) — Framework
- [Prisma 6](https://prisma.io) — ORM
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Mermaid 11](https://mermaid.js.org) — Diagrams
- [Bun](https://bun.sh) — Runtime
