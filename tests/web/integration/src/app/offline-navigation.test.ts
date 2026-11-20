import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("a cold offline inbox navigation gets the public shell; private API responses never enter the static cache", async () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const shell = new Response("offline shell");
  const match = vi.fn(async () => shell);
  vi.stubGlobal("self", {
    location: new URL("https://kyomi.test/"),
    addEventListener: (event: string, handler: (event: unknown) => void) =>
      listeners.set(event, handler),
  });
  vi.stubGlobal("caches", { match });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  vi.stubGlobal("__STATIC_ASSET_URLS__", ["/offline.html", "/offline-reader.js"]);
  vi.stubGlobal("__SW_VERSION__", "test");
  await import("../../../../../apps/web/service-worker");
  const send = vi.fn();
  const open = (path: string) =>
    listeners.get("fetch")!({
      request: { url: "https://kyomi.test" + path, method: "GET", mode: "navigate" },
      respondWith: send,
    });
  open("/inbox?itemId=1");
  expect(await send.mock.calls[0][0]).toBe(shell);
  expect(match).toHaveBeenCalledWith("/offline.html");
  open("/api/auth/get-session");
  open("/api/v1/articles/1");
  expect(send).toHaveBeenCalledTimes(1);
});
