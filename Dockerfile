# ─── Stage 1: Build the React frontend ────────────────────────────────────────
FROM node:20-slim AS webbuild
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

# ─── Stage 2: Install server deps + generate Prisma client ────────────────────
FROM node:20-slim AS serverbuild
WORKDIR /app/server

# Install openssl early so Prisma generate succeeds
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm install
COPY server/ .

# Bake the Prisma client into the image at build time (not startup)
RUN npx prisma generate

# Copy frontend build output
COPY --from=webbuild /app/web/dist ./public

# ─── Stage 3: Lean production image ───────────────────────────────────────────
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=serverbuild /app/server ./

EXPOSE 4001

# db push runs at startup (needs the mounted /data volume to exist first)
# seed.js is idempotent — safe to run every time
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node prisma/seed.js && node src/index.js"]
