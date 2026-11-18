// Directives that hold without knowing which scripts a page runs. There is no `script-src` or
// `default-src` on purpose: the server-rendered document carries inline scripts (the router's
// dehydration payload, the pre-hydration shell script) that only a per-response nonce or hash could
// allow, and the analytics client loads its own.
const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

// Features nothing in the app or its embeds uses. Fullscreen, picture-in-picture, clipboard-write
// and encrypted-media stay on: the reader's video embeds ask for them.
const PERMISSIONS_POLICY = [
  "accelerometer",
  "bluetooth",
  "camera",
  "display-capture",
  "geolocation",
  "gyroscope",
  "hid",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "serial",
  "usb",
]
  .map((feature) => `${feature}=()`)
  .join(", ");

const HSTS = "max-age=31536000";

function responseHeaders() {
  const headers: Record<string, string> = {
    "content-security-policy": CONTENT_SECURITY_POLICY,
    "permissions-policy": PERMISSIONS_POLICY,
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
  if (process.env.NODE_ENV === "production") {
    headers["strict-transport-security"] = HSTS;
  }
  return Object.entries(headers);
}

/**
 * Wraps the server entry so every response it returns carries the security headers. A header a
 * route already set (the favicon proxy's own, stricter policy) is kept, not replaced. HSTS is
 * production only, so a local `http://` server is not pinned to HTTPS in the developer's browser.
 */
export function withSecurityHeaders<Args extends unknown[]>(
  fetch: (request: Request, ...args: Args) => Response | Promise<Response>,
) {
  return async (request: Request, ...args: Args) => {
    const response = await fetch(request, ...args);
    const apply = (target: Response) => {
      for (const [name, value] of responseHeaders()) {
        if (!target.headers.has(name)) {
          target.headers.set(name, value);
        }
      }
      return target;
    };

    try {
      return apply(response);
    } catch {
      // A response from `fetch()` or `Response.redirect()` has immutable headers, so copy it.
      return apply(new Response(response.body, response));
    }
  };
}
