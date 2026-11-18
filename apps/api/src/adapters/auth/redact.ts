/**
 * The one auth response that carries a session token on purpose: the mobile app exchanges its
 * authorization code here and gets a session of its own. A native client has no page scripts to
 * guard against, and an older build may read the token from the body.
 */
const OAUTH_TOKEN_PATH = "/api/auth/oauth/token";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether this request is for the mobile app's token endpoint, whose response keeps its token.
 * Better Auth ignores trailing slashes, so they are ignored here too. This runs on unauthenticated
 * requests, so it trims them with a loop rather than a regular expression that backtracks on a
 * long run of them. A path that only Better Auth would route here (doubled slashes, say) is not
 * matched, so its token is removed: the exception fails closed.
 */
export function isOAuthTokenRequest(request: Request) {
  const { pathname } = new URL(request.url);
  let end = pathname.length;
  while (end > 0 && pathname.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return pathname.slice(0, end) === OAUTH_TOKEN_PATH;
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
 * Removes the session token from a successful JSON auth response and leaves everything else
 * (status, headers including the session cookie, the rest of the body) as it was. Better Auth
 * puts the token in two places: `session.token` in `get-session`, and a top-level `token` in what
 * sign-in, sign-up and email verification answer with. The cookie has already been set by then, and
 * it is the cookie, not the body, that the clients use.
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

  if (!isRecord(body)) {
    return rebuild(response, text);
  }
  const nested = isRecord(body.session) && "token" in body.session;
  if (!nested && !("token" in body)) {
    return rebuild(response, text);
  }
  const rest = withoutToken(body);
  return rebuild(
    response,
    JSON.stringify(
      nested ? { ...rest, session: withoutToken(body.session as { token?: unknown }) } : rest,
    ),
  );
}
