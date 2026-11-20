import { createFileRoute } from "@tanstack/react-router";
import { proxyReaderImage } from "@lib/favicon";

export const Route = createFileRoute("/api/reader-image")({
  server: {
    handlers: {
      GET: ({ request }) => proxyReaderImage(request),
    },
  },
});
