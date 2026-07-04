# @kyomi/tests

integration and end-to-end suites for the monorepo.

## layout

```text
tests/
  api/
    integration/  Bun tests that mirror apps/api/src.
  web/
    integration/  Vitest/jsdom tests grouped by app, module, and package.
```

the api integration tree tracks `apps/api/src` closely so test ownership is obvious during refactors.

## commands

run from the repository root.

| command | purpose |
| --- | --- |
| `bun run test` | run api and web integration. |
| `bun run test:api` | run api integration. |
| `bun run test:api:e2e` | run api end-to-end. |
| `bun run test:web` | run web integration. |
| `bun run test:web:e2e` | run web end-to-end. |
| `bun run --cwd tests typecheck` | type-check. |
| `bun run --cwd tests lint` | lint. |
| `bun run --cwd tests fmt:check` | check formatting. |

## notes

- api tests run from `apps/api` so they pick up the same env files and runtime aliases as the app.
- e2e scripts are wired in `tests/package.json`. add `tests/api/e2e` or `tests/web/e2e` when those suites land.
