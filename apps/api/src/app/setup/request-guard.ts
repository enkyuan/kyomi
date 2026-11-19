import { Elysia } from "elysia";
import { shapeErrorResponse } from "@shared/http/error/shape";
import {
  getRequestIdFromHeaders,
  type MutableResponseHeaders,
} from "@shared/http/request-id/headers";

/**
 * What a request body may weigh before anything reads it. Bun's transport ceiling
 * (`API_MAX_REQUEST_BODY_BYTES`) is sized for the 32 MiB OPML routes, and a body is buffered and
 * parsed before the session is checked, so without this an anonymous caller could make the server
 * hold tens of megabytes per request. The article and content routes have their own, smaller
 * field budgets (`@shared/http/budget`); this is the ceiling in front of them.
 */
export const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024;

/** The only routes that take a document bigger than the default, by design. */
const LARGE_BODY_PATHS: ReadonlySet<string> = new Set([
  "/api/v1/opml/imports",
  "/api/v1/opml/imports/raw",
]);

const BODY_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function refusal(status: 411 | 413, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json", "x-content-type-options": "nosniff" },
  });
}

/**
 * Refuses an oversized or length-less body before it is read, and marks every response
 * `nosniff`: the API serves JSON and a few proxied images, and none of it should be re-typed by a
 * browser. A body with no `Content-Length` (chunked) is refused too, because its size is not known
 * until it has been read; the clients in this repo send a length with every JSON body.
 */
export const requestGuardPlugin = new Elysia({ name: "kyomi.request-guard" }).onRequest(
  ({ request, set }) => {
    set.headers["x-content-type-options"] = "nosniff";
    if (!BODY_METHODS.has(request.method)) {
      return;
    }
    const { pathname } = new URL(request.url);
    if (LARGE_BODY_PATHS.has(pathname)) {
      return;
    }
    const declared = request.headers.get("content-length");
    if (declared === null) {
      return request.headers.has("transfer-encoding")
        ? refusal(411, "LENGTH_REQUIRED", "Content-Length is required")
        : undefined;
    }
    if (!/^\d+$/.test(declared) || Number(declared) > DEFAULT_MAX_BODY_BYTES) {
      return refusal(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
    }
  },
);

/** A request to one of the routes that take a document bigger than the default ceiling. */
export const isLargeBodyRequest = (request: Request) =>
  BODY_METHODS.has(request.method) && LARGE_BODY_PATHS.has(new URL(request.url).pathname);

/**
 * The large-document routes are exempt from the default ceiling, and Elysia reads and parses a
 * body before it derives the session, so an anonymous caller could make the server hold tens of
 * megabytes per request. This answers them first: the session is resolved before the body is
 * read, and a caller without one is refused with the usual 401.
 */
export const largeBodyAuthPlugin = (
  authenticate: (request: Request, set: { headers: MutableResponseHeaders }) => Promise<unknown>,
) =>
  new Elysia({ name: "kyomi.large-body-auth" }).onRequest(async ({ request, set }) => {
    if (!isLargeBodyRequest(request)) {
      return;
    }
    try {
      await authenticate(request, set);
    } catch (error) {
      return shapeErrorResponse(error, getRequestIdFromHeaders(request.headers));
    }
  });
