import { describe, expect, test } from "bun:test";
import {
  DEFAULT_MAX_BODY_BYTES,
  largeBodyAuthPlugin,
  requestGuardPlugin,
} from "@app/setup/request-guard";
import { Unauthorized } from "@shared/effect/errors";
import { Elysia } from "@api-tests/support/elysia";

function appUnderTest() {
  let handled = 0;
  const app = new Elysia()
    .use(requestGuardPlugin)
    .post("/api/v1/feeds", () => {
      handled += 1;
      return { ok: true };
    })
    .post("/api/v1/opml/imports/raw", () => {
      handled += 1;
      return { ok: true };
    })
    .get("/api/v1/feeds", () => ({ ok: true }));
  return { app, handled: () => handled };
}

/** A server puts the length of the body it received on the request; `Request` does not. */
const post = (path: string, body: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
      ...headers,
    },
    body,
  });

describe("request guard", () => {
  test("refuses a body over the default ceiling before any handler runs", async () => {
    const { app, handled } = appUnderTest();

    const response = await app.handle(
      post("/api/v1/feeds", JSON.stringify({ pad: "x".repeat(DEFAULT_MAX_BODY_BYTES) })),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
    expect(handled()).toBe(0);
  });

  test("refuses a declared length over the ceiling without reading the body", async () => {
    const { app, handled } = appUnderTest();

    const response = await app.handle(
      post("/api/v1/feeds", "{}", { "content-length": String(40 * 1024 * 1024) }),
    );

    expect(response.status).toBe(413);
    expect(handled()).toBe(0);
  });

  test("refuses a body whose size is not declared", async () => {
    const { app, handled } = appUnderTest();

    const response = await app.handle(
      new Request("http://localhost/api/v1/feeds", {
        method: "POST",
        headers: { "content-type": "application/json", "transfer-encoding": "chunked" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(411);
    expect(handled()).toBe(0);
  });

  test("lets ordinary bodies and reads through", async () => {
    const { app, handled } = appUnderTest();

    const created = await app.handle(
      post("/api/v1/feeds", JSON.stringify({ url: "https://a.test" })),
    );
    const read = await app.handle(new Request("http://localhost/api/v1/feeds"));

    expect(created.status).toBe(200);
    expect(read.status).toBe(200);
    expect(handled()).toBe(1);
  });

  test("the OPML import routes may take their large document", async () => {
    const { app, handled } = appUnderTest();

    const response = await app.handle(
      post("/api/v1/opml/imports/raw", "x".repeat(DEFAULT_MAX_BODY_BYTES + 1)),
    );

    expect(response.status).toBe(200);
    expect(handled()).toBe(1);
  });

  test("marks every response nosniff, refusals included", async () => {
    const { app } = appUnderTest();

    const ok = await app.handle(new Request("http://localhost/api/v1/feeds"));
    const refused = await app.handle(
      post("/api/v1/feeds", "{}", { "content-length": String(DEFAULT_MAX_BODY_BYTES + 1) }),
    );

    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(refused.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("large-document routes", () => {
  /** The guard, then the session check, then a handler that reports whether it was reached. */
  function appWithAuth(authenticate: (request: Request) => Promise<unknown>) {
    let parsed = 0;
    const app = new Elysia()
      .use(requestGuardPlugin)
      .use(largeBodyAuthPlugin((request) => authenticate(request)))
      .post("/api/v1/opml/imports/raw", () => ({ ok: true }), {
        parse: async ({ request }) => {
          parsed += 1;
          return request.text();
        },
      })
      .post("/api/v1/feeds", () => ({ ok: true }));
    return { app, parsed: () => parsed };
  }

  const unauthorized = () =>
    Promise.reject(new Unauthorized({ message: "Unauthorized", code: "UNAUTHORIZED" }));

  test("an anonymous caller is refused before the document is read", async () => {
    const { app, parsed } = appWithAuth(unauthorized);

    const response = await app.handle(
      post("/api/v1/opml/imports/raw", "x".repeat(DEFAULT_MAX_BODY_BYTES + 1), {
        "content-type": "application/xml",
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(parsed()).toBe(0);
  });

  test("a signed-in caller can still send the large document", async () => {
    const { app, parsed } = appWithAuth(async () => ({ userId: "user-1" }));

    const response = await app.handle(
      post("/api/v1/opml/imports/raw", "x".repeat(DEFAULT_MAX_BODY_BYTES + 1), {
        "content-type": "application/xml",
      }),
    );

    expect(response.status).toBe(200);
    expect(parsed()).toBe(1);
  });

  test("other routes are not asked for a session here", async () => {
    let asked = 0;
    const { app } = appWithAuth(async () => {
      asked += 1;
    });

    await app.handle(post("/api/v1/feeds", "{}"));

    expect(asked).toBe(0);
  });
});
