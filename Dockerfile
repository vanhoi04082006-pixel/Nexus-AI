# ====== NEXUS AI — Fly.io Dockerfile (Next.js app) ======
# Multi-stage build để giảm image size

# ---------- Stage 1: Build ----------
FROM oven/bun:1.2 AS build

WORKDIR /app

# Copy package files trước để cache dependencies
COPY package.json bun.lock ./
COPY prisma ./prisma

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build Next.js
RUN bun run build

# ---------- Stage 2: Production ----------
FROM oven/bun:1.2-slim AS production

WORKDIR /app

# Install OpenSSL (cần cho Prisma SQLite)
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy build output + node_modules + prisma
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# Tạo thư mục cho SQLite database (persistent volume sẽ mount vào đây)
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Database path — Fly volume mount tại /data
ENV DATABASE_URL=file:/data/custom.db

# Expose port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start command — chạy prisma db push trước khi start server
CMD ["sh", "-c", "bunx prisma db push --skip-generate && node server.js"]
