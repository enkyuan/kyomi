# @kyomi/tests

Integration test suites and reserved end-to-end entry points for the Kyomi monorepo.

## Layout

```text
tests/
  api/
    integration/  Bun tests grouped to mirror apps/api/src.
  web/
    integration/  Vitest/jsdom tests grouped by app, module, and package surface.
```

The API integration tree should follow `apps/api/src` closely so test ownership is obvious during refactors.

## Commands

Run from the repository root.

| Command | Purpose |
| --- | --- |
| `bun run test` | Run API and web integration suites. |
| `bun run test:api` | Run API integration tests. |
| `bun run test:api:e2e` | Run API end-to-end tests. |
| `bun run test:web` | Run web integration tests. |
| `bun run test:web:e2e` | Run web end-to-end tests. |
| `bun run --cwd tests typecheck` | Type-check test projects. |
| `bun run --cwd tests lint` | Lint test source. |
| `bun run --cwd tests fmt:check` | Check test formatting. |

API tests execute from `apps/api` so they can load the same env files and runtime aliases as the app.
E2E scripts are wired in `tests/package.json`; add `tests/api/e2e` or `tests/web/e2e` when those suites are introduced.
