FROM oven/bun:1.3.13

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# prisma.config.ts requires DATABASE_URL at build time (validated only, no DB connection)
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" bun run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["bun", "run", "start:prod"]
