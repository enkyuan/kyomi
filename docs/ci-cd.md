# CI/CD

Kyomi uses GitHub Actions for app CI, optional catalog checks, and GHCR image delivery.

## Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `CI` | Pull requests, pushes to `main`, manual dispatch | Main monorepo quality gate for Bun/Turbo app work. |
| `Catalog` | `packages/catalog/**`, its workflow file, manual dispatch | Optional Python catalog quality path using `uv` and Python 3.13. |
| `Delivery` | Pushes to `main`, `v*` tags, manual dispatch | Verifies the app and publishes API/Web Docker images to GHCR. |

## Required Branch Check

Use `CI Summary` as the single required branch-protection check. It depends on:

- `Static Quality`
- `Web Tests`
- `API Tests`
- `Build`
- `Docker Build`

If any dependency fails, `CI Summary` fails and prints the failing job result.

## Job Ownership

| Job | Owns | Local equivalent |
| --- | --- | --- |
| `Static Quality` | Formatting, linting, import boundaries, app typechecking, Drizzle migration drift. | `bun run ci:static` |
| `Web Tests` | Web integration tests under `tests/web`. | `bun run ci:test:web` |
| `API Tests` | API integration tests with Postgres, Redis, and Meilisearch. | `bun run ci:test:api` |
| `Build` | Turbo workspace builds. | `bun run ci:build` |
| `Docker Build` | Local API and Web image build smoke. | `bun run ci:docker:build` |
| `Catalog Quality` | Catalog dependency sync and `ty` typecheck. | `bun run --cwd packages/catalog setup && bun run --cwd packages/catalog typecheck` |
| `Delivery Verification` | CI-grade verification before publishing images. | `bun run ci:static && bun run ci:test:web && bun run ci:test:api && bun run ci:build` |
| `Publish API Image` | GHCR publish for API. | `docker build -f apps/api/Dockerfile -t kyomi-api:ci .` |
| `Publish Web Image` | GHCR publish for Web. | `docker build -f apps/web/Dockerfile -t kyomi-web:ci .` |

## Runtime Versions

- Bun is pinned by `.bun-version` and `packageManager` to `1.3.14`.
- Docker builds accept `BUN_VERSION` and default to `1.3.14`.
- Catalog CI uses Python `3.13` with `uv`.

## Services

`API Tests` and `Delivery Verification` use GitHub service containers:

- `postgres:18-alpine`
- `redis:8-alpine`
- `getmeili/meilisearch:v1.15`

No repository secrets are required for PR CI. The helper script `scripts/ci/prepare-env.ts` resets env files from checked-in examples under `CI=true`, creates missing local env files from those examples, and preserves existing local env files unless `KYOMI_FORCE_PREPARE_ENV=1` is set.

## Delivery

Delivery publishes:

- `ghcr.io/enkyuan/kyomi-api`
- `ghcr.io/enkyuan/kyomi-web`

Tags are generated from the Git ref and commit SHA:

- Branch pushes, for example `main`
- Git tags, for example `v1.2.3`
- SHA tags, for example `sha-<commit>`

The workflow uses the protected `delivery` environment. It does not deploy to production.

Required permissions:

- `contents: read`
- `packages: write`
- `attestations: write`
- `id-token: write`

Required secrets:

- None beyond the built-in `GITHUB_TOKEN`.

## Debugging Failures

### Static Quality

Run:

```bash
bun run ci:static
```

Common causes:

- Formatting drift: run `bun run fmt`.
- Import boundary drift: inspect `scripts/check-boundaries.ts` output.
- Type errors: run `bun run typecheck:app`.
- Drizzle drift: run `bun run db:generate` and commit the generated migration files.

### Web Tests

Run:

```bash
bun run ci:test:web
```

Failures usually point to `tests/web/integration` or the web module imported by the failing test.

### API Tests

Start local services first:

```bash
bun run docker:up
bun run ci:test:api
```

If GitHub fails before tests run, inspect the service-container health output and the `Show service logs on failure` step.

### Build

Run:

```bash
bun run ci:build
```

For web build issues, check `apps/web/.env` and the TanStack Start/Nitro output under `apps/web/.output`.

### Docker Build

Run:

```bash
bun run ci:docker:build
```

If dependency installation fails inside Docker, check `.dockerignore`, `.bun-version`, `bun.lock`, and workspace `package.json` files.

### Catalog

Run:

```bash
bun run --cwd packages/catalog setup
bun run --cwd packages/catalog typecheck
```

Catalog work is intentionally separate from app CI so normal app contributors do not need Python tooling for unrelated changes.
