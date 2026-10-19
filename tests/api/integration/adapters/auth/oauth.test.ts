import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import path from "node:path";
import { oauth } from "@adapters/auth/oauth";

// Better Auth keeps OAuth request state in module scope, so the test loads the same
// copy the plugin imports instead of a separately resolved one.
const authAdapterDir = path.dirname(Bun.resolveSync("@adapters/auth/oauth", import.meta.dir));
const { betterAuth } = await import(Bun.resolveSync("better-auth", authAdapterDir));
const { memoryAdapter } = await import(
  Bun.resolveSync("better-auth/adapters/memory", authAdapterDir)
);

const API_ORIGIN = "http://api.kyomi.test";
const AUTH_ORIGIN = "http://auth.kyomi.test";
const CLIENT_ID = "kyomi-mobile";
const REDIRECT_URI = "kyomi://oauth/callback";
const OTHER_REDIRECT_URI = "kyomi://oauth/other";
const APP_STATE = "app-state-0123456789";
const CODE_VERIFIER = "Kyomi0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV";
const CODE_CHALLENGE = createHash("sha256").update(CODE_VERIFIER).digest("base64url");
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type TestDatabase = Record<"user" | "session" | "account" | "verification", unknown[]>;
type TestAuth = { handler: (request: Request) => Promise<Response> };

function createTestAuth() {
  const db: TestDatabase = { user: [], session: [], account: [], verification: [] };
  const auth: TestAuth = betterAuth({
    baseURL: AUTH_ORIGIN,
    secret: "oauth-integration-test-secret",
    database: memoryAdapter(db),
    rateLimit: { enabled: false },
    socialProviders: {
      google: { clientId: "google-client-id", clientSecret: "google-client-secret" },
    },
    plugins: [oauth({ clientId: CLIENT_ID, redirectURIs: [REDIRECT_URI, OTHER_REDIRECT_URI] })],
  });
  return { auth, db };
}

function base64url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

// Google's code exchange runs over TLS, so Better Auth decodes the ID token unverified.
const googleIdToken = [
  base64url({ alg: "none", typ: "JWT" }),
  base64url({
    iss: "https://accounts.google.com",
    sub: "google-user-1",
    email: "reader@example.com",
    email_verified: true,
    name: "Reader",
  }),
  "signature",
].join(".");

function authorizeURL(overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state: APP_STATE,
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: "S256",
    provider: "google",
    ...overrides,
  });
  return `${API_ORIGIN}/api/auth/oauth/authorize?${params}`;
}

function liveCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .filter((cookie) => !/max-age=0/i.test(cookie))
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

function lastSessionCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .filter((cookie) => cookie.startsWith("better-auth.session_token="))
    .at(-1);
}

function location(response: Response) {
  const value = response.headers.get("location");
  if (!value) {
    throw new Error(`Expected a redirect, got ${response.status}`);
  }
  return new URL(value);
}

async function startProviderSignIn(auth: TestAuth) {
  const authorize = await auth.handler(new Request(authorizeURL()));
  const begin = await auth.handler(new Request(location(authorize)));
  return {
    providerState: location(begin).searchParams.get("state") ?? "",
    stateCookie: liveCookies(begin),
  };
}

async function completeProviderSignIn(auth: TestAuth, query: Record<string, string> = {}) {
  const { providerState, stateCookie } = await startProviderSignIn(auth);
  const params = new URLSearchParams({ code: "google-code", state: providerState, ...query });
  return auth.handler(
    new Request(`${AUTH_ORIGIN}/api/auth/callback/google?${params}`, {
      headers: { cookie: stateCookie },
    }),
  );
}

function exchangeCode(auth: TestAuth, body: Record<string, string>) {
  return auth.handler(
    new Request(`${API_ORIGIN}/api/auth/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: CODE_VERIFIER,
        ...body,
      }),
    }),
  );
}

let fetchSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  const realFetch = globalThis.fetch;
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === GOOGLE_TOKEN_ENDPOINT) {
      return Promise.resolve(
        Response.json({
          access_token: "google-access-token",
          expires_in: 3600,
          id_token: googleIdToken,
          token_type: "Bearer",
        }),
      );
    }
    return realFetch(input, init);
  }) as typeof fetch);
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe("OAuth authorization", () => {
  test("forwards a valid request to the auth origin the provider calls back to", async () => {
    const { auth } = createTestAuth();

    const response = await auth.handler(new Request(authorizeURL()));
    const begin = location(response);

    expect(response.status).toBe(302);
    expect(`${begin.origin}${begin.pathname}`).toBe(`${AUTH_ORIGIN}/api/auth/oauth/begin`);
    expect(begin.searchParams.get("state")).toBe(APP_STATE);
    expect(begin.searchParams.get("code_challenge")).toBe(CODE_CHALLENGE);
  });

  test("starts the provider sign-in with a state cookie on the auth origin", async () => {
    const { auth } = createTestAuth();
    const authorize = await auth.handler(new Request(authorizeURL()));

    const begin = await auth.handler(new Request(location(authorize)));
    const provider = location(begin);

    expect(begin.status).toBe(302);
    expect(provider.origin).toBe("https://accounts.google.com");
    expect(provider.searchParams.get("redirect_uri")).toBe(
      `${AUTH_ORIGIN}/api/auth/callback/google`,
    );
    expect(provider.searchParams.get("state")).not.toBe(APP_STATE);
    expect(liveCookies(begin)).toContain("better-auth.state=");
  });

  test.each([
    ["an unregistered redirect URI", { redirect_uri: "evil://oauth/callback" }],
    ["an unknown client", { client_id: "someone-else" }],
  ])("rejects %s without redirecting", async (_, overrides) => {
    const { auth } = createTestAuth();

    const response = await auth.handler(new Request(authorizeURL(overrides)));

    expect(response.status).toBe(400);
    expect(response.headers.get("location")).toBeNull();
  });

  test.each([
    ["a plain PKCE challenge", { code_challenge_method: "plain" }, "invalid_request"],
    ["a malformed PKCE challenge", { code_challenge: "short" }, "invalid_request"],
    ["an implicit grant", { response_type: "token" }, "unsupported_response_type"],
  ])("returns %s to the app as an OAuth error", async (_, overrides, error) => {
    const { auth } = createTestAuth();

    const redirect = location(await auth.handler(new Request(authorizeURL(overrides))));

    expect(`${redirect.protocol}//${redirect.host}${redirect.pathname}`).toBe(REDIRECT_URI);
    expect(redirect.searchParams.get("error")).toBe(error);
    expect(redirect.searchParams.get("state")).toBe(APP_STATE);
  });

  test("returns an unconfigured provider to the app as an OAuth error", async () => {
    const { auth } = createTestAuth();
    const authorize = await auth.handler(new Request(authorizeURL({ provider: "github" })));

    const redirect = location(await auth.handler(new Request(location(authorize))));

    expect(redirect.searchParams.get("error")).toBe("invalid_request");
    expect(redirect.searchParams.get("state")).toBe(APP_STATE);
  });
});

