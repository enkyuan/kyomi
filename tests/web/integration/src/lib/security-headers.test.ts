// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import { withSecurityHeaders } from "@lib/security-headers";
import { withStatusPage } from "@lib/status-page";

const URL_ = "https://kyomi.test/inbox";

function navigation() {
  return new Request(URL_, { headers: { accept: "text/html" } });
}

function html(init: ResponseInit = {}) {
  return new Response("<html></html>", {
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("withSecurityHeaders", () => {
  test("stops the app being framed or its scripts being sniffed", async () => {
    const response = await withSecurityHeaders(async () => html())(navigation());

    const policy = response.headers.get("content-security-policy") ?? "";
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  test("does not add a script policy that would block the server-rendered inline scripts", async () => {
    const response = await withSecurityHeaders(async () => html())(navigation());

    const policy = response.headers.get("content-security-policy") ?? "";
    expect(policy).not.toMatch(/script-src|default-src|style-src/);
  });

  test("turns off the features the app does not use and keeps the ones embeds ask for", async () => {
    const response = await withSecurityHeaders(async () => html())(navigation());

    const policy = response.headers.get("permissions-policy") ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(policy).toContain(`${feature}=()`);
    }
    for (const feature of ["fullscreen", "picture-in-picture", "clipboard-write", "autoplay"]) {
      expect(policy).not.toContain(feature);
    }
  });

  test("sends HSTS in production only", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const production = await withSecurityHeaders(async () => html())(navigation());
    vi.stubEnv("NODE_ENV", "development");
    const development = await withSecurityHeaders(async () => html())(navigation());

    expect(production.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(development.headers.get("strict-transport-security")).toBeNull();
  });

  test("keeps the status, body and every header the response already had", async () => {
    const original = new Response('{"ok":true}', {
      status: 201,
      statusText: "Created",
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
    original.headers.append("set-cookie", "a=1; Path=/");
    original.headers.append("set-cookie", "b=2; Path=/");

    const response = await withSecurityHeaders(async () => original)(navigation());

    expect(response.status).toBe(201);
    expect(response.statusText).toBe("Created");
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
    expect(await response.text()).toBe('{"ok":true}');
  });

  test("keeps a policy a route set itself, such as the favicon proxy's sandbox", async () => {
    const sandbox = "default-src 'none'; sandbox";
    const response = await withSecurityHeaders(
      async () => new Response("x", { headers: { "content-security-policy": sandbox } }),
    )(navigation());

    expect(response.headers.get("content-security-policy")).toBe(sandbox);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  test("secures responses whose headers are immutable, such as a redirect", async () => {
    const redirect = await withSecurityHeaders(async () => Response.redirect(`${URL_}/other`, 302))(
      navigation(),
    );

    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("location")).toBe(`${URL_}/other`);
    expect(redirect.headers.get("x-frame-options")).toBe("DENY");
    expect(redirect.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("passes the request and the runtime's extra arguments to the wrapped entry", async () => {
    const entry = vi.fn(async (_request: Request, _options: { context: string }) => html());
    const request = navigation();

    await withSecurityHeaders(entry)(request, { context: "start" });

    expect(entry).toHaveBeenCalledWith(request, { context: "start" });
  });

  test("covers the error page the status wrapper renders for a failed navigation", async () => {
    const rendered = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ unhandled: true }, { status: 500 }))
      .mockResolvedValueOnce(html({ status: 500 }));

    const response = await withSecurityHeaders(withStatusPage(rendered))(navigation());

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});
