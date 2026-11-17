# API on Effect

`apps/api` runs on [Effect](https://effect.website) v4
(`effect@4.1.4`). Elysia stays the HTTP adapter. `@kyomi/db`, `@kyomi/ingest`, `@kyomi/reader`,
drizzle-orm 0.45 and better-auth stay Promise-based and are wrapped at the API boundary.

**Most Effect examples online and in model memory are v3 and do not compile.** Learn an API from the
installed declarations (`apps/api/node_modules/effect/dist/*.d.ts`) and the v4 docs, never from
memory. The names below were checked against 4.1.4.

## Where things live

| Path                                                                                          | Holds                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/effect/errors.ts`                                                                 | The typed error catalogue.                                                                                                                                                                                                                                                                                                                                                                               |
| `src/shared/effect/request.ts`                                                                | `RequestContext` and `CurrentUser` services (per request).                                                                                                                                                                                                                                                                                                                                               |
| `src/shared/http/error/render.ts`                                                             | `describeError` / `describeCause`: the one edge mapper. `EffectFailure`.                                                                                                                                                                                                                                                                                                                                 |
| `src/shared/http/effect/bridge.ts`                                                            | `runEffect(ctx, effect)`: the typed Elysia to Effect bridge.                                                                                                                                                                                                                                                                                                                                             |
| `src/shared/http/effect/plugin.ts`                                                            | `effectPlugin(runtime)`: derives `runEffect` on the Elysia context (the runtime itself is not decorated: Elysia deep-merges decorators on every mount).                                                                                                                                                                                                                                                  |
| `src/config/env/service.ts`                                                                   | `AppConfig` (validated env as a service).                                                                                                                                                                                                                                                                                                                                                                |
| `src/adapters/<capability>/service.ts`                                                        | `Db`, `Redis`, `AppLogger` services and their live Layers.                                                                                                                                                                                                                                                                                                                                               |
| `src/adapters/http/client.ts`                                                                 | `HttpClientLive` (the `HttpClient` service from `effect/http`).                                                                                                                                                                                                                                                                                                                                          |
| `src/adapters/queue/service.ts`                                                               | `JobQueue.publish(job)`: the producer side of the Redis Streams job queue.                                                                                                                                                                                                                                                                                                                               |
| `src/adapters/queue/backoff.ts`                                                               | `retryDelayMs`: the full-jitter delay before a failed job's next attempt (5s doubling to 5 minutes).                                                                                                                                                                                                                                                                                                     |
| `src/adapters/queue/consumer.ts`                                                              | `startConsumers`: scoped, supervised stream consumers with drain on shutdown and delayed retries.                                                                                                                                                                                                                                                                                                        |
| `src/adapters/auth/service.ts`                                                                | `Auth` (Better Auth: `handle`, `sessionUserId`, `listSessions`). Sign-in emails run on a layer-owned `FiberSet`. `redact.ts`: strips the session token from the `get-session` body and from `listSessions` output. `session.ts`: `requireAuth`, `resolveSessionContext(runtime, request, set)`.                                                                                                          |
| `src/adapters/rate-limit/service.ts`                                                          | `RateLimiter.enforce(subject, rule)`: Redis counters, scoped in-memory fallback. `plugin.ts`: `rateLimitPlugin(runtime)` puts `enforceRateLimit` on the Elysia context for `enforceRateLimitForContext`.                                                                                                                                                                                                 |
| `src/adapters/search/service.ts`                                                              | `FeedSearch` (Meilisearch over `HttpClient`): `isConfigured`, `upsert`, `remove`, `search`.                                                                                                                                                                                                                                                                                                              |
| `src/shared/net/outbound.ts`                                                                  | `checkOutboundUrl` (SSRF policy as an Effect) and `HostResolver`, a `Context.Reference` whose default is system DNS; tests `Effect.provideService(HostResolver, ...)`.                                                                                                                                                                                                                                   |
| `src/modules/feeds/service.ts`, `favicon/service.ts`, `catalog/embeddings.ts`, `opml/live.ts` | Module seams: `FeedBackground` (post-response work on the runtime scope), `FaviconResolver` and `Embeddings` (the `@kyomi/ingest` favicon and embeddings clients, which use the global `fetch`, wrapped once with typed errors), `OpmlFeedsLive` (`OpmlFeeds` over feeds and folders, so OPML code needs only `OpmlFeeds`). All are in `AppLive`; tests provide fake Layers instead of patching `fetch`. |
| `src/modules/catalog/`                                                                        | Operator scripts' behaviour (`import/`, `backfill/`, `category-model/`) as Effects with their own tagged errors (`errors.ts`); `app/boot/*.ts` only run them.                                                                                                                                                                                                                                            |
| `src/app/jobs/`                                                                               | `handler.ts` (job dispatch), `classify.ts` (typed failure classes), `consumer.ts` (`WorkerLive`), `scheduler.ts`, `dispatcher.ts` (loops).                                                                                                                                                                                                                                                               |
| `src/app/setup/main.ts`                                                                       | `runMain(effect)`: process entrypoint that turns SIGINT/SIGTERM into fiber interruption.                                                                                                                                                                                                                                                                                                                 |
| `src/app/runtime.ts`                                                                          | `AppLive` and `createAppRuntime()`: the one composition root.                                                                                                                                                                                                                                                                                                                                            |
| `tests/api/integration/support/layers.ts`                                                     | Test Layers (fake db/redis/http, recording logger, config).                                                                                                                                                                                                                                                                                                                                              |

A module's Effects sit in its existing role files (`operations.ts`, `queries.ts`, `checks.ts`) and
declare what they need in the `R` type. Modules never import `@app/*`. `routes.ts` stays the HTTP
boundary: it takes the runtime and calls `runEffect`. Reference exemplar: `modules/health`.

## Services and Layers

```ts
export class Db extends Context.Service<Db, DbShape>()("kyomi/Db") {
  static readonly layer = Layer.effect(
    Db,
    Effect.gen(function* () {
      const config = yield* AppConfig; // a service is yieldable
      const pool = yield* Effect.acquireRelease(acquire, release); // scoped by Layer.effect
      return Db.of(makeDb(pool));
    }),
  );
}
```

- One class per service, key `"kyomi/<Name>"`, shape is a plain object type. Put `static layer`
  next to the class. `Service.of(shape)` builds the value.
- Wrap each Promise API in the service with `use(operation, run)` that maps throws to a typed
  error (`DatabaseError`, `RedisError`). Never expose raw clients to Effect code that can avoid it.
- Resources are acquired with `Effect.acquireRelease` inside `Layer.effect`; release runs when the
  runtime is disposed. Release never fails: catch and log.
- No module-level singletons in converted code: take env from `AppConfig`, the logger from
  `AppLogger`, the pool from `Db`, the client from `Redis`, outbound HTTP from `HttpClient`.
- Add new services to `AppLive` in `app/runtime.ts`. `AppLive` is built once per process; the same
  Layer reference is memoized, so `AppConfig.layer` is built once.
- There is one Postgres pool and one Redis connection per process, both owned by `AppLive`. The
  module-level `db`, `getRedis()`, `logger` and `env` singletons no longer exist; Promise-based
  helpers that need a database take the Drizzle `Database` as an argument and are called through
  `Db.use`. Operator scripts (`boot/*.ts`) run as `runMain(program.pipe(Effect.provide(AppLive)))`.

## Writing operations as Effects

```ts
export const checkReadiness: Effect.Effect<ReadinessPayload, never, Db | AppLogger> = Effect.gen(
  function* () {
    const db = yield* Db;
    const log = yield* AppLogger;
    return yield* db
      .use("select 1", (client) => client.execute(sql`select 1`))
      .pipe(
        Effect.as(true),
        Effect.catchTag("DatabaseError", (e) =>
          log
            .warn("health.ready.failed", { error: serializeError(e.cause) })
            .pipe(Effect.as(false)),
        ),
      );
  },
);
```

- Parameterised operations use `Effect.fn("module.operation")(function* (arg) { ... })` (adds a
  span and a stack frame). Constants use `Effect.gen`.
- Expected failures are values in the error channel (`yield* new NotFound({...})` or
  `Effect.fail`). Defects (`Effect.die`, thrown bugs) are for invariants only.
- Recover with `Effect.catchTag` / `catchIf` / `Effect.catch`; never classify by message text.
- Log with `AppLogger` using the existing event names: `yield* log.warn("feed.refresh.failed", ctx)`.
  `requestId` is added automatically inside `runEffect`. Pass `serializeError(e)` for errors.
- Wrapping legacy Promise code: `Db.use` / `Redis.use` map a throw to `DatabaseError` /
  `RedisError`. For other Promise code use `Effect.tryPromise({ try, catch })` and map the cause
  to a catalogue error in `catch`. A Drizzle transaction callback that runs an Effect through
  `Effect.runPromise` rejects with that Effect's typed error; `inTransaction`
  (`modules/feeds/subscription/persistence.ts`) hands such a catalogue error back as itself
  instead of wrapping it in `DatabaseError`, so it keeps its status and code.
- Time comes from `Clock.currentTimeMillis`, not `Date.now()`; sleeps from `Effect.sleep`.
- Background work: `Effect.forkScoped` (tied to a Scope) or `Effect.forkChild`; never a bare
  un-awaited Promise. Loops that must stop on shutdown use `Effect.repeat(Schedule.spaced(...))`
  inside a Layer so interruption on dispose ends them.

## Errors

One catalogue in `shared/effect/errors.ts`, built on `Data.TaggedError`. Public classes:
`BadRequest 400`, `Unauthorized 401`, `Forbidden 403`, `NotFound 404`, `Conflict 409`,
`PayloadTooLarge 413`, `Unprocessable 422`, `RateLimited 429`, `InternalError 500`,
`BadGateway 502`, `Unavailable 503`, `GatewayTimeout 504`. Fields: `message`, optional `code`
(defaults per class in `ERROR_CATALOGUE`), `details`, `cause`. Keep the existing wire codes:

```ts
new NotFound({ message: "Feed not found", code: "FEED_NOT_FOUND" });
```

Infrastructure errors (`DatabaseError`, `RedisError`, `UpstreamError`, `ConfigError`) carry
`operation` and `cause`, render as an opaque `Internal error` / 502, and are logged with their cause.
`ERROR_CATALOGUE` is `satisfies Record<ApiError["_tag"], ...>`, so a new tag must add its status.

`describeError(unknown)` and `describeCause(cause)` in `shared/http/error/render.ts` are the only
places that choose a status and body. They accept catalogue errors, framework 4xx errors and
defects. The wire envelope is unchanged: `{ error: { message, code, requestId, details } }`.
An interrupted request renders 499 (client aborted) or 503 (server stopping).

## HTTP bridge

Public route: `({ runEffect }) => runEffect(effect)`. The plugin derives `runEffect` with the
runtime's services fixed, so an Effect that needs a service the runtime lacks does not type-check.

Authenticated route (after `resolveSessionContext`):

```ts
runEffect({ runtime, request, requestId, userId }, effect); // effect may require CurrentUser
```

`runEffect` provides `RequestContext` (and `CurrentUser` when `userId` is set) with
`Effect.provideService`. It passes `request.signal` so a client abort interrupts the fiber for
`GET`, `HEAD` and `OPTIONS` only: a mutating request runs to completion after the client leaves,
because most mutations are multi-step (claim a row, then publish a job) and an abort between the
steps would strand the claim. Code that can also be interrupted by a worker shutdown or a lost
job lease (`enqueueFeedRefresh`, `prefetchArticleExtractionsForFeedItems`) wraps its
claim-then-publish section in `Effect.uninterruptible`. On failure `runEffect` throws `EffectFailure`, which `registerErrorHandlers` renders through `describeError` and logs as
`request.failed`. Do not render errors in handlers. Routes take the runtime as an argument:

```ts
export function healthPlugin(
  runtime: ManagedRuntime.ManagedRuntime<Db | AppLogger | Redis | AppConfig, unknown>,
) {
  return new Elysia({ name: "kyomi.health" })
    .use(requestObservationPlugin(runtime))
    .use(effectPlugin(runtime))
    .get("/ready", ({ runEffect }) => runEffect(checkReadiness));
}
```

`registerErrorHandlers(app, runtime)` reads `AppLogger` and `AppConfig` from the runtime, and
`requestObservationPlugin(runtime)` (`shared/http/stacks.ts`, one instance per runtime) reads
`AppConfig`, so a route runtime type includes `AppConfig` when its plugin uses it.

## Runtime lifecycle

One mechanism owns shutdown: Layer scopes. Every process entrypoint is `runMain(program)` where the
program builds `AppLive` (`Effect.provide(AppLive)` or `Layer.launch`). SIGINT/SIGTERM interrupt the
main fiber, the scope closes, and finalizers run in reverse order of acquisition. Nothing else
calls `app.stop()`, `pool.end()` or `closeRedis()`.

| Process             | Program                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `boot/server.ts`    | build `AppLive` (invalid env fails here), `acquireRelease` the Elysia listener, wait forever.   |
| `boot/worker.ts`    | `Layer.launch(WorkerLive)`: one consumer fiber per stream.                                      |
| `boot/scheduler.ts` | `Effect.all([feedRefreshSchedulerLoop, importDispatcherLoop])`: one dying interrupts the other. |
| `boot/dev.ts`       | server + `WorkerLive` + feed scheduler in one scope.                                            |

Elysia does not await `onStop`; the entrypoint's scope owns the order. Behavioural tests:
`tests/api/integration/app/setup/main.test.ts` (a spawned entrypoint: SIGTERM/SIGINT release the scope in
reverse order and exit 0, a failure exits non-zero) and `setup/lifecycle.test.ts` (`Db` and `Redis`
finalizers, `runtimeFromScope` ordering, `registerLifecycle` with and without `ownsRuntime`). Operator scripts
(`boot/import.ts`, `backfill.ts`, `train.ts`, `report.ts`, `audit.ts`, `sanitizer.ts`, `smoke.ts`,
`document.ts`) use the same shape, so the pool and Redis close when the run ends or on a signal.

## Jobs

- **Publish** through `JobQueue.publish(job)` (`RedisError` on failure).
- **Consume** with `startConsumers([...])` inside a scope. Per stream: abandoned entries are claimed,
  new ones read on a dedicated blocking connection, the batch runs with bounded concurrency. Redis
  failures are logged and retried with `Schedule` backoff (500ms doubling to 30s) and never stop the
  other streams; a missing consumer group is recreated. On scope close consumers stop reading, get
  8s to finish running jobs, then are interrupted (entries stay pending and are claimed later).
- **Handlers** return `Effect<void, JobFailure>`. Wrap legacy Promise operations with
  `attemptJob(run, onAbandoned)` (maps a throw with `toJobFailure`). `classifyJobFailure` classifies by error class:
  the class picks the log severity and whether the job is retried (4xx other than 408, 409 and 429
  is permanent: `expected`, logged at warn, and dead-lettered on its first failure). Any other failed
  job is retried (3 attempts) and then dead-lettered. Either way the error is in `error` and
  `last_error`, so an operator can list and replay it. Only a handler that returns normally (a
  permanent feed refresh failure the refresh service already recorded on the feed row) is
  acknowledged without a retry.
- **Interruption.** Feed ingestion is a Promise API without an abort signal, so `attemptJob`
  (`app/jobs/handler.ts`) keeps an interrupted job's fiber alive, uninterruptibly and for at most
  30s, until its Promise settles. The consumer scope therefore closes Postgres and Redis only
  after the work has stopped, and the refresh's final status write is not lost. `Db.use` passes an
  `AbortSignal` to its callback for loops that can stop between statements (the sanitizer backfill).
- **Loops** (`scheduler`, `dispatcher`) run each tick uninterruptibly (a claim is always published or
  released) and wait between ticks with `Effect.repeat(Schedule.spaced(...))`, which interruption ends.
  A failed tick is logged with its cause chain and the next one runs.

## Testing

No `mock.module` and no `globalThis.fetch` patching in converted tests. Provide Layers
(`tests/api/integration/support/layers.ts`):

| Helper                                            | Gives                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testConfig(overrides)`                           | `AppConfig` from fixed values (validated), not `process.env`.                                                                                     |
| `recordingLogger()`                               | `{ entries, layer }`: an `AppLogger` that records `{level, event, context}`.                                                                      |
| `fakeDb({ execute })`                             | `Db` over a Drizzle fake; unlisted methods throw.                                                                                                 |
| `realDb(overrides)`                               | The production `Db.layer` against `DATABASE_URL`.                                                                                                 |
| `fakeRedis({ xlen, xpending })`                   | `Redis` over a fake client; unlisted commands throw.                                                                                              |
| `fakeQueue({ xadd, ... })`                        | `Redis` plus the real `JobQueue` over the same fake client.                                                                                       |
| `replyError("NOGROUP ...")`                       | An error shaped like an ioredis `ReplyError`.                                                                                                     |
| `fakeHttpClient(respond)`                         | `HttpClient` answering from a function; no network.                                                                                               |
| `scriptedHttpClient(respond)` (`support/http.ts`) | `HttpClient` that returns a `Response`, fails with a transport error when given an `Error`, or never answers; sees method, url, headers and body. |
| `silentLogger`                                    | An `AppLogger` that discards entries.                                                                                                             |
| `TestClock.layer()` (from `effect/testing`)       | Deterministic time; `TestClock.setTime`, `TestClock.adjust`.                                                                                      |

```ts
await Effect.runPromise(
  checkReadiness.pipe(Effect.provide(Layer.mergeAll(fakeDb({ execute }), recordingLogger().layer))),
);
```

For routes, build `ManagedRuntime.make(Layer.mergeAll(...))`, call the plugin factory, call
`registerTestErrorHandlers(plugin)` (from `support/elysia.ts`; it runs `registerErrorHandlers` over a
silent logger and the test config), then `plugin.handle(new Request(...))`; dispose the runtime in
`afterEach`. Fetch patching remains only for tests of Promise packages that call the global `fetch` themselves
(`@kyomi/ingest` feed refresh and the embeddings client, Better Auth OAuth); Effect code
reaches those packages through the `FaviconResolver` and `Embeddings` seams, which tests replace
with Layers. `tests/package.json` depends on `effect` for this. Run focused tests:

```sh
cd apps/api
SKIP_ENV_VALIDATION=true bunx --no-install dotenvx run -f ../../docker/.env.example -f .env.example -- \
  bun test ../../tests/api/integration/modules/health
```

## What stays Promise

`@kyomi/db`, `@kyomi/ingest`, `@kyomi/reader`, drizzle queries, better-auth, ioredis, `pg`,
Elysia handlers and plugins. Wrap them once (`Db.use`, `Redis.use`, `Effect.tryPromise`) and keep
the Promise API out of Effect signatures.

## v4 cheat-sheet (verified against effect@4.1.4)

| Need           | v4 name                                                                                                                                                   | Not (v3)                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Service        | `class X extends Context.Service<X, Shape>()("key")`                                                                                                      | `Context.Tag`, `Effect.Service`                      |
| Read a service | `yield* X`, `Effect.service(X)`, `Effect.serviceOption(X)`                                                                                                |                                                      |
| Provide        | `Effect.provide(layer)`, `Effect.provideService(X, shape)`                                                                                                |                                                      |
| Layers         | `Layer.effect`, `.succeed`, `.sync`, `.unwrap`, `.mergeAll`, `.merge`, `.provide`, `.provideMerge`                                                        | `Layer.scoped` (scope is implicit in `Layer.effect`) |
| Runtime        | `ManagedRuntime.make(layer)`; `.runPromise(e, { signal })`, `.runPromiseExit`, `.context()`, `.dispose()`                                                 |                                                      |
| Errors         | `Data.TaggedError("Tag")<{...}>`; `Schema.TaggedError<Self>()("Tag", fields)`                                                                             |                                                      |
| Recover        | `Effect.catch`, `catchTag`, `catchTags`, `catchIf`, `catchCause`, `mapError`, `orDie`                                                                     | `catchAll`                                           |
| To value       | `Effect.result` (a `Result`), `Effect.exit`, `Effect.flip`                                                                                                | `Effect.either`                                      |
| Promise        | `Effect.tryPromise({ try, catch })`, `Effect.promise`                                                                                                     |                                                      |
| Resources      | `Effect.acquireRelease`, `acquireUseRelease`, `addFinalizer`, `ensuring`, `Scope.make`, `Scope.close`                                                     |                                                      |
| Fibers         | `Effect.forkChild`, `forkScoped`, `forkIn`, `forkDetach`                                                                                                  | `Effect.fork`, `forkDaemon`                          |
| Functions      | `Effect.fn("name")(function* (...) {})`, `Effect.fnUntraced`, `Effect.gen`                                                                                |                                                      |
| Cause          | `Cause.findError(c)` / `findDefect(c)` return a `Result` (use `Result.isSuccess(r) && r.success`), `Cause.hasInterrupts`, `Cause.pretty`, `cause.reasons` | `Cause.failureOption`                                |
| Exit           | `Exit.isSuccess(e)` then `e.value`; `Exit.isFailure(e)` then `e.cause`                                                                                    |                                                      |
| Time           | `Clock.currentTimeMillis`, `Effect.sleep`, `Effect.timeout` (fails `Cause.TimeoutError`)                                                                  |                                                      |
| Retry          | `Effect.retry({ schedule, while })`, `Effect.repeat`; `Schedule.exponential`, `spaced`, `fixed`, `recurs`, `jittered`, `during`, `cron`                   |                                                      |
| Concurrency    | `Effect.forEach(xs, f, { concurrency })`, `Effect.all({ a, b }, { concurrency })`                                                                         |                                                      |
| Queues         | `Queue.bounded/unbounded/sliding/dropping`, `Queue.offer/take/takeAll/end`; `PubSub.bounded/publish/subscribe` (subscribe is scoped)                      |                                                      |
| Streams        | `Stream.fromQueue`, `fromPubSub`, `fromAsyncIterable`, `mapEffect`, `runForEach`, `runCollect`                                                            |                                                      |
| Logging        | `Logger.make`, `Logger.layer([...])`, `References.MinimumLogLevel`                                                                                        |                                                      |
| HTTP client    | `HttpClient.HttpClient`, `FetchHttpClient.layer`, `HttpClient.make`, `HttpClientResponse.fromWeb` (imports from `effect/http`)                            |                                                      |
| Test time      | `TestClock.layer()`, `TestClock.adjust`, `TestClock.setTime` (from `effect/testing`)                                                                      |                                                      |

## Pitfalls

- **Effects are lazy.** `redis.use(...)`, `log.warn(...)` and `Effect.sync(...)` do nothing until
  yielded or run. A discarded Effect is a bug; the typecheck does not catch it (the oxlint config
  has no floating-effect rule). Review for statement-position calls that are not `yield*`.
- `Effect.runSync`/`runPromise` inside an Effect or service loses the runtime's services and
  interruption. Use them only at process edges (an event callback like `pool.on("error")`).
- Do not `await` an Effect; it is not a Promise. Cross into Promise land only through `runEffect`
  or `runtime.runPromise*`.
- `Effect.gen` bodies must `yield*` a failing Effect or `return yield* new MyError(...)` to stop.
- `Data.TaggedError` with a `message` field uses it as the error message; without one the message is
  empty. Infra errors in the catalogue define a `message` getter for this reason.
- `ManagedRuntime` layer failures surface as the runtime's `ER` (rejects `context()`), not the
  effect's `E`; test them with `runPromiseExit`.
- Elysia does not await `onStop`. Put ordered shutdown in the entrypoint.
- A scoped resource created outside a Layer is not released by `runtime.dispose()`.
- Elysia `derive` is local to the plugin unless `{ as: "scoped" }`; `requestIdMiddleware` does not
  reach routes registered in a parent plugin, so `effectPlugin` derives its own request id.

## Lint and typecheck notes

`bun run --cwd apps/api typecheck` (tsgo) type-checks Effect `R` and `E`; a missing service is a
compile error at `runEffect`. oxlint has no Effect rules. `tests` typecheck
(`bun run --cwd tests typecheck`) already fails on unrelated files; filter to the files you touch.
