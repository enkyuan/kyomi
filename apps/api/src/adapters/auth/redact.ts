const GET_SESSION_PATH = "/api/auth/get-session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether this request is for the current session record (`/api/auth/get-session`). Better Auth
 * ignores trailing slashes, so they are ignored here too. This runs on unauthenticated requests, so
 * it trims them with a loop rather than a regular expression that backtracks on a long run of them.
 */
export function isGetSessionRequest(request: Request) {
  const { pathname } = new URL(request.url);
  let end = pathname.length;
  while (end > 0 && pathname.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return pathname.slice(0, end) === GET_SESSION_PATH;
}

/**
 * A session without its token. The token is a bearer credential: the browser holds it in an
 * HttpOnly cookie so page scripts cannot read it, and a response body that carried it would put it
 * back within reach of any script on the page. Clients identify a session by its `id`.
 */
export function withoutToken<T extends { token?: unknown }>(session: T): Omit<T, "token"> {
  const { token: _token, ...rest } = session;
  return rest;
}

function rebuild(response: Response, body: string) {
  const headers = new Headers(response.headers);
  // The body's length changes with the token gone; the runtime sets it again.
  headers.delete("content-length");
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Removes `session.token` from a successful JSON `get-session` response and leaves everything else
 * (status, headers including refreshed cookies, the rest of the body) as it was.
 */
export async function redactSessionToken(response: Response): Promise<Response> {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return rebuild(response, text);
  }

  if (!isRecord(body) || !isRecord(body.session) || !("token" in body.session)) {
    return rebuild(response, text);
  }
  return rebuild(response, JSON.stringify({ ...body, session: withoutToken(body.session) }));
}
