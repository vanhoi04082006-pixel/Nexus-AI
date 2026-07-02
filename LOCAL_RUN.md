# 🏠 Chạy NEXUS AI Local + Cloudflare Tunnel

> FREE, không cần thẻ tín dụng, không cần deploy. Chạy từ máy bạn, có URL public.

## Cách hoạt động

```
Máy bạn (Next.js + SQLite)
  ↓ Cloudflare Tunnel (FREE)
URL public: https://xxx.trycloudflare.com
  ↓ Thành viên truy cập từ bất kỳ đâu
```

---

## 🚀 Cài đặt

### Yêu cầu
- [Bun](https://bun.sh) v1+
- [Node.js](https://nodejs.org) v18+
- [OpenRouter API key](https://openrouter.ai/keys) (free, multi-key rotation)

### Windows

```cmd
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
copy .env.example .env
```

Mở `.env`, điền:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_API_KEY_2=sk-or-v1-xxxxx (tùy chọn, dự phòng)
GITHUB_CLIENT_ID=xxxxx
GITHUB_CLIENT_SECRET=xxxxx
```

Chạy:
```cmd
scripts\run-local.bat
```

### macOS / Linux

```bash
git clone https://github.com/vanhoi04082006-pixel/Nexus-AI.git
cd Nexus-AI
cp .env.example .env
bash scripts/run-local.sh
```

---

## 📋 Script tự động làm gì?

1. Kiểm tra `.env` + Bun
2. Install dependencies (`bun install`)
3. Setup database (`bun run db:push`)
4. Tải `cloudflared` (nếu chưa có)
5. Khởi động Next.js (port 3000)
6. Tạo Cloudflare Tunnel → URL public
7. Ghi URL vào `.public-url` → email dùng URL đúng

---

## ⚠️ Nếu cloudflared lỗi

Tải thủ công: https://github.com/cloudflare/cloudflared/releases/latest

Mở 2 terminal:

**Terminal 1:**
```cmd
bun run dev
```

**Terminal 2:**
```cmd
cloudflared.exe tunnel --url http://localhost:3000
```

Copy URL `https://xxx.trycloudflare.com` → dán vào file `.public-url`.

---

## ✉️ Email link

Khi tunnel chạy, script ghi URL vào `.public-url`. Email lời mời dùng URL này:

```
https://xxx.trycloudflare.com/?p=PROJECT_ID&token=MEMBER_TOKEN
```

Thành viên click link → vào workspace.

---

## 💡 Lưu ý

| Vấn đề | Giải thích |
|---|---|
| Máy phải bật | URL chỉ hoạt động khi máy đang chạy |
| URL đổi mỗi lần | Mỗi lần chạy script → URL khác |
| Chat dùng polling | 3 giây/lần, không cần chat service |
| Data trên máy | SQLite tại `db/custom.db` |

---

## 🆘 Troubleshooting

### `bun: command not found`
```bash
curl -fsSL https://bun.sh/install | bash
```

### OpenRouter rate limit
- Thêm `OPENROUTER_API_KEY_2`, `_3`, `_4`... vào `.env` (hỗ trợ không giới hạn số key)
- Hệ thống tự luân chuyển khi 1 key bị 429
- Xem **Live Log Console** trong UI để biết key nào còn sống / đã chết

### Email không gửi
- Kiểm tra Gmail App Password (không phải password thường)
- Bật 2FA trên Google account
- Xem log: `[EMAIL]` trong terminal

### Mermaid render lỗi
- Bấm nút "Thu lai" trên diagram
- Hệ thống tự fix `\\n`, `PK FK`, `class` prefix

---

<p align="center">
  <strong>NEXUS AI</strong> — Chạy local, chia sẻ toàn cầu
</p>
