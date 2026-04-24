FROM oven/bun:1.3.3-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.3-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN bun run prisma:generate
RUN mkdir -p /app/storage/uploads && chown -R bun:bun /app/storage

USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD bun -e "const response = await fetch('http://127.0.0.1:3000/health/live'); if (!response.ok) process.exit(1);"

ENTRYPOINT ["bun", "run", "src/server.ts"]
