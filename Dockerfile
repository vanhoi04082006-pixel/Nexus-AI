# ====== NEXUS AI — Standalone Docker Image ======
# Multi-stage build: build → production

# ---------- Stage 1: Build ----------
FROM oven/bun:1.2 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma

RUN bun install --frozen-lockfile

COPY . .

RUN bunx prisma generate
RUN bun run build

# ---------- Stage 2: Production ----------
FROM oven/bun:1.2-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/custom.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["sh", "-c", "bunx prisma db push --skip-generate && node server.js"]
