# GitHub Actions CI/CD Implementation Plan

## Summary

Build a clean GitHub Actions CI/CD spine for Kyomi's Bun/Turborepo monorepo.

CI will cover app/static quality, service-backed API tests, web tests, Docker build smoke, and catalog checks in a separate path-filtered workflow. CD will publish GHCR Docker images for API and Web after CI-grade verification, but will not deploy to production until a hosting target is chosen.

Key repo facts folded into the plan:

- Root uses Bun + Turbo, but Bun is currently inconsistent: root says `bun@1.1.0`, Docker uses `oven/bun:1.3`, local is `1.3.14`.
- No existing `.github/workflows`.
- API tests need Postgres, Redis, and Meilisearch.
- `packages/catalog` is optional Python/uv work and should not slow every PR.

## Key Changes

- Normalize runtime versioning:
  - Create `.bun-version` with `1.3.14`.
  - Update root `packageManager` to `bun@1.3.14`.
  - Pin Docker/CI image args to Bun `1.3.14`.

- Add CI scripts to `package.json`:
  - `ci:static`: format, lint, import boundaries, app typecheck, Drizzle drift check.
  - `ci:test:web`: `bun run test:web:integration`.
  - `ci:test:api`: `bun run test:api:integration`.
  - `ci:build`: `bun run build`.
  - `ci:docker:build`: build API and Web Docker images locally.

- Fill missing workspace quality scripts:
  - Add `fmt`, `fmt:check`, `lint`, `lint:fix`, and/or `typecheck` where missing in `apps/web`, `packages/db`, `packages/worker`, `packages/ui`, `packages/reader`, `tests`, and `apps/mobile`.
  - Keep catalog quality in its own workflow using `uv`, not the main app CI.

- Create workflow/action files:
  - `.github/actions/setup-bun/action.yml`: checkout is job-owned; this action installs Bun via `oven-sh/setup-bun@v2`, caches Bun package cache and `.turbo`, then runs `bun install --frozen-lockfile`.
  - `.github/workflows/ci.yml`: main PR and `main` branch CI.
  - `.github/workflows/catalog.yml`: path-filtered catalog quality.
  - `.github/workflows/delivery.yml`: protected GHCR image publish.
  - `scripts/ci/prepare-env.sh`: deterministic CI env setup from checked-in examples.
  - `scripts/ci/check-drizzle-drift.sh`: run Drizzle generate and fail on migration/schema drift.
  - `docker/api.Dockerfile`, `docker/web.Dockerfile`, `.dockerignore`, and `docs/ci-cd.md`.

## Workflow Shape

`ci.yml` jobs:

- `static-quality`: `bun run ci:static`.
- `web-tests`: `bun run ci:test:web`.
- `api-tests`: GitHub service containers for Postgres 18, Redis 8, Meilisearch 1.15, then `bun run ci:test:api`.
- `build`: `bun run ci:build`.
- `docker-build`: `bun run ci:docker:build`.
- `ci-summary`: depends on all prior jobs and is the single required branch-protection check.

Use:

- `permissions: contents: read` by default.
- `concurrency.group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}` with `cancel-in-progress: true`.
- Explicit job names and timeouts.
- No secrets in PR CI.

`catalog.yml` jobs:

- Trigger only on `packages/catalog/**`, its workflow file, or manual dispatch.
- Use `astral-sh/setup-uv` with Python `3.13`.
- Run `bun run --cwd packages/catalog setup` and `bun run --cwd packages/catalog typecheck`.

`delivery.yml` jobs:

- Trigger on `push` to `main`, tags `v*`, and `workflow_dispatch`.
- Run a fast verification gate before publishing.
- Log in to GHCR with `GITHUB_TOKEN`.
- Publish:
  - `ghcr.io/enkyuan/kyomi-api`
  - `ghcr.io/enkyuan/kyomi-web`
- Use `permissions: contents: read, packages: write, attestations: write, id-token: write`.
- Use a protected `delivery` environment.
- Do not run production deployment commands yet.

## Implementation Tasks

1. Runtime and script normalization
   - Add `.bun-version`.
   - Update Bun version references.
   - Add root `ci:*` scripts.
   - Add missing package quality scripts.
   - Verify: `bun install --frozen-lockfile`, `bun run ci:static`.

