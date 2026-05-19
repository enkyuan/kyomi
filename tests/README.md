# Monorepo tests

All automated tests live here, split by app surface and depth.

```
tests/
  api/
    integration/   # module and service tests (bun)
    e2e/           # full HTTP/API flows (reserved)
  web/
    integration/   # components, hooks, reader (vitest + jsdom)
    e2e/           # browser flows (reserved)
```

## Commands

From the repo root:

```bash
bun run test                  # api + web integration
bun run test:api              # api integration only
bun run test:api:integration
bun run test:api:e2e
bun run test:web              # web integration only
bun run test:web:integration
bun run test:web:e2e
```

Or from this package: `bun run --cwd tests <script>`.
