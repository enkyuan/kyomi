import { logger } from "@adapters/logger";
import { createApp } from "../http/app";
import { createAppRuntime } from "../runtime";
import { buildListenOptions } from "../http/listen";
import { env } from "@config/env";
import { shutdownAdapters } from "@adapters/shutdown";
import { serializeError } from "@shared/errors/serialize";

const runtime = createAppRuntime();
// Build every Layer now so invalid configuration fails at boot, not on the first request.
await runtime.context();

const app = createApp({ runtime });

app.listen(
  buildListenOptions({ port: env.PORT, maxRequestBodySize: env.API_MAX_REQUEST_BODY_BYTES }),
);

logger.info("server.listening", {
  host: app.server?.hostname ?? "unknown",
  port: app.server?.port ?? env.PORT,
});

// Elysia does not await `onStop` hooks, so the entrypoint owns the ordered shutdown: stop accepting
// requests, release legacy singletons, then dispose the runtime (pool and Redis scopes close).
async function shutdown(signalName: string) {
  logger.info("server.shutdown.requested", { signal: signalName });
  try {
    await app.stop();
    await shutdownAdapters();
    await runtime.dispose();
    logger.info("server.shutdown.complete", { signal: signalName });
  } catch (error) {
    logger.error("server.shutdown.failed", { error: serializeError(error) });
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

for (const signalName of ["SIGINT", "SIGTERM"] as const) {
  process.once(signalName, () => void shutdown(signalName));
}
