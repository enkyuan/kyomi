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
3. Reusable logic should be promoted into `packages/*` once consumed by multiple app modules.
4. Workspace-wide TypeScript baselines live in `packages/tsconfig`.

## Shared UI (`packages/ui`)

- `src/*.tsx`: shadcn-style primitives (import `@kyomi/ui/button`, etc.).
- `src/icons/`: product illustrations and empty-state artwork (`@kyomi/ui/icons/…`). See `src/icons/README.md` before adding new icons.

## Current Shared Baselines

- `packages/tsconfig/base.json`: default strict TS compiler baseline.
- `packages/tsconfig/web.json`: browser/react-focused TS defaults.
- `packages/tsconfig/node.json`: node/server-focused TS defaults.

