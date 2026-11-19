import { Effect } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { AppConfig } from "@config/env/service";
import { createApp } from "../http/app";
import { buildListenOptions } from "../http/listen";
import { AppLive, runtimeFromScope } from "../runtime";
import { runMain } from "../setup/main";

// The Layer scope owns every resource: building `AppLive` validates the environment and opens
// Postgres and Redis (a failure here stops the boot), and on SIGINT/SIGTERM the server stops
// accepting requests first, then the scope closes the pool and Redis in reverse order.
const server = Effect.gen(function* () {
  const config = yield* AppConfig;
  const log = yield* AppLogger;
  const runtime = yield* runtimeFromScope;
  const app = createApp({ runtime });

  yield* Effect.acquireRelease(
    Effect.sync(() =>
      app.listen(
        buildListenOptions({
          port: config.PORT,
          maxRequestBodySize: config.API_MAX_REQUEST_BODY_BYTES,
        }),
      ),
    ),
    () => Effect.promise(() => app.stop()),
  );

  yield* log.info("server.listening", {
    host: app.server?.hostname ?? "unknown",
    port: app.server?.port ?? config.PORT,
  });
  return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide(AppLive));

runMain(server);
