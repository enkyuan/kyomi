import { createHash } from "node:crypto";
import { type BetterAuthPlugin, HIDE_METADATA } from "better-auth";
import {
  APIError,
  addOAuthServerContext,
  createAuthEndpoint,
  createAuthMiddleware,
  getOAuthState,
} from "better-auth/api";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";
import { constantTimeEqual, generateRandomString } from "better-auth/crypto";
import { generateIdTokenNonce, generateState, getOAuthCallbackPath } from "better-auth/oauth2";
import { z } from "zod";

// OAuth 2.0 authorization code flow with PKCE for the native app (RFC 6749, RFC 7636,
// RFC 8252). The app is a public client: Better Auth runs the provider sign-in in the
// system browser, then the app receives a single-use code bound to its PKCE challenge
// instead of a session, so no session credential travels through a deep link.

const CODE_IDENTIFIER_PREFIX = "oauth-code:";
const CODE_TTL_MS = 60_000;
const SERVER_CONTEXT_KEY = "oauth";

const STATE_PATTERN = /^[\x21-\x7e]{1,512}$/;
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export type OAuthOptions = {
  /** Public identifier the app sends as `client_id`; not a secret. */
  clientId: string;
  /** Redirect URIs the app may use, compared by exact string match. */
  redirectURIs: readonly string[];
};

const authorizationQuerySchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string(),
  response_type: z.string().optional(),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
  provider: z.string().optional(),
});

const tokenBodySchema = z.object({
  grant_type: z.literal("authorization_code"),
  client_id: z.string(),
  redirect_uri: z.string(),
  code: z.string().min(1).max(256),
  code_verifier: z.string(),
});

const flowSchema = z.object({
  redirectURI: z.string(),
  state: z.string(),
  codeChallenge: z.string(),
});

const grantSchema = z.object({
  userId: z.string(),
  redirectURI: z.string(),
  codeChallenge: z.string(),
});

type AuthorizationQuery = z.infer<typeof authorizationQuerySchema>;
type OAuthFlow = z.infer<typeof flowSchema>;

function isRegisteredClient(options: OAuthOptions, clientId: string, redirectURI: string) {
  return clientId === options.clientId && options.redirectURIs.includes(redirectURI);
}

function invalidClient() {
  // RFC 6749 §4.1.2.1: an unverified redirect URI is never redirected to.
  return APIError.from("BAD_REQUEST", {
    code: "INVALID_CLIENT",
    message: "Unknown client or redirect URI",
  });
}

function invalidGrant() {
  return APIError.from("BAD_REQUEST", {
    code: "INVALID_GRANT",
    message: "Invalid or expired authorization code",
  });
}

