import { logger } from "@adapters/logger";
import { runWorkerLoop } from "./run-worker";

const controller = new AbortController();

for (const signalName of ["SIGINT", "SIGTERM"] as const) {
  process.on(signalName, () => {
    logger.info("worker.shutdown.requested", { signal: signalName });
    controller.abort();
  });
}

try {
  await runWorkerLoop(controller.signal);
} catch (error) {
  logger.error("worker.crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
