# API on Effect

`apps/api` is moving from Promise and singleton wiring to [Effect](https://effect.website) v4
(`effect@4.1.4`). Elysia stays the HTTP adapter. `@kyomi/db`, `@kyomi/ingest`, `@kyomi/reader`,
drizzle-orm 0.45 and better-auth stay Promise-based and are wrapped at the API boundary.

**Most Effect examples online and in model memory are v3 and do not compile.** Learn an API from the
installed declarations (`apps/api/node_modules/effect/dist/*.d.ts`) and the v4 docs, never from
memory. The names below were checked against 4.1.4.

## Where things live

| Path | Holds |
| --- | --- |
| `src/shared/effect/errors.ts` | The typed error catalogue and `AppError` interop. |
| `src/shared/effect/request.ts` | `RequestContext` and `CurrentUser` services (per request). |
| `src/shared/http/error/render.ts` | `describeError` / `describeCause`: the one edge mapper. `EffectFailure`. |
| `src/shared/http/effect/bridge.ts` | `runEffect(ctx, effect)`: the typed Elysia to Effect bridge. |
| `src/shared/http/effect/plugin.ts` | `effectPlugin(runtime)`: puts `runtime` and `runEffect` on the Elysia context. |
| `src/config/env/service.ts` | `AppConfig` (validated env as a service). |
| `src/adapters/<capability>/service.ts` | `Db`, `Redis`, `AppLogger` services and their live Layers. |
| `src/adapters/http/client.ts` | `HttpClientLive` (the `HttpClient` service from `effect/http`). |
| `src/app/runtime.ts` | `AppLive` and `createAppRuntime()`: the one composition root. |
| `tests/api/integration/support/layers.ts` | Test Layers (fake db/redis/http, recording logger, config). |

A module's Effects sit in its existing role files (`operations.ts`, `queries.ts`, `checks.ts`) and
declare what they need in the `R` type. Modules never import `@app/*`. `routes.ts` stays the HTTP
boundary: it takes the runtime and calls `runEffect`. Reference exemplar: `modules/health`.

## Services and Layers

```ts
export class Db extends Context.Service<Db, DbShape>()("kyomi/Db") {
  static readonly layer = Layer.effect(Db, Effect.gen(function* () {
    const config = yield* AppConfig            // a service is yieldable
    const pool = yield* Effect.acquireRelease(acquire, release)  // scoped by Layer.effect
    return Db.of(makeDb(pool))
  }))
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
- During migration, unconverted modules still use `@adapters/db/client` and `@adapters/redis`
  singletons, so the process holds two Postgres pools and two Redis connections until the last
  module moves. Delete `adapters/db/client.ts`, `adapters/redis/client.ts`, `adapters/shutdown.ts`
  and the module-level `env` export with the final module.

## Writing operations as Effects

```ts
export const checkReadiness: Effect.Effect<ReadinessPayload, never, Db | AppLogger> = Effect.gen(
  function* () {
    const db = yield* Db
    const log = yield* AppLogger
    return yield* db.use("select 1", (client) => client.execute(sql`select 1`)).pipe(
      Effect.as(true),
      Effect.catchTag("DatabaseError", (e) =>
        log.warn("health.ready.failed", { error: serializeError(e.cause) }).pipe(Effect.as(false))),
    )
  })
```

- Parameterised operations use `Effect.fn("module.operation")(function* (arg) { ... })` (adds a
  span and a stack frame). Constants use `Effect.gen`.
- Expected failures are values in the error channel (`yield* new NotFound({...})` or
  `Effect.fail`). Defects (`Effect.die`, thrown bugs) are for invariants only.
- Recover with `Effect.catchTag` / `catchIf` / `Effect.catch`; never classify by message text.
- Log with `AppLogger` using the existing event names: `yield* log.warn("feed.refresh.failed", ctx)`.
  `requestId` is added automatically inside `runEffect`. Pass `serializeError(e)` for errors.
- Wrapping legacy Promise code that may throw `AppError`: 

  ```ts
  Effect.tryPromise({ try: () => legacyFn(), catch: toPublicError })
  ```

  `toPublicError` re-tags `AppError` by status (keeping code, message, details), passes typed
  errors through, and turns anything else into an opaque `InternalError`.
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
new NotFound({ message: "Feed not found", code: "FEED_NOT_FOUND" })   // replaces new AppError(..., {status: 404, code})
```

Infrastructure errors (`DatabaseError`, `RedisError`, `UpstreamError`, `ConfigError`) carry
`operation` and `cause`, render as an opaque `Internal error` / 502, and are logged with their cause.
`ERROR_CATALOGUE` is `satisfies Record<ApiError["_tag"], ...>`, so a new tag must add its status.

`describeError(unknown)` and `describeCause(cause)` in `shared/http/error/render.ts` are the only
places that choose a status and body. They accept catalogue errors, legacy `AppError`, framework 4xx
errors and defects. The wire envelope is unchanged: `{ error: { message, code, requestId, details } }`.
An interrupted request renders 499 (client aborted) or 503 (server stopping).

`AppError` keeps working: thrown inside Effect code it becomes a defect and still renders with its
own status and code, and `fromAppError` / `toPublicError` convert it to a typed error when you want
to `catchTag` it.

## HTTP bridge

Public route: `({ runEffect }) => runEffect(effect)`. The plugin derives `runEffect` with the
runtime's services fixed, so an Effect that needs a service the runtime lacks does not type-check.

Authenticated route (after `resolveSessionContext`):

```ts
runEffect({ runtime, request, requestId, userId }, effect)   // effect may require CurrentUser
```

`runEffect` provides `RequestContext` (and `CurrentUser` when `userId` is set) with
`Effect.provideService`, passes `request.signal` so an abort interrupts the fiber, and on failure
throws `EffectFailure`, which `registerErrorHandlers` renders through `describeError` and logs as
`request.failed`. Do not render errors in handlers. Routes take the runtime as an argument:

```ts
export function healthPlugin(runtime: ManagedRuntime.ManagedRuntime<Db | AppLogger | Redis, unknown>) {
  return new Elysia({ name: "kyomi.health" }).use(effectPlugin(runtime)).get("/ready", ({ runEffect }) => runEffect(checkReadiness))
}
```

## Runtime lifecycle

`createAppRuntime()` is `ManagedRuntime.make(AppLive)`. `boot/server.ts` calls
`await runtime.context()` before listening (invalid env, `ConfigError`, fails at boot) and on
SIGINT/SIGTERM runs `app.stop()`, `shutdownAdapters()` (legacy), then `runtime.dispose()`, which
closes the Postgres pool and Redis in reverse acquire order. Elysia does not await `onStop`
hooks, so shutdown lives in the entrypoint. `createApp({ runtime })` leaves disposal to the caller;
without it, `createApp` owns and disposes its runtime on stop.

## Testing

No `mock.module` and no `globalThis.fetch` patching in converted tests. Provide Layers
(`tests/api/integration/support/layers.ts`):

| Helper | Gives |
| --- | --- |
| `testConfig(overrides)` | `AppConfig` from fixed values (validated), not `process.env`. |
| `recordingLogger()` | `{ entries, layer }`: an `AppLogger` that records `{level, event, context}`. |
| `fakeDb({ execute })` | `Db` over a Drizzle fake; unlisted methods throw. |
| `realDb(overrides)` | The production `Db.layer` against `DATABASE_URL`. |
| `fakeRedis({ xlen, xpending })` | `Redis` over a fake client; unlisted commands throw. |
| `replyError("NOGROUP ...")` | An error shaped like an ioredis `ReplyError`. |
| `fakeHttpClient(respond)` | `HttpClient` answering from a function; no network. |
| `TestClock.layer()` (from `effect/testing`) | Deterministic time; `TestClock.setTime`, `TestClock.adjust`. |

```ts
await Effect.runPromise(checkReadiness.pipe(Effect.provide(Layer.mergeAll(fakeDb({ execute }), recordingLogger().layer))))
```

For routes, build `ManagedRuntime.make(Layer.mergeAll(...))`, call the plugin factory, call
`registerErrorHandlers(plugin)`, then `plugin.handle(new Request(...))`; dispose the runtime in
`afterEach`. `tests/package.json` depends on `effect` for this. Run focused tests:

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

| Need | v4 name | Not (v3) |
| --- | --- | --- |
| Service | `class X extends Context.Service<X, Shape>()("key")` | `Context.Tag`, `Effect.Service` |
| Read a service | `yield* X`, `Effect.service(X)`, `Effect.serviceOption(X)` | |
| Provide | `Effect.provide(layer)`, `Effect.provideService(X, shape)` | |
| Layers | `Layer.effect`, `.succeed`, `.sync`, `.unwrap`, `.mergeAll`, `.merge`, `.provide`, `.provideMerge` | `Layer.scoped` (scope is implicit in `Layer.effect`) |
| Runtime | `ManagedRuntime.make(layer)`; `.runPromise(e, { signal })`, `.runPromiseExit`, `.context()`, `.dispose()` | |
| Errors | `Data.TaggedError("Tag")<{...}>`; `Schema.TaggedError<Self>()("Tag", fields)` | |
| Recover | `Effect.catch`, `catchTag`, `catchTags`, `catchIf`, `catchCause`, `mapError`, `orDie` | `catchAll` |
| To value | `Effect.result` (a `Result`), `Effect.exit`, `Effect.flip` | `Effect.either` |
| Promise | `Effect.tryPromise({ try, catch })`, `Effect.promise` | |
| Resources | `Effect.acquireRelease`, `acquireUseRelease`, `addFinalizer`, `ensuring`, `Scope.make`, `Scope.close` | |
| Fibers | `Effect.forkChild`, `forkScoped`, `forkIn`, `forkDetach` | `Effect.fork`, `forkDaemon` |
| Functions | `Effect.fn("name")(function* (...) {})`, `Effect.fnUntraced`, `Effect.gen` | |
| Cause | `Cause.findError(c)` / `findDefect(c)` return a `Result` (use `Result.isSuccess(r) && r.success`), `Cause.hasInterrupts`, `Cause.pretty`, `cause.reasons` | `Cause.failureOption` |
| Exit | `Exit.isSuccess(e)` then `e.value`; `Exit.isFailure(e)` then `e.cause` | |
| Time | `Clock.currentTimeMillis`, `Effect.sleep`, `Effect.timeout` (fails `Cause.TimeoutError`) | |
| Retry | `Effect.retry({ schedule, while })`, `Effect.repeat`; `Schedule.exponential`, `spaced`, `fixed`, `recurs`, `jittered`, `during`, `cron` | |
| Concurrency | `Effect.forEach(xs, f, { concurrency })`, `Effect.all({ a, b }, { concurrency })` | |
| Queues | `Queue.bounded/unbounded/sliding/dropping`, `Queue.offer/take/takeAll/end`; `PubSub.bounded/publish/subscribe` (subscribe is scoped) | |
| Streams | `Stream.fromQueue`, `fromPubSub`, `fromAsyncIterable`, `mapEffect`, `runForEach`, `runCollect` | |
| Logging | `Logger.make`, `Logger.layer([...])`, `References.MinimumLogLevel` | |
| HTTP client | `HttpClient.HttpClient`, `FetchHttpClient.layer`, `HttpClient.make`, `HttpClientResponse.fromWeb` (imports from `effect/http`) | |
| Test time | `TestClock.layer()`, `TestClock.adjust`, `TestClock.setTime` (from `effect/testing`) | |

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
