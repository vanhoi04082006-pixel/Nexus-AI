# 🚀 Hướng dẫn Deploy NEXUS AI lên Fly.io

> Fly.io có free tier: 3 shared-cpu-1x VMs (256MB RAM), 3GB persistent storage.

## 📋 Yêu cầu trước khi deploy

1. **Tài khoản Fly.io** — đăng ký tại https://fly.io (cần thẻ tín dụng để verify, nhưng không charge nếu dùng free tier)
2. **OpenRouter API key** — lấy tại https://openrouter.ai/keys
3. **GitHub OAuth App** — tạo tại https://github.com/settings/developers
4. **flyctl CLI** — cài đặt (xem bước 1)

---

## 🔧 Bước 1: Cài đặt flyctl

### macOS / Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

### Windows (PowerShell):
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

### Verify:
```bash
fly version
```

---

## 🔐 Bước 2: Login Fly.io

```bash
fly auth login
```

> Nếu chưa có tài khoản: `fly auth signup` (đăng ký với email + thẻ tín dụng)

---

## 📦 Bước 3: Deploy tự động (recommended)

```bash
cd Nexus-AI
bash scripts/deploy-fly.sh
```

Script sẽ tự động:
1. Tạo 2 apps: `nexus-ai-app` + `nexus-ai-chat`
2. Tạo persistent volume (1GB) cho SQLite
3. Set environment secrets (sẽ hỏi bạn nhập API keys)
4. Build + deploy cả 2 service
5. Verify deployment

---

## 🛠️ Bước 4: Deploy thủ công (nếu script lỗi)

### 4.1. Tạo apps

```bash
fly apps create nexus-ai-app --org personal
fly apps create nexus-ai-chat --org personal
```

### 4.2. Tạo volume cho SQLite

```bash
fly volumes create nexus_data --app nexus-ai-app --size 1 --region sin
```

### 4.3. Set secrets cho Next.js app

```bash
fly secrets set \
  OPENROUTER_API_KEY="sk-or-v1-xxxxx" \
  GITHUB_CLIENT_ID="xxxxx" \
  GITHUB_CLIENT_SECRET="xxxxx" \
  NEXT_PUBLIC_APP_URL="https://nexus-ai-app.fly.dev" \
  APP_URL="https://nexus-ai-app.fly.dev" \
  NEXT_PUBLIC_CHAT_URL="https://nexus-ai-chat.fly.dev" \
  --app nexus-ai-app
```

### 4.4. Set secrets cho chat service

```bash
fly secrets set \
  NEXT_APP_URL="http://nexus-ai-app.internal:3000" \
  --app nexus-ai-chat
```

### 4.5. Deploy Next.js app

```bash
fly deploy --config fly.toml --app nexus-ai-app --strategy rolling
```

### 4.6. Deploy chat service

```bash
fly deploy --config fly.chat.toml --app nexus-ai-chat --strategy rolling
```

---

## 🔑 Bước 5: Cập nhật GitHub OAuth App

Vào https://github.com/settings/developers → chọn OAuth App "Nexus AI" → sửa:

| Field | Value |
|---|---|
| Homepage URL | `https://nexus-ai-app.fly.dev` |
| Authorization callback URL | `https://nexus-ai-app.fly.dev/api/github/callback` |

---

## ✅ Bước 6: Verify

Mở browser:
- **App:** https://nexus-ai-app.fly.dev
- **Chat health:** https://nexus-ai-chat.fly.dev (trả 404 là bình thường — Socket.io không có route GET /)

Test tạo project + chat + GitHub push để xác nhận mọi thứ hoạt động.

---

## 📊 Lệnh quản lý

| Lệnh | Mô tả |
|---|---|
| `fly status --app nexus-ai-app` | Trạng thái app |
| `fly logs --app nexus-ai-app` | Xem logs realtime |
| `fly ssh console --app nexus-ai-app` | SSH vào container |
| `fly scale show --app nexus-ai-app` | Xem resource usage |
| `fly secrets list --app nexus-ai-app` | Danh sách secrets |
| `fly volumes list --app nexus-ai-app` | Xem volumes |
| `fly machine list --app nexus-ai-app` | Xem machines |
| `fly apps restart nexus-ai-app` | Restart app |

---

## 💰 Free Tier Limits

| Resource | Free | NEXUS AI dùng |
|---|---|---|
| VMs | 3 shared-cpu-1x (256MB) | 2 VMs |
| Storage | 3GB | 1GB (SQLite) |
| Bandwidth | 160GB/tháng | ~1GB/tháng |
| Outbound | 160GB/tháng | <1GB/tháng |

**⚠️ Lưu ý:** Free tier yêu cầu thẻ tín dụng để verify. Nếu vượt free tier, sẽ charge theo usage. Theo dõi tại https://fly.io/dashboard.

---

## 🔄 Update deployment

Mỗi lần push code mới lên GitHub:

```bash
# Deploy lại app
fly deploy --config fly.toml --app nexus-ai-app

# Deploy lại chat service
fly deploy --config fly.chat.toml --app nexus-ai-chat
```

---

## 🗑️ Xóa deployment

```bash
fly apps destroy nexus-ai-app
fly apps destroy nexus-ai-chat
```

---

## 🆘 Troubleshooting

### Lỗi: "out of memory" khi build
```bash
# Tăng RAM cho build
fly deploy --config fly.toml --app nexus-ai-app --build-arg NODE_OPTIONS=--max-old-space-size=512
```

### Lỗi: SQLite database locked
```bash
# Restart app
fly apps restart nexus-ai-app
```

### Lỗi: Chat không connect
```bash
# Kiểm tra chat service
fly status --app nexus-ai-chat
fly logs --app nexus-ai-chat

# Verify NEXT_PUBLIC_CHAT_URL đã set đúng
fly secrets list --app nexus-ai-app
```

### Lỗi: GitHub OAuth 404
- Kiểm tra callback URL trong GitHub OAuth App = `https://nexus-ai-app.fly.dev/api/github/callback`
- Kiểm tra `APP_URL` secret = `https://nexus-ai-app.fly.dev`

### Lỗi: Email không gửi được
```bash
# Xem logs SMTP
fly logs --app nexus-ai-app | grep EMAIL
```
- Kiểm tra Gmail app password đúng
- Kiểm tra 2FA đã bật trên Google account

---

## 📞 Hỗ trợ

- Fly.io docs: https://fly.io/docs
- Fly.io community: https://community.fly.io
- NEXUS AI repo: https://github.com/vanhoi04082006-pixel/Nexus-AI

---

<p align="center">
  <strong>NEXUS AI</strong> — Deployed on Fly.io 🚀<br>
  Multi-Agent Architect • 8 AI Agents
</p>
