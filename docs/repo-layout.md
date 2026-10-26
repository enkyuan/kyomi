# Repo Layout

This repository follows a monorepo shape modeled after larger production repos:

- `apps/`: executable products and deployment entrypoints.
- `packages/`: reusable domain/shared libraries consumed by apps.
- `docker/`: local infrastructure orchestration.
- `scripts/`: repository-level automation and checks.
- `docs/`: architecture and operational documentation.

## Boundary Rules

1. `apps/web` should contain route/view composition and UI wiring, not core domain rules.
2. `apps/api` should contain transport/orchestration boundaries, not reusable business logic.
3. `apps/embeddings` is the Cloudflare Worker that serves embeddings to the article classifier;
   it should contain only its `/embed` HTTP contract.
4. `apps/desktop` is the GPUIX desktop client (React painted by GPUI on Bun); it composes shared
   packages and keeps its view layer in `<div>`/`<text>`, not DOM or React Native components.
5. Reusable logic should be promoted into `packages/*` once consumed by multiple app modules.
6. Workspace-wide TypeScript baselines live in `packages/tsconfig`.

## Shared UI (`packages/ui`)

- `src/components/*.tsx`: shadcn/coss-style Base UI primitives (import `@kyomi/ui/components/button`, etc.); multi-file primitives live in `src/components/<name>/index.tsx`.
- `src/hooks/`, `src/lib/`, `src/native/`: shared hooks, utilities (`@kyomi/ui/lib/motion`, `lib/utils`), and native-safe contracts.
- `src/styles/`: `globals.css` entrypoint (`@kyomi/ui/globals.css`) plus token and CSS modules (`@kyomi/ui/styles/*`). See `packages/ui/README.md`.
- `src/icons/`: product illustrations and empty-state artwork (`@kyomi/ui/icons/…`). See `src/icons/README.md` before adding new icons.

## Current Shared Baselines

- `packages/tsconfig/base.json`: default strict TS compiler baseline.
- `packages/tsconfig/web.json`: browser/react-focused TS defaults.
- `packages/tsconfig/node.json`: node/server-focused TS defaults.

