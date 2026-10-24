// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STATUS_ERROR_HEADER } from "@lib/status";
import { withStatusPage } from "@lib/status-page";

const URL_ = "https://kyomi.test/inbox";
const PAGE_HTML = "<html><body>error page</body></html>";

function navigation(init: RequestInit = {}) {
  return new Request(URL_, {
    ...init,
    headers: { accept: "text/html,application/xhtml+xml", ...init.headers },
  });
}

function html(status = 200, headers: HeadersInit = {}) {
  return new Response(PAGE_HTML, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

function json(status: number, headers: HeadersInit = {}) {
  return Response.json({ status, unhandled: true, message: "HTTPError" }, { status, headers });
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("withStatusPage", () => {
  test("passes successful navigations through untouched", async () => {
    const response = html();
    const fetch = vi.fn().mockResolvedValue(response);

    expect(await withStatusPage(fetch)(navigation())).toBe(response);
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("leaves error pages the router already rendered alone", async () => {
    const response = html(500);
    const fetch = vi.fn().mockResolvedValue(response);

    expect(await withStatusPage(fetch)(navigation())).toBe(response);
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("leaves redirects alone", async () => {
    const response = new Response(null, { status: 302, headers: { location: "/inbox" } });
    const fetch = vi.fn().mockResolvedValue(response);

    expect(await withStatusPage(fetch)(navigation())).toBe(response);
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("renders the error page for a navigation that failed with a JSON error", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(500)).mockResolvedValueOnce(html(500));

    const response = await withStatusPage(fetch)(navigation());

    expect(fetch).toHaveBeenCalledTimes(2);
    const rendered = fetch.mock.calls[1]![0] as Request;
    expect(rendered.url).toBe(URL_);
    expect(rendered.method).toBe("GET");
    expect(rendered.headers.get(STATUS_ERROR_HEADER)).toBe("500");
    expect(rendered.headers.get("accept")).toContain("text/html");
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe(PAGE_HTML);
  });

  test("keeps the failing status and its retry hint", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(503, { "retry-after": "30" }))
      .mockResolvedValueOnce(html(500));

    const response = await withStatusPage(fetch)(navigation());

    expect((fetch.mock.calls[1]![0] as Request).headers.get(STATUS_ERROR_HEADER)).toBe("503");
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  test("renders the error page when the request throws, and logs the error", async () => {
    const failure = new Error("boom");
    const fetch = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(html(500));

    const response = await withStatusPage(fetch)(navigation());

    expect(response.status).toBe(500);
    expect((fetch.mock.calls[1]![0] as Request).headers.get(STATUS_ERROR_HEADER)).toBe("500");
    expect(consoleError).toHaveBeenCalledWith("[status-page] unhandled request error", failure);
  });

  test("uses the status a thrown error carries", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }))
      .mockResolvedValueOnce(html(500));

    const response = await withStatusPage(fetch)(navigation());

    expect(response.status).toBe(403);
    expect((fetch.mock.calls[1]![0] as Request).headers.get(STATUS_ERROR_HEADER)).toBe("403");
  });

  test("rethrows the original error when the error page cannot render either", async () => {
    const failure = new Error("boom");
    const fetch = vi.fn().mockRejectedValueOnce(failure).mockRejectedValueOnce(new Error("again"));

    await expect(withStatusPage(fetch)(navigation())).rejects.toBe(failure);
  });

  test("returns the original response when the error page is not HTML", async () => {
    const original = json(500);
    const fetch = vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(json(500));

    expect(await withStatusPage(fetch)(navigation())).toBe(original);
  });

  test("leaves fetches and API clients to receive their JSON errors", async () => {
    const response = json(500);
    const fetch = vi.fn().mockResolvedValue(response);
    const handler = withStatusPage(fetch);

    const api = new Request(URL_, { headers: { accept: "application/json" } });
    expect(await handler(api)).toBe(response);
    const anything = new Request(URL_, { headers: { accept: "*/*" } });
    expect(await handler(anything)).toBe(response);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["a POST", { method: "POST", body: "{}" }],
    ["an embedded frame", { headers: { "sec-fetch-dest": "iframe" } }],
  ] as const)("leaves %s alone", async (_name, init) => {
    const response = json(500);
    const fetch = vi.fn().mockResolvedValue(response);

    expect(await withStatusPage(fetch)(navigation(init))).toBe(response);
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("never lets a client choose the status the server renders", async () => {
    const fetch = vi.fn().mockResolvedValue(html());
    const handler = withStatusPage(fetch);

    await handler(navigation({ headers: { [STATUS_ERROR_HEADER]: "503" } }));
    await handler(
      new Request(URL_, {
        headers: { accept: "application/json", [STATUS_ERROR_HEADER]: "503" },
      }),
    );

    for (const [request] of fetch.mock.calls as [Request][]) {
      expect(request.headers.has(STATUS_ERROR_HEADER)).toBe(false);
    }
  });

  test("keeps the method and body of a request it had to copy", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const request = new Request(URL_, {
      method: "POST",
      headers: { "content-type": "application/json", [STATUS_ERROR_HEADER]: "503" },
      body: JSON.stringify({ itemId: "item-1" }),
    });

    await withStatusPage(fetch)(request);

    const forwarded = fetch.mock.calls[0]![0] as Request;
    expect(forwarded.method).toBe("POST");
    expect(forwarded.url).toBe(URL_);
    expect(forwarded.headers.has(STATUS_ERROR_HEADER)).toBe(false);
    expect(await forwarded.json()).toEqual({ itemId: "item-1" });
  });

  test("forwards the runtime options to every render", async () => {
    const options = { context: { requestId: "r1" } };
    const fetch = vi.fn().mockResolvedValueOnce(json(500)).mockResolvedValueOnce(html(500));

    await withStatusPage(fetch)(navigation(), options);

    expect(fetch.mock.calls.map((call) => call[1])).toEqual([options, options]);
  });
});
