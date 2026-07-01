#!/bin/bash
# ================================================================
# NEXUS AI — Chạy Local + Cloudflare Tunnel
# Không cần deploy, không cần thẻ tín dụng, có URL public miễn phí
# ================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   NEXUS AI — Local Run + Cloudflare Tunnel           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# ===== Bước 0: Kiểm tra dependencies =====
echo -e "${YELLOW}📋 Bước 0: Kiểm tra dependencies...${NC}"

# Kiểm tra Bun
if ! command -v bun &> /dev/null; then
  echo -e "${RED}❌ Bun chưa cài. Cài now:${NC}"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
echo -e "${GREEN}✓ Bun: $(bun --version)${NC}"

# Kiểm tra Node (cần cho Prisma)
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js chưa cài. Cài từ https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node: $(node --version)${NC}"

# Kiểm tra .env
if [ ! -f .env ]; then
  echo -e "${YELLOW}📋 Tạo .env từ .env.example...${NC}"
  cp .env.example .env
  echo -e "${RED}⚠ Mở file .env và điền API keys, rồi chạy lại script!${NC}"
  echo -e "${BLUE}  nano .env  hoặc  code .env${NC}"
  exit 1
fi
echo -e "${GREEN}✓ .env đã có${NC}"

echo ""

# ===== Bước 1: Install dependencies =====
echo -e "${YELLOW}📋 Bước 1: Install dependencies...${NC}"
bun install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# ===== Bước 2: Setup database =====
echo -e "${Yellow}📋 Bước 2: Setup database...${NC}"
bun run db:push
echo -e "${Green}✓ Database ready${NC}"
echo ""

# ===== Bước 3: Kiểm tra cloudflared =====
echo -e "${YELLOW}📋 Bước 3: Kiểm tra cloudflared...${NC}"
if ! command -v cloudflared &> /dev/null; then
  echo -e "${YELLOW}cloudflared chưa cài. Đang cài...${NC}"

  # Detect OS
  OS=$(uname -s)
  ARCH=$(uname -m)

  if [ "$OS" = "Darwin" ]; then
    # macOS
    if command -v brew &> /dev/null; then
      brew install cloudflared
    else
      curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin.tgz -o /tmp/cloudflared.tgz
      tar -xzf /tmp/cloudflared.tgz -C /usr/local/bin cloudflared
    fi
  elif [ "$OS" = "Linux" ]; then
    # Linux
    if [ "$ARCH" = "x86_64" ]; then
      curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
    elif [ "$ARCH" = "aarch64" ]; then
      curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
    fi
    chmod +x /usr/local/bin/cloudflared
  else
    echo -e "${RED}⚠ Không thể tự cài cloudflared. Tải thủ công từ:${NC}"
    echo -e "${BLUE}https://github.com/cloudflare/cloudflared/releases${NC}"
    echo -e "${YELLOW}Sau khi cài, chạy lại script này.${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}✓ cloudflared: $(cloudflared --version 2>&1 | head -1)${NC}"
echo ""

# ===== Bước 4: Khởi động Next.js server =====
echo -e "${YELLOW}📋 Bước 4: Khởi động Next.js server (port 3000)...${NC}"
echo -e "${BLUE}Server sẽ chạy ở nền. Nhấn Ctrl+C để dừng cả 2.${NC}"
echo ""

# Khởi động Next.js dev server
bun run dev &
APP_PID=$!
echo -e "${GREEN}✓ Next.js PID: $APP_PID${NC}"

# Đợi server sẵn sàng
echo -ne "${YELLOW}Đợi server sẵn sàng${NC}"
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
    echo -e " ${GREEN}✓${NC}"
    break
  fi
  echo -ne "."
  sleep 2
done
echo ""

# ===== Bước 5: Khởi động Cloudflare Tunnel =====
echo -e "${YELLOW}📋 Bước 5: Khởi động Cloudflare Tunnel...${NC}"
echo -e "${BLUE}Đang tạo URL public...${NC}"

# Chạy cloudflared tunnel — xuất URL public
cloudflared tunnel --url http://localhost:3000 2>&1 | while read line; do
  # Tìm URL trong log
  if echo "$line" | grep -q "trycloudflare.com"; then
    URL=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
    if [ -n "$URL" ]; then
      echo ""
      echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
      echo -e "${GREEN}║   ✅ NEXUS AI ĐANG CHẠY!                             ║${NC}"
      echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
      echo ""
      echo -e "🌐 Local:  ${BLUE}http://localhost:3000${NC}"
      echo -e "🌐 Public: ${BLUE}${URL}${NC}"
      echo ""
      echo -e "${YELLOW}📋 Chia sẻ URL public cho thành viên:${NC}"
      echo -e "   ${BLUE}${URL}${NC}"
      echo ""
      echo -e "${YELLOW}⚠ Lưu ý:${NC}"
      echo -e "   - Máy phải BẬT để URL hoạt động"
      echo -e "   - URL đổi mỗi lần chạy lại script"
      echo -e "   - Chat dùng polling (3s) — không cần chat service"
      echo -e "   - Nhấn Ctrl+C để dừng"
      echo ""
    fi
  fi
  # In log (trừ noise)
  if ! echo "$line" | grep -q "ERR\|WAR\|deb"; then
    echo "$line"
  fi
done &

# Cleanup khi Ctrl+C
cleanup() {
  echo ""
  echo -e "${YELLOW}Đang dừng...${NC}"
  kill $APP_PID 2>/dev/null
  pkill -f cloudflared 2>/dev/null
  echo -e "${GREEN}✓ Đã dừng${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# Giữ script chạy
wait
