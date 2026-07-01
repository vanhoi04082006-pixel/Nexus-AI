# 🏠 Chạy NEXUS AI Local + Cloudflare Tunnel

> **FREE, không cần thẻ tín dụng, không cần deploy.** Chạy thẳng từ máy bạn, có URL public chia sẻ cho team.

## Cách hoạt động

```
Máy bạn (Next.js + SQLite)  ←→  Cloudflare Tunnel  ←→  Internet
     localhost:3000              (FREE, no card)        *.trycloudflare.com
```

- **Next.js** chạy trên máy bạn (port 3000)
- **Cloudflare Tunnel** tạo URL public miễn phí
- **Thành viên** truy cập URL đó từ bất kỳ đâu
- **Chat** dùng polling (3 giây/lần) — không cần chat service riêng
- **SQLite** lưu trên ổ cứng máy bạn — data không mất

---

## 🚀 Cài đặt nhanh

### Yêu cầu
- [Bun](https://bun.sh) v1+
- [Node.js](https://nodejs.org) v18+
- [OpenRouter API key](https://openrouter.ai/keys) (free)

### Windows

```cmd
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
copy .env.example .env
```

Mở file `.env`, điền:
```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
GITHUB_CLIENT_ID=xxxxx           (tùy chọn)
GITHUB_CLIENT_SECRET=xxxxx       (tùy chọn)
```

Chạy:
```cmd
scripts\run-local.bat
```

Hoặc PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-local.ps1
```

### macOS / Linux

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
cp .env.example .env
# Điền API keys vào .env
bash scripts/run-local.sh
```

---

## 📋 Script tự động làm gì?

1. ✅ Kiểm tra `.env` đã có
2. ✅ Kiểm tra Bun đã cài
3. ✅ Install dependencies (`bun install`)
4. ✅ Setup database (`bun run db:push`)
5. ✅ Tải `cloudflared` (nếu chưa có)
6. ✅ Khởi động Next.js server (port 3000)
7. ✅ Tạo Cloudflare Tunnel → URL public
8. ✅ Cập nhật `.public-url` → email link dùng URL đúng

---

## ⚠️ Nếu cloudflared tải thất bại (Windows)

Tải thủ công:

1. Tải file: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
2. Đổi tên thành `cloudflared.exe`
3. Đặt vào thư mục `E:\Nexus-AI\` (cùng cấp với `package.json`)

Sau đó mở **2 terminal**:

**Terminal 1:**
```cmd
bun run dev
```

**Terminal 2:**
```cmd
cloudflared.exe tunnel --url http://localhost:3000
```

Tìm URL `https://xxx.trycloudflare.com` trong Terminal 2 → copy → dán vào file `.public-url` (ghi đè nội dung cũ).

---

## ✉️ Email link hoạt động thế nào?

Khi Cloudflare Tunnel chạy, script ghi URL public vào file `.public-url`:

```
https://random-words-xxxx.trycloudflare.com
```

Khi AI gửi email lời mời cho thành viên, link trong email đọc từ file này:

```
https://random-words-xxxx.trycloudflare.com/?p=PROJECT_ID&token=MEMBER_TOKEN
```

→ Thành viên click link → truy cập workspace từ bất kỳ thiết bị nào.

**Nếu URL tunnel đổi** (chạy lại script), chỉ cần cập nhật `.public-url` — email mới sẽ dùng URL đúng.

---

## 💡 Lưu ý quan trọng

| Vấn đề | Giải thích |
|---|---|
| **Máy phải bật** | URL chỉ hoạt động khi máy bạn đang chạy server |
| **URL đổi mỗi lần** | Mỗi lần chạy script → URL `*.trycloudflare.com` khác nhau |
| **Chat dùng polling** | 3 giây/lần, không cần chat service riêng |
| **Data trên máy** | SQLite tại `db/custom.db` — tắt script data vẫn còn |

---

## 🔄 URL cố định (tùy chọn)

Muốn URL không đổi mỗi lần chạy:

### Cloudflare named tunnel (free, cần account)

1. Đăng ký [Cloudflare free](https://dash.cloudflare.com/sign-up)
2. `cloudflared tunnel login`
3. `cloudflared tunnel create nexus-ai`
4. Cấu hình `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: nexus-ai
   credentials-file: ~/.cloudflared/<TUNNEL_ID>.json
   ingress:
     - hostname: nexus-ai.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
5. `cloudflared tunnel run nexus-ai`

### Hoặc dùng ngrok (free)

```bash
# Đăng ký https://ngrok.com
ngrok config add-authtoken YOUR_TOKEN
ngrok http 3000
```

---

## 🆘 Troubleshooting

### `bun: command not found`
```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
irm bun.sh/install.ps1 | iex
```

### `cloudflared: command not found`
Tải thủ công từ https://github.com/cloudflare/cloudflared/releases/latest

### `Port 3000 already in use`
```cmd
:: Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```
```bash
# macOS / Linux
lsof -i :3000
kill -9 <PID>
```

### OpenRouter rate limit
- Thêm `OPENROUTER_API_KEY_2`, `OPENROUTER_API_KEY_3` vào `.env`
- Hệ thống tự chuyển key khi 1 key bị limit

### Email không gửi được
- Kiểm tra Gmail App Password đúng (không phải password thường)
- Bật 2FA trên Google account trước
- Xem log: tìm dòng `[EMAIL]` trong terminal

---

## 📞 Hỗ trợ

- Repo: https://github.com/vanhoi04082006-pixel/Nexus-AI
- Issues: https://github.com/vanhoi04082006-pixel/Nexus-AI/issues

---

<p align="center">
  <strong>NEXUS AI</strong> — Chạy local, chia sẻ toàn cầu 🌐
</p>
