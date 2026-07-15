import { afterEach, describe, expect, mock, test } from "bun:test";
import { auth } from "@adapters/auth";
import { createApp } from "@app/http/create-app";

type MutableAuth = {
  handler: typeof auth.handler;
};

const mutableAuth = auth as unknown as MutableAuth;
const originalAuthHandler = auth.handler;

afterEach(() => {
  mutableAuth.handler = originalAuthHandler;
});

describe("authRoutes JSON passthrough", () => {
  test.each([
    ["exact auth route", "/api/auth"],
    ["wildcard auth route", "/api/auth/body-probe"],
  ])("preserves the raw request body for the %s", async (_, path) => {
    const payload = { path, probe: true };
    const handler = mock(async (request: Request) => {
      const bodyWasUsed = request.bodyUsed;
      const body = await request.json();

      return Response.json({ bodyWasUsed, body });
    });

    mutableAuth.handler = handler as typeof auth.handler;

    const app = createApp();
    const response = await app.handle(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      bodyWasUsed: false,
      body: payload,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
