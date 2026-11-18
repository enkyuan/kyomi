# syntax=docker/dockerfile:1.7

ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app

COPY .bun-version bun.lock package.json turbo.json ./
COPY patches/ patches/
COPY apps/api/package.json apps/api/package.json
COPY apps/ai-gateway/package.json apps/ai-gateway/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/catalog/package.json packages/catalog/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/reader/package.json packages/reader/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/ingest/package.json packages/ingest/package.json
COPY tests/package.json tests/package.json

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --ignore-scripts

FROM deps AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

COPY apps/api apps/api
COPY docker docker
COPY packages/db packages/db
COPY packages/tsconfig packages/tsconfig
COPY packages/ingest packages/ingest

WORKDIR /app/apps/api
EXPOSE 8000

# The server only reads its files, so it does not need root; the base image ships this user.
USER bun

CMD ["bun", "src/app/boot/server.ts"]
