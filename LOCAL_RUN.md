# 🏠 Chạy NEXUS AI Local + Cloudflare Tunnel (FREE, không cần thẻ)

> **Không cần deploy!** Chạy thẳng từ máy bạn, có URL public miễn phí chia sẻ cho team.

## ✨ Cách này hoạt động như nào?

```
Máy bạn (Next.js + SQLite)  ←→  Cloudflare Tunnel  ←→  Internet
     localhost:3000              (FREE, no card)        *.trycloudflare.com
```

- **Next.js** chạy trên máy bạn (port 3000)
- **Cloudflare Tunnel** tạo URL public miễn phí (`https://xxx.trycloudflare.com`)
- **Thành viên** truy cập URL đó từ bất kỳ đâu
- **Chat** dùng polling (3 giây/lần) — không cần Socket.io service riêng
- **SQLite** lưu trên ổ cứng máy bạn — data không bao giờ mất

## Ưu điểm

| | Local + Tunnel | Fly.io | Render |
|---|---|---|---|
| **Thẻ tín dụng** | ❌ Không cần | ✅ Cần | ✅ Cần (Render không cần nhưng Postgres cần) |
| **Free** | ✅ Hoàn toàn | ⚠️ Giới hạn | ⚠️ Sleep 15min |
| **Deploy** | ❌ Không cần | ✅ Cần | ✅ Cần |
| **RAM** | ✅ Toàn bộ máy | 256-512MB | 512MB |
| **Sleep** | ❌ Không | ❌ Không | ✅ Sleep 15min |
| **URL cố định** | ❌ Đổi mỗi lần | ✅ Cố định | ✅ Cố định |
| **Máy phải bật** | ✅ Có | ❌ Không | ❌ Không |

---

## 🚀 Cài đặt (5 phút)

### Yêu cầu
- **Bun** — runtime JavaScript (nhẹ hơn Node)
- **Node.js** — cần cho Prisma
- **cloudflared** — tạo tunnel (script tự cài)

### Bước 1: Clone project

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
```

### Bước 2: Cài Bun (nếu chưa có)

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:** Tải từ https://bun.sh/docs/installation#windows

**Verify:**
```bash
bun --version
```

### Bước 3: Tạo file `.env`

```bash
cp .env.example .env
```

Mở file `.env`, điền:

```env
DATABASE_URL=file:./db/custom.db

# Lấy key tại https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Tạo GitHub OAuth App tại https://github.com/settings/developers
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx

# URL local (script sẽ tự cập nhật khi tunnel chạy)
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

### Bước 4: Chạy script

```bash
bash scripts/run-local.sh
```

Script sẽ tự động:
1. Cài dependencies (`bun install`)
2. Setup database (`bun run db:push`)
3. Cài `cloudflared` (nếu chưa có)
4. Khởi động Next.js server (port 3000)
5. Tạo Cloudflare Tunnel → URL public

### Bước 5: Mở URL

Sau khi script chạy xong, bạn sẽ thấy:

```
✅ NEXUS AI ĐANG CHẠY!

🌐 Local:  http://localhost:3000
🌐 Public: https://random-words.trycloudflare.com
```

**Chia sẻ URL public cho thành viên** — họ truy cập từ bất kỳ thiết bị nào.

---

## 📖 Cách dùng

### Cho nhóm trưởng
1. Mở URL public
2. Nhập chủ đề dự án + thông tin nhóm trưởng + App Password Gmail
3. Thêm thành viên (tên + email)
4. Bấm **"Khởi tạo Dự Án"** — 8 AI Agent chạy
5. Workspace hiện ra với đầy đủ phân tích
6. Bấm **"Khởi tạo Dự Án"** (sidebar) để sinh todolist

### Cho thành viên
1. Nhận email lời mời (kiểm tra Mailbox nếu SMTP fail)
2. Click link trong email → vào workspace
3. Xem phân tích, chat, todolist của mình
4. Bấm "Viec cua toi" để filter task cá nhân

---

## ⚠️ Lưu ý quan trọng

### Máy phải BẬT
- URL public chỉ hoạt động khi máy bạn đang chạy script
- Tắt máy / đóng terminal → URL chết
- Khi mở lại → chạy `bash scripts/run-local.sh` → URL mới