2. CI helper scripts
   - Add `scripts/ci/prepare-env.sh`.
   - Add `scripts/ci/check-drizzle-drift.sh`.
   - Both scripts use `set -euo pipefail`, readable section headers, and actionable failure text.
   - Verify: run both locally from repo root.

3. Main CI workflow
   - Add `.github/actions/setup-bun/action.yml`.
   - Add `.github/workflows/ci.yml`.
   - API job uses service containers, not `docker compose`.
   - Verify: `act` if available, otherwise push branch and inspect job graph.

4. Catalog workflow
   - Add `.github/workflows/catalog.yml`.
   - Keep catalog out of normal app CI unless catalog files changed.
   - Verify: workflow dispatch plus a catalog-only PR.

5. Delivery workflow and images
   - Add `.dockerignore`, `docker/api.Dockerfile`, `docker/web.Dockerfile`.
   - Add `apps/web` `start` script for `.output/server/index.mjs`.
   - Add `.github/workflows/delivery.yml`.
   - Verify: `bun run ci:docker:build`; delivery workflow dry run via manual dispatch with push disabled until review.

6. Documentation
   - Add `docs/ci-cd.md` with job ownership, required branch checks, required secrets/vars, image tags, and how to debug each failing job.
   - Include "local equivalent command" for every workflow job.

## Test Plan

Run locally before opening the PR:

```bash
bun install --frozen-lockfile
bun run ci:static
bun run ci:test:web
bun run ci:test:api
bun run ci:build
bun run ci:docker:build
bun run --cwd packages/catalog setup
bun run --cwd packages/catalog typecheck
```

GitHub verification:

- PR touching `apps/api` runs `static-quality`, `api-tests`, `build`, `docker-build`, `ci-summary`.
- PR touching `apps/web` runs `static-quality`, `web-tests`, `build`, `docker-build`, `ci-summary`.
- PR touching only `packages/catalog` also runs `catalog.yml`.
- Failed API service startup shows health-check output, not a silent timeout.
- `delivery.yml` publishes images only after verification passes.

## Assumptions

- CD target defaults to GHCR image publishing because no production host config exists in the repo.
- Primary DX persona is a Kyomi contributor opening a PR.
- Production deploy to Fly/Render/Vercel/ECS/Kubernetes is not in scope for this plan.
- Secrets are not available to PRs from forks.
- Catalog remains optional for normal app setup and app CI.

## Review Notes

Eng review findings folded in:

- Bun version drift is fixed up front.
- Service tests use GitHub service containers with health checks.
- Catalog gets a separate path-filtered workflow.
- CD does not fake a production deploy without a target.
- CI exposes one required summary check for branch protection.

DX review findings folded in:

- Job names map to developer intent.
- Every job has a local command equivalent.
- CI docs explain "what failed, why, and what to run next".
- Delivery is protected and reversible.

Plan-tune result:

- Asked only two material questions.
- Both timed out and auto-resolved to recommended defaults.
- No unresolved decisions remain.

## References

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Actions concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-concurrency)
- [GitHub service containers for PostgreSQL](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers)
- [Bun GitHub Actions guide](https://bun.sh/docs/guides/runtime/cicd)
- [setup-bun action](https://github.com/oven-sh/setup-bun)
- [Turborepo GitHub Actions guide](https://turborepo.com/docs/guides/ci-vendors/github-actions)
- [GitHub OIDC reference](https://docs.github.com/en/actions/reference/security/oidc)
- [Publishing Docker images with GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
| --- | --- | --- | --- | --- | --- |
| Eng Review | `/plan-eng-review` | Architecture, tests, performance | 1 | clear | Bun drift, service containers, catalog split, and CD target ambiguity resolved |
| DX Review | `/plan-devex-review` | Contributor experience | 1 | clear | Optimized for PR contributor feedback loops and readable failures |
| Plan Tune | `/plan-tune` | Question sensitivity | 1 | clear | Two questions asked, both auto-resolved to recommended defaults |

**VERDICT:** ENG + DX CLEARED - ready to save as the CI/CD implementation plan.

NO UNRESOLVED DECISIONS
