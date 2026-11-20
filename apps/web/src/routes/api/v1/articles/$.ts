import { createFileRoute } from "@tanstack/react-router";
import { forwardRequestToApi } from "@lib/api";

async function forward({ request }: { request: Request }) {
  const match = /^\/api\/v1\/articles\/[\da-f-]{36}(\/progress)?$/i.exec(
    new URL(request.url).pathname,
  );
  if (!match || !request.headers.get("x-kyomi-offline-owner"))
    return new Response(null, { status: 400 });
  if (request.method === "PUT" && request.headers.get("origin") !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }
  const upstream = await forwardRequestToApi(request);
  const response = new Response(upstream.body, upstream);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
export const Route = createFileRoute("/api/v1/articles/$")({
  server: { handlers: { GET: forward, PUT: forward } },
});
