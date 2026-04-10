import { createFileRoute } from "@tanstack/react-router";
import { forwardRequestToApi } from "@lib/api";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => forwardRequestToApi(request),
      POST: ({ request }) => forwardRequestToApi(request),
    },
  },
});
