import { describe, expect, test } from "bun:test";
import { isOAuthTokenRequest, redactSessionToken, withoutToken } from "@adapters/auth/redact";

const session = { id: "s1", token: "secret-token", userId: "u1", userAgent: "Mozilla" };

describe("isOAuthTokenRequest", () => {
  test.each([
    ["http://localhost/api/auth/oauth/token", true],
    ["http://localhost/api/auth/oauth/token/", true],
    ["http://localhost/api/auth/oauth/token///", true],
    ["http://localhost/api/auth/oauth/token?x=1", true],
    ["http://localhost/api/auth/oauth/token-extra", false],
    ["http://localhost/api/auth//oauth/token", false],
    ["http://localhost/api/auth/get-session", false],
    ["http://localhost/api/auth/sign-in/email-otp", false],
  ])("%s -> %p", (url, expected) => {
    expect(isOAuthTokenRequest(new Request(url))).toBe(expected);
  });
});

describe("withoutToken", () => {
  test("drops the token and keeps the rest", () => {
    expect(withoutToken(session)).toEqual({ id: "s1", userId: "u1", userAgent: "Mozilla" });
  });
});

describe("redactSessionToken", () => {
  const json = (body: unknown, init: ResponseInit = {}) =>
    Response.json(body, { headers: { "set-cookie": "a=1; HttpOnly" }, ...init });

  test("removes session.token and keeps the user, status and headers", async () => {
    const sent = JSON.stringify({ session, user: { id: "u1", email: "a@b.c" } });
    const original = new Response(sent, {
      headers: {
        "content-type": "application/json",
        "content-length": String(sent.length),
        "set-cookie": "a=1; HttpOnly",
      },
    });

    const response = await redactSessionToken(original);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBe("a=1; HttpOnly");
    // The shorter body would be cut off by the old length.
    expect(response.headers.has("content-length")).toBe(false);
    const text = await response.text();
    expect(text).not.toContain("secret-token");
    expect(JSON.parse(text)).toEqual({
      session: { id: "s1", userId: "u1", userAgent: "Mozilla" },
      user: { id: "u1", email: "a@b.c" },
    });
  });

  test("keeps every cookie a refreshed session sets", async () => {
    const headers = new Headers({ "content-type": "application/json" });
    headers.append("set-cookie", "a=1; HttpOnly");
    headers.append("set-cookie", "b=2; HttpOnly");

    const response = await redactSessionToken(
      new Response(JSON.stringify({ session, user: {} }), { headers }),
    );

    expect(response.headers.getSetCookie()).toEqual(["a=1; HttpOnly", "b=2; HttpOnly"]);
  });

  test.each([
    ["sign-in", { token: "secret-token", redirect: false, user: { id: "u1" } }],
    ["email verification", { status: true, token: "secret-token", user: { id: "u1" } }],
  ])("removes the top-level token a %s answers with", async (_name, body) => {
    const response = await redactSessionToken(
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "set-cookie": "a=1; HttpOnly" },
      }),
    );

    const text = await response.text();
    expect(text).not.toContain("secret-token");
    const { token: _token, ...rest } = body;
    expect(JSON.parse(text)).toEqual(rest);
    expect(response.headers.get("set-cookie")).toBe("a=1; HttpOnly");
  });

  test("removes both tokens when a body has them in both places", async () => {
    const response = await redactSessionToken(
      Response.json({ token: "top-secret", session, user: {} }),
    );

    const text = await response.text();
    expect(text).not.toContain("top-secret");
    expect(text).not.toContain("secret-token");
    expect(JSON.parse(text)).toEqual({
      session: { id: "s1", userId: "u1", userAgent: "Mozilla" },
      user: {},
    });
  });

  test.each([
    ["no session (null body)", "null"],
    ["a body that is a list", JSON.stringify([{ token: "kept" }])],
    ["a body with a null token and no session", JSON.stringify({ status: true, user: {} })],
    ["a session object with no token", JSON.stringify({ session: { id: "s1" }, user: {} })],
    ["a body that is not JSON", "{not json"],
  ])("leaves %s as it was", async (_name, text) => {
    const response = await redactSessionToken(
      new Response(text, { headers: { "content-type": "application/json" } }),
    );

    expect(await response.text()).toBe(text);
  });

  test("passes a failure and a non-JSON response through untouched", async () => {
    const failure = json({ message: "Unauthorized", session }, { status: 401 });
    const html = new Response("<p>hi</p>", { headers: { "content-type": "text/html" } });

    expect(await redactSessionToken(failure)).toBe(failure);
    expect(await redactSessionToken(html)).toBe(html);
  });
});

describe("isOAuthTokenRequest on a hostile path", () => {
  test("stays fast with a very long run of trailing slashes", () => {
    const request = new Request(`http://localhost/api/auth/${"/".repeat(15_000)}x`);

    const started = performance.now();
    expect(isOAuthTokenRequest(request)).toBe(false);

    expect(performance.now() - started).toBeLessThan(20);
  });
});
