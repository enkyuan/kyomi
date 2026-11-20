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

FROM deps AS build
WORKDIR /app

ENV NODE_ENV=production
ENV SERVER_URL=http://localhost:3000
ENV API_ORIGIN=http://localhost:8000

COPY apps/web apps/web
COPY docker docker
COPY packages/db packages/db
COPY packages/reader packages/reader
COPY packages/tsconfig packages/tsconfig
COPY packages/ui packages/ui
COPY packages/ingest packages/ingest

RUN bun run --cwd apps/web build

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# The Nitro output is self-contained, so the image carries it alone: no source, workspace packages,
# or dev dependencies. It stays root-owned and read-only to the `bun` user the server runs as.
COPY --from=build /app/apps/web/.output .output

USER bun
EXPOSE 3000

CMD ["bun", ".output/server/index.mjs"]
