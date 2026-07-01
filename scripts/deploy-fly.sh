#!/bin/bash
# ================================================================
# NEXUS AI — Fly.io Deploy Script
# Chạy script này để deploy cả 2 service lên Fly.io
# ================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   NEXUS AI — Fly.io Deploy Script                    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ===== Bước 0: Kiểm tra flyctl =====
echo -e "${YELLOW}📋 Bước 0: Kiểm tra flyctl...${NC}"
if ! command -v fly &> /dev/null; then
  echo -e "${RED}❌ flyctl chưa cài. Cài now:${NC}"
  curl -L https://fly.io/install.sh | sh
  export FLYCTL_INSTALL="/home/$USER/.fly"
  export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi
echo -e "${GREEN}✓ flyctl đã cài${NC}"
echo ""

# ===== Bước 1: Login + Signup =====
echo -e "${YELLOW}📋 Bước 1: Login Fly.io...${NC}"
echo -e "Nếu chưa có tài khoản, chạy: ${GREEN}fly auth signup${NC}"
fly auth login
echo -e "${GREEN}✓ Đã login${NC}"
echo ""

# ===== Bước 2: Tạo 2 apps =====
echo -e "${YELLOW}📋 Bước 2: Tạo apps trên Fly.io...${NC}"
echo -e "${BLUE}Tạo app nexus-ai-app (Next.js)...${NC}"
fly apps create nexus-ai-app --org personal || echo "App có thể đã tồn tại"

echo -e "${BLUE}Tạo app nexus-ai-chat (Socket.io)...${NC}"
fly apps create nexus-ai-chat --org personal || echo "App có thể đã tồn tại"
echo -e "${GREEN}✓ 2 apps đã tạo${NC}"
echo ""

# ===== Bước 3: Tạo volume cho SQLite =====
echo -e "${YELLOW}📋 Bước 3: Tạo persistent volume...${NC}"
fly volumes create nexus_data --app nexus-ai-app --size 1 --region sin || echo "Volume có thể đã tồn tại"
echo -e "${GREEN}✓ Volume nexus_data (1GB) đã tạo${NC}"
echo ""

# ===== Bước 4: Set secrets =====
echo -e "${YELLOW}📋 Bước 4: Set environment secrets...${NC}"
echo -e "${BLUE}Nhập các giá trị (sẽ bị ẩn):${NC}"

read -p "OpenRouter API Key (sk-or-v1-...): " OR_KEY
read -p "GitHub Client ID: " GH_ID
read -p "GitHub Client Secret: " GH_SECRET

# Set secrets cho app
fly secrets set \
  OPENROUTER_API_KEY="$OR_KEY" \
  GITHUB_CLIENT_ID="$GH_ID" \
  GITHUB_CLIENT_SECRET="$GH_SECRET" \
  NEXT_PUBLIC_APP_URL="https://nexus-ai-app.fly.dev" \
  APP_URL="https://nexus-ai-app.fly.dev" \
  NEXT_PUBLIC_CHAT_URL="https://nexus-ai-chat.fly.dev" \
  --app nexus-ai-app

# Chat service cần biết app URL để verify token
fly secrets set \
  NEXT_APP_URL="http://nexus-ai-app.internal:3000" \
  --app nexus-ai-chat

echo -e "${GREEN}✓ Secrets đã set${NC}"
echo ""

# ===== Bước 5: Deploy app (Next.js) =====
echo -e "${YELLOW}📋 Bước 5: Deploy nexus-ai-app (Next.js)...${NC}"
echo -e "${BLUE}Đây sẽ mất 3-5 phút...${NC}"
fly deploy --config fly.toml --app nexus-ai-app --strategy rolling
echo -e "${GREEN}✓ nexus-ai-app deployed${NC}"
echo ""

# ===== Bước 6: Deploy chat service =====
echo -e "${YELLOW}📋 Bước 6: Deploy nexus-ai-chat (Socket.io)...${NC}"
echo -e "${BLUE}Đây sẽ mất 2-3 phút...${NC}"
fly deploy --config fly.chat.toml --app nexus-ai-chat --strategy rolling
echo -e "${GREEN}✓ nexus-ai-chat deployed${NC}"
echo ""

# ===== Bước 7: Verify =====
echo -e "${YELLOW}📋 Bước 7: Verify deployment...${NC}"
echo -e "${BLUE}App URL: https://nexus-ai-app.fly.dev${NC}"
echo -e "${BLUE}Chat URL: https://nexus-ai-chat.fly.dev${NC}"
echo ""
echo -e "${BLUE}Kiểm tra app...${NC}"
sleep 5
curl -s -o /dev/null -w "App status: %{http_code}\n" https://nexus-ai-app.fly.dev/
curl -s -o /dev/null -w "Chat status: %{http_code}\n" https://nexus-ai-chat.fly.dev/
echo ""

# ===== Bước 8: Cập nhật GitHub OAuth callback =====
echo -e "${YELLOW}📋 Bước 8: Cập nhật GitHub OAuth App${NC}"
echo -e "${BLUE}Vào GitHub Settings → Developer settings → OAuth Apps${NC}"
echo -e "${BLUE}Sửa Authorization callback URL thành:${NC}"
echo -e "${GREEN}  https://nexus-ai-app.fly.dev/api/github/callback${NC}"
echo ""

echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DEPLOY THÀNH CÔNG!                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "🌐 App: ${BLUE}https://nexus-ai-app.fly.dev${NC}"
echo -e "💬 Chat: ${BLUE}https://nexus-ai-chat.fly.dev${NC}"
echo ""
echo -e "${YELLOW}Lệnh quản lý:${NC}"
echo -e "  fly status --app nexus-ai-app     # Xem trạng thái app"
echo -e "  fly logs --app nexus-ai-app       # Xem logs"
echo -e "  fly ssh console --app nexus-ai-app # SSH vào container"
echo -e "  fly scale show --app nexus-ai-app  # Xem resource usage"
echo -e "  fly secrets list --app nexus-ai-app # Xem secrets"
echo -e "  fly apps destroy nexus-ai-app      # Xóa app (cẩn thận!)"
