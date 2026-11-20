# CI/CD

Kyomi's PR and `main` CI runs on CircleCI (`.circleci/`). GitHub Actions keeps only the react-doctor PR comment, which needs the repository's `GITHUB_TOKEN` and is free on GitHub-hosted runners because the repository is public.

## Pipelines

| Where          | File                     | Trigger                                                    | Purpose                                                                                                                     |
| -------------- | ------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| CircleCI       | `.circleci/config.yml`   | Every pipeline                                             | Setup job: diffs the change against `main` (or the previous commit on `main`) and continues with only the areas it touches. |
| CircleCI       | `.circleci/continue.yml` | Continued from setup                                       | The `ci` workflow: the monorepo quality gate.                                                                               |
| GitHub Actions | `rd.check.yml`           | Pull requests and `main`, except docs/catalog-only changes | react-doctor report on the PR.                                                                                              |

## What runs for a change

The setup job maps changed paths to areas. Docs, Markdown, `.agents/`, `.pi/` and `.github/` changes reach no build or test.

| Area      | Paths                                                                                            | Jobs                                                            |
| --------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `app`     | Anything outside `packages/catalog/` (and the excluded paths above)                              | `static-quality`, `web-tests`, `api-tests`, `build-web`, `build-mobile` |
| `mobile`  | `apps/mobile/`, any shared package outside `packages/catalog/`, lockfile, manifest, `turbo.json`, `.bun-version` | `build-mobile` on PRs (always runs on `main`)                   |
| `docker`  | Dockerfiles, `.dockerignore`, `.bun-version`, `bun.lock`, `package.json` manifests, `turbo.json` | `docker-build` (on `main`, any `app` change also builds images) |
| `catalog` | `packages/catalog/**`, `.circleci/**`                                                            | `catalog-typecheck`                                             |

Only `docker-build` waits for `static-quality`; every other job starts immediately, so a run takes as long as its slowest job. `build-mobile` exports iOS on PRs and all platforms on `main`. `static-quality` restores Turbo's local cache, so packages whose inputs did not change replay their lint/format/typecheck result.

## Required Branch Check

Use `ci-summary` as the single required branch-protection check. It is always reported: the `ci` workflow (full gate) runs when the `app` area changed, and `ci-light` (secret scan, catalog typecheck, `ci-summary`) runs otherwise, so docs-only changes never provision service containers or large executors. Inside `ci`, a job whose area did not change finishes in seconds. In `ci`, `ci-summary` depends on:

- `static-quality`
- `web-tests`
- `api-tests`
- `build-web`
- `build-mobile`
- `docker-build`
- `catalog-typecheck`

If any dependency fails, `ci-summary` does not run and the PR stays blocked.

## CircleCI project settings

These settings are part of the CI design; set them once in the CircleCI project:

- **Advanced → Enable dynamic config using setup workflows**: on (the path filtering needs it).
- **Advanced → Auto-cancel redundant workflows**: on, so a new push cancels the previous pipeline on that branch.
- **Triggers** (GitHub App) or **Advanced → Only build pull requests** (OAuth): build pull requests and `main` only, not every pushed branch. Skip draft PRs if the trigger offers it.

A commit message containing `[ci skip]` or `[skip ci]` starts no pipeline.

## Cost controls

- `api-tests` is sharded across 2 containers (`parallelism: 2`, `medium+`) with `circleci tests split --split-by=timings`; JUnit output goes to `store_test_results` so later runs balance by recorded timings. Raise `parallelism` if the job becomes the critical path.
- Turbo caches for `static-quality` and `build` are saved from `main` only; branches restore `main`'s cache and upload nothing.
- Every test and build step has `no_output_timeout: 10m` and a `timeout` wrapper, so a hung step fails instead of holding a container.
- `web-tests` and `api-tests` skip the oxfmt/oxlint prefetch.

## Job Ownership

| Job                 | Owns                                                                                               | Local equivalent                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `static-quality`    | Env encryption, formatting, linting, import boundaries, app typechecking, Drizzle migration drift. | `bun run ci:static`                                                                |
| `web-tests`         | Web integration tests under `tests/web`.                                                           | `bun run ci:test:web`                                                              |
| `api-tests`         | API integration tests with Postgres, Redis, and Meilisearch.                                       | `bun run ci:test:api`                                                              |
| `build-web`         | Web and www builds, breakpoint CSS check, bundle budget.                                           | `bun run ci:build:web`                                                             |
| `build-mobile`      | Expo export (iOS on PRs, all platforms on `main`).                                                 | `bun run ci:build:mobile` (`MOBILE_PLATFORM=all` for every platform)               |
| `docker-build`      | Local API and Web image build smoke.                                                               | `bun run ci:docker:build`                                                          |
| `catalog-typecheck` | Catalog dependency sync and `ty` typecheck.                                                        | `bun run --cwd packages/catalog setup && bun run --cwd packages/catalog typecheck` |

## Runtime Versions

- Bun is pinned by `.bun-version` and `packageManager` to `1.3.14`; CircleCI installs exactly that version.
- Docker builds accept `BUN_VERSION` and default to `1.3.14`.
- Catalog CI uses Python `3.13` with `uv`.

## Services

`api-tests` runs these as CircleCI secondary containers:

- `postgres:18-alpine`
- `redis:8-alpine`
- `getmeili/meilisearch:v1.15`

No secrets are required for PR CI. The helper script `scripts/ci/prepare-env.ts` resets env files from checked-in examples under `CI=true`, creates missing local env files from those examples, and preserves existing local env files unless `KYOMI_FORCE_PREPARE_ENV=1` is set.

## Package publishing

`@kyomi/ui`, `@kyomi/reader` and the other workspace packages are `private` and are consumed only through `workspace:*` links, so nothing is published to a registry. GitHub Packages scopes npm packages to the repository owner's account (`@enkyuan`), so publishing them would need either a scope rename or publish-time renaming, plus a published `@kyomi/ingest` for `@kyomi/reader`.

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
