import { createFileRoute } from "@tanstack/react-router";
import { proxyFavicon } from "@lib/favicon";

export const Route = createFileRoute("/api/favicon")({
  server: {
    handlers: {
      GET: ({ request }) => proxyFavicon(request),
    },
  },
});