describe("OAuth callback", () => {
  test("redirects to the app with a code and its state, leaving the browser no session", async () => {
    const { auth, db } = createTestAuth();

    const callback = await completeProviderSignIn(auth);
    const redirect = location(callback);

    expect(redirect.toString()).toStartWith(`${REDIRECT_URI}?`);
    expect(redirect.searchParams.get("code")).toMatch(/^[A-Za-z0-9]{43}$/);
    expect(redirect.searchParams.get("state")).toBe(APP_STATE);
    expect(lastSessionCookie(callback)).toMatch(/max-age=0/i);
    expect(db.user).toHaveLength(1);
    expect(db.session).toHaveLength(0);
  });

  test("returns a provider error to the app with its state", async () => {
    const { auth, db } = createTestAuth();

    const redirect = location(await completeProviderSignIn(auth, { error: "access_denied" }));

    expect(redirect.searchParams.get("error")).toBe("access_denied");
    expect(redirect.searchParams.get("state")).toBe(APP_STATE);
    expect(redirect.searchParams.get("code")).toBeNull();
    expect(db.user).toHaveLength(0);
  });

  test("leaves the web social sign-in redirect and session untouched", async () => {
    const { auth, db } = createTestAuth();
    const signIn = await auth.handler(
      new Request(`${AUTH_ORIGIN}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: `${AUTH_ORIGIN}/inbox` }),
      }),
    );
    const providerState = location(signIn).searchParams.get("state") ?? "";

    const callback = await auth.handler(
      new Request(
        `${AUTH_ORIGIN}/api/auth/callback/google?code=google-code&state=${providerState}`,
        {
          headers: { cookie: liveCookies(signIn) },
        },
      ),
    );

    expect(location(callback).toString()).toBe(`${AUTH_ORIGIN}/inbox`);
    expect(lastSessionCookie(callback)).not.toMatch(/max-age=0/i);
    expect(db.session).toHaveLength(1);
  });
});

describe("OAuth token exchange", () => {
  test("exchanges the code for a session cookie bound to the verifier", async () => {
    const { auth, db } = createTestAuth();
    const code = location(await completeProviderSignIn(auth)).searchParams.get("code") ?? "";

    const response = await exchangeCode(auth, { code });
    const session = await auth.handler(
      new Request(`${API_ORIGIN}/api/auth/get-session`, {
        headers: { cookie: liveCookies(response) },
      }),
    );

    expect(response.status).toBe(200);
    expect(db.session).toHaveLength(1);
    expect(await session.json()).toMatchObject({ user: { email: "reader@example.com" } });
  });

  test("accepts each code once", async () => {
    const { auth } = createTestAuth();
    const code = location(await completeProviderSignIn(auth)).searchParams.get("code") ?? "";

    expect((await exchangeCode(auth, { code })).status).toBe(200);
    expect((await exchangeCode(auth, { code })).status).toBe(400);
  });

  test("burns the code when the verifier does not match", async () => {
    const { auth, db } = createTestAuth();
    const code = location(await completeProviderSignIn(auth)).searchParams.get("code") ?? "";

    const mismatch = await exchangeCode(auth, { code, code_verifier: "x".repeat(64) });
    const retry = await exchangeCode(auth, { code });

    expect(mismatch.status).toBe(400);
    expect(retry.status).toBe(400);
    expect(db.session).toHaveLength(0);
  });

  test("rejects a code redeemed for a different redirect URI", async () => {
    const { auth } = createTestAuth();
    const code = location(await completeProviderSignIn(auth)).searchParams.get("code") ?? "";

    const response = await exchangeCode(auth, { code, redirect_uri: OTHER_REDIRECT_URI });

    expect(response.status).toBe(400);
  });
});
