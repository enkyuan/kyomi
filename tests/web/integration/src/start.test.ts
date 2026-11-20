// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { startInstance } from "@/start";

type ServerOptions = {
  request: Request;
  handlerType: "serverFn" | "router";
  next: () => unknown;
};
type RequestMiddleware = { options: { server: (ctx: ServerOptions) => unknown } };

const ORIGIN = "https://kyomi.test";
const REACHED_HANDLER = Symbol("reached handler");

/** Runs a request through the request middleware the app registers, as Start's handler does. */
async function send(
  path: string,
  init: RequestInit = {},
  handlerType: ServerOptions["handlerType"] = "serverFn",
) {
  const options = await startInstance.getOptions();
  const middleware = options.requestMiddleware as unknown as RequestMiddleware[];
  expect(middleware).toHaveLength(1);

  const next = vi.fn(() => REACHED_HANDLER);
  const result = await middleware[0]!.options.server({
    request: new Request(`${ORIGIN}${path}`, init),
    handlerType,
    next,
  });

  return { result, reachedHandler: next.mock.calls.length === 1 };
}

const SERVER_FN = "/_serverFn/updateInboxItemState";

describe("server function CSRF protection", () => {
  test.each([
    ["cross-site", { "sec-fetch-site": "cross-site" }],
    ["same-site (a sibling subdomain)", { "sec-fetch-site": "same-site" }],
    ["user-initiated (a typed or bookmarked URL)", { "sec-fetch-site": "none" }],
  ])("refuses a mutating request that is %s", async (_name, headers) => {
    const { result, reachedHandler } = await send(SERVER_FN, {
      method: "POST",
      headers: { ...headers, origin: "https://evil.example", cookie: "kyomi.session=victim" },
      body: JSON.stringify({ data: { itemId: "x", isRead: true } }),
    });

    expect(reachedHandler).toBe(false);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  test("trusts Sec-Fetch-Site over a forged same-origin Origin", async () => {
    const { reachedHandler } = await send(SERVER_FN, {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site", origin: ORIGIN },
    });

    expect(reachedHandler).toBe(false);
  });

  test.each([
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["a null Origin", { origin: "null" }],
    ["a look-alike Origin", { origin: `${ORIGIN}.evil.example` }],
    ["a foreign Referer", { referer: "https://evil.example/page" }],
    ["a look-alike Referer", { referer: `${ORIGIN}.evil.example/page` }],
    ["no origin evidence at all", {}],
  ])(
    "refuses a mutating request from a client without Sec-Fetch-Site and with %s",
    async (_n, headers) => {
      const { reachedHandler } = await send(SERVER_FN, { method: "POST", headers });

      expect(reachedHandler).toBe(false);
    },
  );

  test("refuses a cross-site read of a GET server function", async () => {
    const { reachedHandler } = await send(`${SERVER_FN}?payload=%7B%7D`, {
      headers: { "sec-fetch-site": "cross-site" },
    });

    expect(reachedHandler).toBe(false);
  });

  test("serves the app's own mutating request", async () => {
    const { result, reachedHandler } = await send(SERVER_FN, {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", origin: ORIGIN },
    });

    expect(reachedHandler).toBe(true);
    expect(result).toBe(REACHED_HANDLER);
  });

  test("serves the app's own read of a GET server function", async () => {
    const { reachedHandler } = await send(`${SERVER_FN}?payload=%7B%7D`, {
      headers: { "sec-fetch-site": "same-origin" },
    });

    expect(reachedHandler).toBe(true);
  });

  test.each([
    ["Origin", { origin: ORIGIN }],
    ["Referer", { referer: `${ORIGIN}/inbox` }],
  ])("serves a same-origin request from a client that only sends %s", async (_name, headers) => {
    const { reachedHandler } = await send(SERVER_FN, { method: "POST", headers });

    expect(reachedHandler).toBe(true);
  });

  test("leaves page navigations alone, including a link followed from another site", async () => {
    const { reachedHandler } = await send(
      "/inbox",
      { headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" } },
      "router",
    );

    expect(reachedHandler).toBe(true);
  });
});

describe("start instance", () => {
  test("still serializes HTTP status errors", async () => {
    const options = await startInstance.getOptions();

    expect(options.serializationAdapters).toHaveLength(1);
  });
});
