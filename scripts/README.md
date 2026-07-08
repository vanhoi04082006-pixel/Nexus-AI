# 📜 NEXUS AI — Scripts

> Các script hỗ trợ dev/deploy/tunnel.

---

## 📋 Danh sách

| File | OS | Mô tả |
|---|---|---|
| `run-local.bat` | Windows | Chạy Next.js + tunnel (gọi từ `run.cmd` ở root) |
| `run-local.sh` | Linux/Mac | Tương đương `.bat` cho Unix |
| `run-local.ps1` | Windows | PowerShell version (thay thế `.bat` nếu cần) |
| `parse-tunnel-url.ps1` | Windows | Parse URL từ output Cloudflare quick tunnel |
| `push-to-github.js` | Cross | Script Node.js push code lên GitHub (dùng trong CI) |
| `deploy-fly.sh` | Linux/Mac | Deploy lên Fly.io (main app + chat-service) |
| `auto-restart.sh` | Linux/Mac | Auto-restart dev server khi crash (cho production staging) |

---

## 🚀 Cách dùng

### `run` (Windows) / `bash scripts/run-local.sh` (Linux/Mac)

Khởi động toàn bộ hệ thống: check env → install deps → check DB → start Next.js + tunnel.

```cmd
:: Windows — gõ từ project root
run

:: Linux/Mac
bash scripts/run-local.sh
```

**Tunnel modes** (cấu hình trong `tunnel.conf`):
- `quick` — URL random (mặc định, đổi mỗi lần chạy)
- `cloudflare-named` — URL cố định (cần domain Cloudflare)
- `ngrok` — URL cố định (cần tài khoản ngrok + static domain)

### `bun run dev`

Chỉ Next.js (KHÔNG tunnel), localhost:3000.

```bash
bun run dev
```

### `bun run build` + `bun run start`

Production build + chạy với Bun runtime.

```bash
bun run build
bun run start
```

### `bun run lint`

Kiểm tra code quality (ESLint 9 + eslint-config-next).

```bash
bun run lint
```

### `bun run db:push`

Đẩy `prisma/schema.prisma` lên SQLite (`db/custom.db`).

```bash
bun run db:push
```

### `bash scripts/deploy-fly.sh`

Deploy lên Fly.io (cần `flyctl` CLI + đã login).

```bash
bash scripts/deploy-fly.sh
```

---

## 🔧 Cấu hình tunnel

Xem [`tunnel.conf`](../tunnel.conf) để chọn mode:
- **Quick** — không cần config, URL random
- **Cloudflare Named** — URL cố định, cần domain Cloudflare
- **Ngrok** — URL cố định, cần tài khoản ngrok

---

## 📁 Vị trí

```
scripts/
├── run-local.bat          # Windows — main run script
├── run-local.sh           # Linux/Mac — main run script
├── run-local.ps1          # Windows PowerShell (alternative)
├── parse-tunnel-url.ps1   # Parse Cloudflare quick tunnel URL
├── push-to-github.js      # CI helper — push to GitHub
├── deploy-fly.sh          # Deploy to Fly.io
└── auto-restart.sh        # Auto-restart dev server
```

---

## 🐛 Troubleshooting

### `bun: command not found: bash` (Windows)
→ Đừng dùng `bun run run`. Dùng `run` (gọi `run.cmd` → `run-local.bat`).

### Tunnel không tạo URL
→ Kiểm tra `cloudflared` đã cài:
```cmd
where cloudflared
```
Nếu chưa, script `run-local.bat` sẽ tự tải.

### Port 3000 đã được dùng
→ Script tự kill process cũ. Nếu vẫn lỗi:
```cmd
:: Windows
netstat -ano | findstr :3000
taskkill /f /pid <PID>

:: Linux/Mac
lsof -ti:3000 | xargs kill -9
```

---

**License:** MIT · **Version:** 0.2.0
