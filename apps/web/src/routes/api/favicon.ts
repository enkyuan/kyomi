import { createFileRoute } from "@tanstack/react-router";
import { forwardRequestToApi } from "@lib/api";

export const Route = createFileRoute("/api/favicon")({
  server: {
    handlers: {
      GET: ({ request }) => forwardRequestToApi(request),
    },
  },
});