function withParams(redirectURI: string, params: Record<string, string | undefined>) {
  const url = new URL(redirectURI);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function isRedirectTo(location: string, redirectURI: string) {
  return location === redirectURI || location.startsWith(`${redirectURI}?`);
}

function readAuthorizationRequest(
  query: AuthorizationQuery,
): { flow: OAuthFlow; providerId: string } | { error: string } {
  if (query.response_type !== "code") {
    return { error: "unsupported_response_type" };
  }
  if (
    !query.state ||
    !STATE_PATTERN.test(query.state) ||
    !query.provider ||
    query.code_challenge_method !== "S256" ||
    !query.code_challenge ||
    !CODE_CHALLENGE_PATTERN.test(query.code_challenge)
  ) {
    return { error: "invalid_request" };
  }
  return {
    flow: {
      redirectURI: query.redirect_uri,
      state: query.state,
      codeChallenge: query.code_challenge,
    },
    providerId: query.provider,
  };
}

function errorRedirectURL(query: AuthorizationQuery, error: string) {
  const state = query.state && STATE_PATTERN.test(query.state) ? query.state : undefined;
  return withParams(query.redirect_uri, { error, state });
}

function matchesCodeChallenge(codeVerifier: string, codeChallenge: string) {
  if (!CODE_VERIFIER_PATTERN.test(codeVerifier)) {
    return false;
  }
  const derived = createHash("sha256").update(codeVerifier).digest("base64url");
  return constantTimeEqual(derived, codeChallenge);
}

function parseGrant(value: string) {
  try {
    const grant = grantSchema.safeParse(JSON.parse(value));
    return grant.success ? grant.data : null;
  } catch {
    return null;
  }
}

export function oauth(options: OAuthOptions) {
  return {
    id: "oauth",
    endpoints: {
      oauthAuthorize: createAuthEndpoint(
        "/oauth/authorize",
        { method: "GET", query: authorizationQuerySchema, metadata: HIDE_METADATA },
        async (ctx) => {
          const { query } = ctx;
          if (!isRegisteredClient(options, query.client_id, query.redirect_uri)) {
            throw invalidClient();
          }
          const request = readAuthorizationRequest(query);
          if ("error" in request) {
            throw ctx.redirect(errorRedirectURL(query, request.error));
          }

          // The app may reach the API on a different origin than the auth base URL. The
          // provider calls back on the base URL, so the state cookie has to be set there.
          const beginURL = new URL(`${ctx.context.baseURL}/oauth/begin`);
          for (const [key, value] of Object.entries(query)) {
            if (value !== undefined) {
              beginURL.searchParams.set(key, value);
            }
          }
          throw ctx.redirect(beginURL.toString());
        },
      ),
      oauthBegin: createAuthEndpoint(
        "/oauth/begin",
        { method: "GET", query: authorizationQuerySchema, metadata: HIDE_METADATA },
        async (ctx) => {
          const { query } = ctx;
          if (!isRegisteredClient(options, query.client_id, query.redirect_uri)) {
            throw invalidClient();
          }
          const request = readAuthorizationRequest(query);
          if ("error" in request) {
            throw ctx.redirect(errorRedirectURL(query, request.error));
          }
          const provider = ctx.context.socialProviders.find(
            (candidate) => candidate.id === request.providerId,
          );
          if (!provider) {
            throw ctx.redirect(errorRedirectURL(query, "invalid_request"));
          }

          // Server context rides the OAuth state through the provider round trip and is
          // only readable by the callback, so the app's binding cannot be forged.
          await addOAuthServerContext({ [SERVER_CONTEXT_KEY]: request.flow });
          const idTokenNonce = generateIdTokenNonce(provider);
          const { state, codeVerifier } = await generateState(
            {
              ...ctx,
              body: {
                callbackURL: request.flow.redirectURI,
                errorCallbackURL: request.flow.redirectURI,
              },
            },
            { idTokenNonce },
          );
          const authorizationURL = await provider.createAuthorizationURL({
            state,
            codeVerifier,
            idTokenNonce,
            redirectURI: `${ctx.context.baseURL}${getOAuthCallbackPath(provider)}`,
          });
          throw ctx.redirect(authorizationURL.toString());
        },
      ),
      oauthToken: createAuthEndpoint(
        "/oauth/token",
        { method: "POST", body: tokenBodySchema, metadata: HIDE_METADATA },
        async (ctx) => {
          const { body } = ctx;
          if (!isRegisteredClient(options, body.client_id, body.redirect_uri)) {
            throw invalidClient();
          }

          // Consuming first makes every code single-use, including after a failed check.
          const verification = await ctx.context.internalAdapter.consumeVerificationValue(
            `${CODE_IDENTIFIER_PREFIX}${body.code}`,
          );
          const grant = verification ? parseGrant(verification.value) : null;
          if (
            !grant ||
            grant.redirectURI !== body.redirect_uri ||
            !matchesCodeChallenge(body.code_verifier, grant.codeChallenge)
          ) {
            throw invalidGrant();
          }

          const user = await ctx.context.internalAdapter.findUserById(grant.userId);
          if (!user) {
            throw invalidGrant();
          }
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ token: session.token });
        },
      ),
    },
    hooks: {
      after: [
        {
          matcher: (context) => context.path === "/callback/:id",
          handler: createAuthMiddleware(async (ctx) => {
            const oauthState = await getOAuthState();
            const flow = flowSchema.safeParse(oauthState?.serverContext?.[SERVER_CONTEXT_KEY]);
            if (!flow.success) {
              return;
            }
            const location = ctx.context.responseHeaders?.get("location");
            if (!location || !isRedirectTo(location, flow.data.redirectURI)) {
              return;
            }

            const redirect = new URL(location);
            const newSession = ctx.context.newSession;
            if (newSession && !redirect.searchParams.has("error")) {
              const code = generateRandomString(43, "a-z", "A-Z", "0-9");
              await ctx.context.internalAdapter.createVerificationValue({
                identifier: `${CODE_IDENTIFIER_PREFIX}${code}`,
                value: JSON.stringify({
                  userId: newSession.user.id,
                  redirectURI: flow.data.redirectURI,
                  codeChallenge: flow.data.codeChallenge,
                }),
                expiresAt: new Date(Date.now() + CODE_TTL_MS),
              });
              // The app gets its own session from the token endpoint; the system browser
              // keeps none.
              await ctx.context.internalAdapter.deleteSession(newSession.session.token);
              deleteSessionCookie(ctx);
              redirect.searchParams.set("code", code);
            }
            redirect.searchParams.set("state", flow.data.state);
            ctx.setHeader("location", redirect.toString());
          }),
        },
      ],
    },
    rateLimit: [
      {
        pathMatcher: (path) => path.startsWith("/oauth/"),
        window: 60,
        max: 10,
      },
    ],
  } satisfies BetterAuthPlugin;
}
