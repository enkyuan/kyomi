import { logger } from "@adapters/logger";
import { createApp } from "../http/create-app";
import { buildListenOptions } from "../http/listen";
import { env } from "@config/env";

const app = createApp();

app.listen(
  buildListenOptions({ port: env.PORT, maxRequestBodySize: env.API_MAX_REQUEST_BODY_BYTES }),
);

logger.info("server.listening", {
  host: app.server?.hostname ?? "unknown",
  port: app.server?.port ?? env.PORT,
});
