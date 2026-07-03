#!/bin/bash
# ================================================================
# NEXUS AI — Chạy Local + Tunnel (Quick / Named / Ngrok)
# URL cố định khi restart — xem tunnel.conf để cấu hình
# ================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   NEXUS AI — Local Run + Tunnel                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# ===== Load tunnel config =====
TUNNEL_MODE="quick"
TUNNEL_NAME=""
TUNNEL_URL=""
NGROK_DOMAIN=""

if [ -f "tunnel.conf" ]; then
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [ -z "$key" ] && continue
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    case "$key" in
      TUNNEL_MODE) TUNNEL_MODE="$value" ;;
      TUNNEL_NAME) TUNNEL_NAME="$value" ;;
      TUNNEL_URL) TUNNEL_URL="$value" ;;
      NGROK_DOMAIN) NGROK_DOMAIN="$value" ;;
    esac
  done < "tunnel.conf"
fi

echo -e "${YELLOW}📋 Tunnel mode: ${TUNNEL_MODE}${NC}"
echo ""

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
echo -e "${YELLOW}📋 Bước 2: Setup database...${NC}"
bun run db:push
echo -e "${GREEN}✓ Database ready${NC}"
echo ""

# ===== Bước 3: Check tunnel tool =====
echo -e "${YELLOW}📋 Bước 3: Kiểm tra tunnel tool...${NC}"

if [ "$TUNNEL_MODE" = "ngrok" ]; then
  if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok chưa cài. Tải tại https://ngrok.com/download${NC}"
    echo -e "${YELLOW}Sau khi cài: ngrok config add-authtoken YOUR_TOKEN${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ ngrok: $(ngrok --version 2>&1 | head -1)${NC}"
elif [ "$TUNNEL_MODE" = "cloudflare-named" ]; then
  if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared chưa cài${NC}"
    exit 1
  fi
  if [ -z "$TUNNEL_NAME" ]; then
    echo -e "${RED}❌ TUNNEL_NAME chưa cấu hình trong tunnel.conf${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ cloudflared: $(cloudflared --version 2>&1 | head -1)${NC}"
  echo -e "${GREEN}✓ Tunnel name: ${TUNNEL_NAME}${NC}"
else
  # Quick tunnel mode
  if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}📋 Tải cloudflared...${NC}"
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
      curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
    elif [ "$ARCH" = "aarch64" ]; then
      curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
    fi
    chmod +x /usr/local/bin/cloudflared
  fi
  echo -e "${GREEN}✓ cloudflared: $(cloudflared --version 2>&1 | head -1)${NC}"
fi
echo ""

# ===== Bước 4: Khởi động Next.js server =====
echo -e "${YELLOW}📋 Bước 4: Khởi động Next.js server (port 3000)...${NC}"
echo -e "${BLUE}Server sẽ chạy ở nền. Nhấn Ctrl+C để dừng cả 2.${NC}"
echo ""

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

# ===== Bước 5: Khởi động Tunnel =====
echo -e "${YELLOW}📋 Bước 5: Khởi động Tunnel (mode: ${TUNNEL_MODE})...${NC}"

# Cleanup khi Ctrl+C
cleanup() {
  echo ""
  echo -e "${YELLOW}Đang dừng...${NC}"
  kill $APP_PID 2>/dev/null
  pkill -f cloudflared 2>/dev/null
  pkill -f ngrok 2>/dev/null
  echo -e "${GREEN}✓ Đã dừng${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

if [ "$TUNNEL_MODE" = "ngrok" ]; then
  # ── NGROK (fixed domain) ──
  echo -e "${BLUE}Đang khởi động ngrok với domain: ${NGROK_DOMAIN}${NC}"
  FINAL_URL="https://${NGROK_DOMAIN}"
  echo "$FINAL_URL" > "$PROJECT_DIR/.public-url"

  ngrok http 3000 --domain="${NGROK_DOMAIN}" 2>&1 | while read line; do
    echo "$line"
  done &

  sleep 3
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ NEXUS AI ĐANG CHẠY!                             ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "🌐 Local:  ${BLUE}http://localhost:3000${NC}"
  echo -e "🌐 Public: ${BLUE}${FINAL_URL}${NC}"
  echo ""
  echo -e "${GREEN}✓ URL CỐ ĐỊNH — không đổi khi restart${NC}"
  echo -e "${GREEN}✓ Đã cập nhật .public-url — email sẽ dùng URL này${NC}"
  echo ""
  echo -e "${YELLOW}📋 Chia sẻ URL public cho thành viên:${NC}"
  echo -e "   ${BLUE}${FINAL_URL}${NC}"
  echo ""

elif [ "$TUNNEL_MODE" = "cloudflare-named" ]; then
  # ── CLOUDFLARE NAMED TUNNEL (fixed URL) ──
  echo -e "${BLUE}Đang khởi động Cloudflare Named Tunnel: ${TUNNEL_NAME}${NC}"
  FINAL_URL="${TUNNEL_URL}"
  if [ -z "$FINAL_URL" ]; then
    FINAL_URL="https://${TUNNEL_NAME}.cfargotunnel.com"
  fi
  echo "$FINAL_URL" > "$PROJECT_DIR/.public-url"

  cloudflared tunnel run "${TUNNEL_NAME}" 2>&1 | while read line; do
    if ! echo "$line" | grep -q "ERR\|WAR\|deb"; then
      echo "$line"
    fi
  done &

  sleep 5
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ NEXUS AI ĐANG CHẠY!                             ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "🌐 Local:  ${BLUE}http://localhost:3000${NC}"
  echo -e "🌐 Public: ${BLUE}${FINAL_URL}${NC}"
  echo ""
  echo -e "${GREEN}✓ URL CỐ ĐỊNH — không đổi khi restart${NC}"
  echo -e "${GREEN}✓ Đã cập nhật .public-url — email sẽ dùng URL này${NC}"
  echo ""

else
  # ── CLOUDFLARE QUICK TUNNEL (random URL) ──
  echo -e "${BLUE}Đang tạo URL public (random — sẽ đổi mỗi lần restart)...${NC}"

  cloudflared tunnel --url http://localhost:3000 2>&1 | while read line; do
    if echo "$line" | grep -q "trycloudflare.com"; then
      URL=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
      if [ -n "$URL" ]; then
        echo "$URL" > "$PROJECT_DIR/.public-url"
        echo ""
        echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║   ✅ NEXUS AI ĐANG CHẠY!                             ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "🌐 Local:  ${BLUE}http://localhost:3000${NC}"
        echo -e "🌐 Public: ${BLUE}${URL}${NC}"
        echo ""
        echo -e "${YELLOW}⚠ URL sẽ đổi mỗi lần restart${NC}"
        echo -e "${YELLOW}  Để có URL cố định, xem tunnel.conf${NC}"
        echo ""
        echo -e "${GREEN}✓ Đã cập nhật .public-url${NC}"
        echo ""
      fi
    fi
    if ! echo "$line" | grep -q "ERR\|WAR\|deb"; then
      echo "$line"
    fi
  done &
fi

# Giữ script chạy
wait
