import { logger } from "@adapters/logger";
import { createApp } from "../http/create-app";
import { env } from "@config/env";

const app = createApp();

app.listen(env.PORT);

logger.info("server.listening", {
  host: app.server?.hostname ?? "unknown",
  port: app.server?.port ?? env.PORT,
});
