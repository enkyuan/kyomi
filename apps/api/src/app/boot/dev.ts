import { logger } from "@adapters/logger";
import { env } from "@config/env";
import { createApp } from "../http/create-app";
import { runWorkerLoop } from "../jobs/run-worker";

const controller = new AbortController();

for (const signalName of ["SIGINT", "SIGTERM"] as const) {
  process.on(signalName, () => {
    logger.info("dev.shutdown.requested", { signal: signalName });
    controller.abort();
  });
}

const app = createApp();

app.listen(env.PORT);

logger.info("server.listening", {
  host: app.server?.hostname ?? "unknown",
  port: app.server?.port ?? env.PORT,
});

void runWorkerLoop(controller.signal).catch((error) => {
  logger.error("dev.worker.crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
});