### URL đổi mỗi lần
- Mỗi lần chạy script → URL `*.trycloudflare.com` khác nhau
- Muốn URL cố định → đăng ký Cloudflare account (free) + tạo named tunnel
- Xem: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

### Chat dùng polling
- Chat hoạt động qua HTTP polling (3 giây/lần)
- Không cần chạy chat service riêng (port 3001)
- Realtime nhưng chậm 3 giây so với WebSocket

### Data lưu trên máy
- SQLite database tại `db/custom.db`
- Tắt script → data vẫn còn
- Muốn xóa data → xóa file `db/custom.db`

---

## 🔧 Chạy thủ công (không dùng script)

### Terminal 1: Next.js
```bash
cd Nexus-AI
bun install
bun run db:push
bun run dev
```

### Terminal 2: Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 🌍 URL cố định (optional)

Muốn URL cố định (không đổi mỗi lần chạy):

### Cách 1: Cloudflare named tunnel (free, cần account)

```bash
# Đăng ký Cloudflare free tại https://dash.cloudflare.com/sign-up
fly auth login  # hoặc cloudflared tunnel login

# Tạo named tunnel
cloudflared tunnel create nexus-ai

# Cấu hình
cat > ~/.cloudflared/config.yml << EOF
tunnel: nexus-ai
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: nexus-ai.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# Chạy tunnel
cloudflared tunnel run nexus-ai
```

### Cách 2: Dùng ngrok (free, cần account)

```bash
# Đăng ký https://ngrok.com
ngrok config add-authtoken YOUR_TOKEN

# Chạy
ngrok http 3000
```

URL: `https://xxxx.ngrok-free.app` (đổi mỗi lần, nhưng có thể reserve domain static)

---

## 🆘 Troubleshooting

### Lỗi: "bun: command not found"
```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # hoặc ~/.zshrc

# Verify
bun --version
```

### Lỗi: "cloudflared: command not found"
```bash
# macOS
brew install cloudflared

# Linux (amd64)
sudo curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

### Lỗi: "Port 3000 already in use"
```bash
# Tìm process đang dùng port 3000
lsof -i :3000  # macOS/Linux
# hoặc
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>
```

### Lỗi: "Prisma client did not initialize"
```bash
bunx prisma generate
bun run db:push
```

### Lỗi: OpenRouter "rate limit exceeded"
- Free tier OpenRouter có giới hạn requests/ngày
- Đợi ngày hôm sau reset, hoặc nạp $10 để mở 1000 req/ngày

### Lỗi: Email không gửi được
- Kiểm tra Gmail App Password đúng (không phải password thường)
- Bật 2FA trên Google account trước
- Xem log trong terminal: tìm dòng `[EMAIL]`

---

## 📊 So sánh các lựa chọn FREE

| Nền tảng | Thẻ TD | Deploy | URL cố định | Sleep | RAM |
|---|---|---|---|---|---|
| **Local + Cloudflare Tunnel** | ❌ | ❌ | ❌* | ❌ | Full máy |
| **Local + ngrok** | ❌** | ❌ | ❌* | ❌ | Full máy |
| **Render free** | ❌ | ✅ | ✅ | ✅ 15min | 512MB |
| **Vercel free** | ❌ | ✅ | ✅ | ❌ | — |
| **Fly.io free** | ✅ | ✅ | ✅ | ❌ | 256MB |

\* URL cố định nếu dùng named tunnel (free, cần Cloudflare account)
\*\* ngrok cần account free (email only, không cần thẻ)

---

## 💡 Khuyến nghị

### Cho dự án cá nhân / nhóm nhỏ → **Local + Cloudflare Tunnel**
- Miễn phí hoàn toàn, không thẻ
- RAM đầy đủ (AI pipeline cần RAM lớn)
- Data an toàn trên máy bạn

### Cho demo / production lâu dài → **Render free + Neon Postgres**
- URL cố định, auto-deploy từ GitHub
- Cần migrate SQLite → Postgres
- Sleep 15min (request đầu chậm 30s)

---

<p align="center">
  <strong>NEXUS AI</strong> — Chạy local, chia sẻ toàn cầu 🌐<br>
  Multi-Agent Architect • 8 AI Agents
</p>
