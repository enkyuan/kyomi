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

After authentication, read `GET /api/v1/me/onboarding` with the current Better Auth cookie. The response contains `status`, the saved `draft`, the first missing `nextField`, `completedAt`, and the available categories and bundles with their feed previews. New users start pending. Accounts present when migration 0045 runs are complete.

For a TanStack Router client, check this endpoint in the authenticated parent route's `beforeLoad`, forwarding the incoming cookie on SSR. On 401 use the existing sign-in flow. Redirect a pending user to onboarding only when outside that route. Send a completed user who opens onboarding to their validated internal return path or inbox. Surface network and server failures with retry. Invalidate router state after completion, sign-in, sign-out, or account switching. Completion is account-scoped and comes from PostgreSQL on each read.

- `PATCH /api/v1/me/onboarding` saves any nonempty subset of `name`, `username`, `categories`, `language`, and `bundleIds`. Arrays replace the corresponding selection. Language accepts a BCP 47 locale such as `en-US`. Categories and bundle IDs come from the options response. A 422 includes field paths under `error.details.issues`.
- `GET /api/v1/me/onboarding/username?username=example` checks the indexed handle. An optional leading @ and letter case normalize to the same handle. Availability is advisory until completion.
- `PUT /api/v1/me/onboarding/completion` validates the saved draft, claims the handle, updates the profile name, and subscribes the account to its selected feeds in one transaction. A conflicting claim returns 409 with `USERNAME_TAKEN`. Save another username and retry. Repeating a successful completion returns the stored state. Subscriptions are available immediately and the existing scheduler refreshes new feeds.

The HTTP journey in `tests/api/e2e/onboarding.test.ts` uses real auth sessions. Set `ONBOARDING_TEST_DATABASE_URL` to a disposable database with migrations applied before running `bun run --cwd tests test:api:e2e`.

For the web implementation, add an authenticated onboarding route outside the inbox shell. Reuse the auth guard in `routes/-guards.ts` and the return-path validation in `modules/auth/redirect.ts`. Check onboarding after authentication in `routes/_app/route.tsx` and on the onboarding route itself. Keep the API calls in module-owned TanStack Start server functions. For form mutations, preserve the API's machine code and field paths in typed action results. The existing `apiJson` helper throws an HTTP status error and discards those details. Render a taken handle or invalid field beside the input and let unexpected loader failures reach the existing route error boundary.

### Reader translation

Onboarding completion copies the canonical BCP 47 language tag into the account's reader preferences in the same transaction. Existing users can change it in web Settings → Appearance → Reading or through `PATCH /api/v1/me/preferences`. Migration 0046 carries forward languages from completed onboarding records. Accounts without a selection default to English.

An authenticated `POST /api/v1/articles/:articleId/translate` accepts an optional reader mode, source language and target language. The API translates the stored feed article body. It derives the source from article or feed metadata and uses the model's English default when both are missing. Region and script stay in the user's preference. The provider receives its supported base code. Clips, unsupported languages and bodies longer than 6,000 characters are outside this provider contract.

The response includes a translation ID and status. Poll `GET /api/v1/articles/:articleId/translations/:translationId` until ready or failed. The web toolbar renders ready text and can restore the original. Polls do not enqueue work. Identical article content, language pair and model share a translation. Worker leases guard writes, and the scheduler republishes stalled work. An explicit new request can retry a terminal failure.

Set the gateway's private `TRANSLATIONS_TOKEN` and configure `FEATURE_ARTICLE_TRANSLATIONS`, `CLOUDFLARE_TRANSLATIONS_URL` (the HTTPS `/translate` endpoint) and `CLOUDFLARE_TRANSLATIONS_TOKEN` for the API, scheduler and worker. Translation defaults off. Custom `JOB_STREAMS` must include `jobs:article-translation` on a worker. The gateway calls [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/models/m2m100-1.2b/) using [Meta's M2M100 language vocabulary](https://huggingface.co/facebook/m2m100_1.2B).
