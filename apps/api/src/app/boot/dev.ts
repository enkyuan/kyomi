import { Effect, Layer } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { AppConfig } from "@config/env/service";
import { createApp } from "../http/app";
import { listenWithRetry } from "../http/listen";
import { WorkerLive } from "../jobs/consumer";
import { feedRefreshSchedulerLoop } from "../jobs/scheduler";
import { AppLive, runtimeFromScope } from "../runtime";
import { runMain } from "../setup/main";

// One process for local development: the HTTP server, the job worker and the feed scheduler share
// one set of services. Stopping it releases them in reverse order of how they started.
const dev = Effect.gen(function* () {
  const config = yield* AppConfig;
  const log = yield* AppLogger;
  const runtime = yield* runtimeFromScope;
  const app = createApp({ runtime });

  yield* Effect.acquireRelease(
    listenWithRetry(app, {
      port: config.PORT,
      maxRequestBodySize: config.API_MAX_REQUEST_BODY_BYTES,
      retries: 20,
      retryDelayMs: 250,
    }),
    () => Effect.promise(() => app.stop()),
  );
  yield* log.info("server.listening", {
    host: app.server?.hostname ?? "unknown",
    port: app.server?.port ?? config.PORT,
  });

  yield* Effect.forkScoped(feedRefreshSchedulerLoop);
  yield* Layer.build(WorkerLive);
  return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide(AppLive));

runMain(dev);
