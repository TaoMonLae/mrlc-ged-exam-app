FROM node:20-slim AS webbuild
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

FROM node:20-slim AS serverbuild
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ .
COPY --from=webbuild /app/web/dist ./public

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=serverbuild /app/server ./
EXPOSE 4001
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node prisma/seed.js && node src/index.js"]
