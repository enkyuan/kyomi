import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { API_PACKAGE_VERSION } from "@config/package-info";

export const openapiPlugin = new Elysia({
  name: "openapi.plugin",
}).use(
  swagger({
    path: "/api/v1/openapi",
    documentation: {
      info: {
        title: "Cronos API",
        version: API_PACKAGE_VERSION,
        description:
          "Product HTTP API is under `/api/v1`. Liveness `/health`, readiness `/ready` (also mirrored under `/api/*` for legacy probes).",
      },
    },
  }),
);
