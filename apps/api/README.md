# @kyomi/api

the backend. built with Bun and Elysia.

## layout

```text
src/
  app/       `runtime.ts` (`AppLive`, the one composition root), process boot (`boot/server.ts`, `worker.ts`, `scheduler.ts`, `dev.ts`, operator scripts), HTTP assembly, jobs, and `setup/main.ts` (`runMain`).
  adapters/  Effect services and Layers for auth, database, logging, Redis, queue, rate limits, search, and outbound HTTP, plus CORS and OpenAPI plugins.
  config/    typed environment loading (`AppConfig` service).
  modules/   product domains: articles, catalog, discover, favicon, feeds, folders, health, inbox, opml, queue, users.
  shared/    the typed error catalogue, the Elysia to Effect bridge and error rendering, network guards, and text decoding used across modules.
```

product routes mount under `/api/v1`. probes live at `/health`, `/ready`, `/queue/health`, and their `/api/*` mirrors.

## commands

| command                            | purpose                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `bun run dev:api`                  | follow Docker logs for `api`, `worker`, and `scheduler`.   |
| `bun run dev:api:host`             | run api, worker, and scheduler locally with file watching. |
| `bun run --cwd apps/api start`     | start the HTTP api.                                        |
| `bun run --cwd apps/api worker`    | start Redis Stream consumers.                              |
| `bun run --cwd apps/api scheduler` | claim due feeds and publish refresh jobs.                  |
| `bun run --cwd apps/api typecheck` | type-check.                                                |
| `bun run --cwd apps/api lint`      | lint.                                                      |
| `bun run --cwd apps/api fmt:check` | check formatting.                                          |

operator scripts live in `src/app/boot` because they write through api adapters. each file is one word of its script key (`category:audit` runs `audit.ts`):

| command                              | purpose                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bun run catalog:import`             | import `packages/catalog/processing/exports/catalog-feeds.jsonl` (`import.ts`).                                                                                                                                    |
| `bun run catalog:smoke`              | verify seeded catalog discovery (`smoke.ts`).                                                                                                                                                                      |
| `bun run categories:backfill`        | backfill feed and article categories (`backfill.ts`).                                                                                                                                                              |
| `bun run categories:report`          | report category coverage (`report.ts`).                                                                                                                                                                            |
| `bun run categories:audit`           | score category assignments against labels (`audit.ts`).                                                                                                                                                            |
| `bun run content:sanitizer-backfill` | backfill the article sanitizer version (`sanitizer.ts`).                                                                                                                                                           |
| `bun run content:urls-repair`        | one-off repair of stored feed and item URLs that carry a login or are not http(s) (`urls.ts`); dry run unless `--apply`, prints the feed ids to re-index in Meilisearch and the feeds whose own url holds a login. |

## notes

- env is loaded with `dotenvx` from `docker/.env` and `apps/api/.env`.
- database schema lives in `packages/db`; migrations run through the root `db:*` scripts.
- the api runs on Effect v4: services and Layers composed once in `src/app/runtime.ts`, typed errors rendered to one wire envelope, and every process entrypoint run through `runMain` so Layer scopes own shutdown. Elysia stays the HTTP adapter. see [`docs/architecture/api-effect.md`](../../docs/architecture/api-effect.md).
- tests swap Layers (`tests/api/integration/support/layers.ts`) instead of `mock.module` or patching `fetch`; tests that need no services run with `SKIP_ENV_VALIDATION=true bunx --no-install dotenvx run -f ../../docker/.env.example -f .env.example -- bun test ../../tests/api/integration/<path>` from `apps/api`.
- shared ingestion, queue contracts, and sanitization live in `@kyomi/ingest`. this app owns the executable processes that drive them.

### Signup onboarding

Use the current Better Auth session for all onboarding requests. New accounts start pending. Migration 0045 marks accounts that already exist as complete.

- `GET /api/v1/me/onboarding/status` returns the account's pending or complete status for route guards. The full `GET /api/v1/me/onboarding` also returns the draft, the first incomplete field and the available options.
- `PATCH /api/v1/me/onboarding` saves a nonempty subset of `username`, `categories`, `language` and `bundleIds`. The categories step requires three distinct interests, and the bundles step requires at least one bundle. Language accepts supported BCP 47 locales. A 422 response includes the field paths under `error.details.issues`.
- `GET /api/v1/me/onboarding/username?username=example` normalizes optional @ and casing. A bounded Bloom-backed cache accelerates recently confirmed taken names for 15 seconds. Other lookups use the PostgreSQL unique index.
- `PUT /api/v1/me/onboarding/completion` claims the username, saves the language preference and creates subscriptions in one transaction. The index settles simultaneous claims and the loser receives a 409 with `USERNAME_TAKEN`. Completion can be retried. The scheduler refreshes newly added feeds.

The HTTP journey in `tests/api/e2e/onboarding.test.ts` uses real auth sessions. Set `ONBOARDING_TEST_DATABASE_URL` to a disposable database with migrations applied before running `bun run --cwd tests test:api:e2e`.

### Reader translation

Onboarding completion copies the canonical BCP 47 language tag into the account's reader preferences in the same transaction. Existing users can change it in web Settings → Appearance → Reading or through `PATCH /api/v1/me/preferences`. Migration 0046 carries forward languages from completed onboarding records. Accounts without a selection default to English.

An authenticated `POST /api/v1/articles/:articleId/translate` accepts an optional reader mode, source language and target language. The API translates the stored feed article body. It derives the source from article or feed metadata and uses the model's English default when both are missing. Region and script stay in the user's preference. The provider receives its supported base code. Clips, unsupported languages and bodies longer than 6,000 characters are outside this provider contract.

The response includes a translation ID and status. Poll `GET /api/v1/articles/:articleId/translations/:translationId` until ready or failed. The web toolbar renders ready text and can restore the original. Polls do not enqueue work. Identical article content, language pair and model share a translation. Worker leases guard writes, and the scheduler republishes stalled work. An explicit new request can retry a terminal failure.

Set the gateway's private `TRANSLATIONS_TOKEN` and configure `FEATURE_ARTICLE_TRANSLATIONS`, `CLOUDFLARE_TRANSLATIONS_URL` (the HTTPS `/translate` endpoint) and `CLOUDFLARE_TRANSLATIONS_TOKEN` for the API, scheduler and worker. Translation defaults off. Custom `JOB_STREAMS` must include `jobs:article-translation` on a worker. The gateway calls [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/) using [Meta's M2M100 language vocabulary](https://huggingface.co/facebook/m2m100_1.2B).
