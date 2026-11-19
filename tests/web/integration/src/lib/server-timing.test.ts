// @vitest-environment node
import { describe, expect, test } from "vitest";
import { withServerTiming } from "@lib/server-timing";

const request = new Request("https://kyomi.test/inbox");

describe("withServerTiming", () => {
  test("adds an ssr duration to an HTML response and keeps its status, headers and body", async () => {
    const fetch = withServerTiming(
      async () =>
        new Response("<html></html>", {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8", "x-keep": "yes" },
        }),
    );

    const response = await fetch(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("x-keep")).toBe("yes");
    expect(response.headers.get("server-timing")).toMatch(/^ssr;dur=\d+(\.\d+)?$/);
    await expect(response.text()).resolves.toBe("<html></html>");
  });

  test("keeps a Server-Timing entry the handler already set", async () => {
    const fetch = withServerTiming(
      async () =>
        new Response("<html></html>", {
          headers: { "content-type": "text/html", "server-timing": "db;dur=3" },
        }),
    );

    const header = (await fetch(request)).headers.get("server-timing");

    expect(header).toMatch(/^db;dur=3, ssr;dur=/);
  });

  test("passes a non-HTML response through untouched", async () => {
    const original = Response.json({ ok: true });
    const fetch = withServerTiming(async () => original);

    const response = await fetch(request);

    expect(response).toBe(original);
    expect(response.headers.has("server-timing")).toBe(false);
  });

  test("forwards the request and the runtime arguments to the handler", async () => {
    const seen: unknown[][] = [];
    const fetch = withServerTiming(async (incoming: Request, context: string) => {
      seen.push([incoming, context]);
      return new Response("", { headers: { "content-type": "text/html" } });
    });

    await fetch(request, "ctx");

    expect(seen).toEqual([[request, "ctx"]]);
  });
});
