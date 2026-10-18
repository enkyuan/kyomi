# CI/CD

Kyomi's PR and `main` CI runs on CircleCI (`.circleci/`). GitHub Actions keeps only the jobs that need the repository's `GITHUB_TOKEN`: package delivery and the react-doctor PR comment. Both are free on GitHub-hosted runners because the repository is public.

## Pipelines

| Where | File | Trigger | Purpose |
| --- | --- | --- | --- |
| CircleCI | `.circleci/config.yml` | Every pipeline | Setup job: diffs the change against `main` (or the previous commit on `main`) and continues with only the areas it touches. |
| CircleCI | `.circleci/continue.yml` | Continued from setup | The `ci` workflow: the monorepo quality gate. |
| GitHub Actions | `delivery.publish.yml` | Pushes to `main`, `v*` tags, manual dispatch | Publishes `@kyomi/ui` and `@kyomi/reader` to GitHub Packages when their version is new. |
| GitHub Actions | `rd.check.yml` | Pull requests and `main`, except docs/catalog-only changes | react-doctor report on the PR. |

## What runs for a change

The setup job maps changed paths to areas. Docs, Markdown, `.agents/`, `.pi/`, `scratch/` and `.github/` changes reach no build or test.

| Area | Paths | Jobs |
| --- | --- | --- |
| `app` | Anything outside `packages/catalog/` (and the excluded paths above) | `static-quality`, then `web-tests`, `api-tests`, `build` |
| `docker` | Dockerfiles, `.dockerignore`, `.bun-version`, `bun.lock`, `package.json` manifests, `turbo.json`, `patches/` | `docker-build` (on `main`, any `app` change also builds images) |
| `catalog` | `packages/catalog/**`, `.circleci/**` | `catalog-typecheck` |

`web-tests`, `api-tests`, `build` and `docker-build` wait for `static-quality`: a formatting or type error fails the pipeline in one cheap job instead of five parallel ones. `static-quality` restores Turbo's local cache, so packages whose inputs did not change replay their lint/format/typecheck result.

## Required Branch Check

Use `ci-summary` as the single required branch-protection check. Every job is always part of the `ci` workflow; a job whose area did not change finishes in seconds without installing anything, so `ci-summary` always reports. It depends on:

- `static-quality`
- `web-tests`
- `api-tests`
- `build`
- `docker-build`
- `catalog-typecheck`

If any dependency fails, `ci-summary` does not run and the PR stays blocked.

## CircleCI project settings

These settings are part of the CI design; set them once in the CircleCI project:

- **Advanced → Enable dynamic config using setup workflows**: on (the path filtering needs it).
- **Advanced → Auto-cancel redundant workflows**: on, so a new push cancels the previous pipeline on that branch.
- **Triggers** (GitHub App) or **Advanced → Only build pull requests** (OAuth): build pull requests and `main` only, not every pushed branch. Skip draft PRs if the trigger offers it.

A commit message containing `[ci skip]` or `[skip ci]` starts no pipeline.

## Job Ownership

| Job | Owns | Local equivalent |
| --- | --- | --- |
| `static-quality` | Env encryption, formatting, linting, import boundaries, app typechecking, Drizzle migration drift. | `bun run ci:static` |
| `web-tests` | Web integration tests under `tests/web`. | `bun run ci:test:web` |
| `api-tests` | API integration tests with Postgres, Redis, and Meilisearch. | `bun run ci:test:api` |
| `build` | Turbo workspace builds and the breakpoint CSS check. | `bun run ci:build` |
| `docker-build` | Local API and Web image build smoke. | `bun run ci:docker:build` |
| `catalog-typecheck` | Catalog dependency sync and `ty` typecheck. | `bun run --cwd packages/catalog setup && bun run --cwd packages/catalog typecheck` |
| `plan` (delivery) | Skips delivery when no package version is new. | `npm view <name>@<version>` |
| `verify` (delivery) | CI-grade verification before publishing packages. | `bun run ci:static && bun run ci:test:web && bun run ci:test:api && bun run ci:build` |

## Runtime Versions

- Bun is pinned by `.bun-version` and `packageManager` to `1.3.14`; CircleCI installs exactly that version.
- Docker builds accept `BUN_VERSION` and default to `1.3.14`.
- Catalog CI uses Python `3.13` with `uv`.

## Services

`api-tests` (CircleCI secondary containers) and delivery `verify` (GitHub service containers) use:

- `postgres:18-alpine`
- `redis:8-alpine`
- `getmeili/meilisearch:v1.15`

No secrets are required for PR CI. The helper script `scripts/ci/prepare-env.ts` resets env files from checked-in examples under `CI=true`, creates missing local env files from those examples, and preserves existing local env files unless `KYOMI_FORCE_PREPARE_ENV=1` is set.

## Delivery

Delivery publishes `@kyomi/ui` and `@kyomi/reader` to GitHub Packages (`https://npm.pkg.github.com`) when the version in their `package.json` is not yet published. It uses the protected `delivery` environment and the built-in `GITHUB_TOKEN`; it does not deploy to production.

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

If CircleCI fails before tests run, inspect the `Wait for Postgres, Redis and Meilisearch` step and the secondary containers' output in the job's Resources tab.

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
