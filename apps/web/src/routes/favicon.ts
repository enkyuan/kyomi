import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/favicon")({
  server: {
    handlers: {
      GET: ({ request }) =>
        Response.redirect(new URL("/favicon/favicon-32x32.png", request.url), 308),
    },
  },
});
