import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  betterAuthSchema,
  resolveBetterAuthBaseUrl,
  resolveBetterAuthTrustedOrigins,
  shouldUseSecureCookies,
} from "@kyomi/db";
import type { Database } from "@adapters/db/service";
import type { Env } from "@config/env/runtime";
import { resolveGoogleSocialProvider } from "./capabilities";
import { emailOtpPlugin } from "./email-otp";
import { resolveLocationFromAuthContext } from "./location";
import { oauth } from "./oauth";
import type { EmailOTPMessage } from "./otp";

type AuthOptions = {
  config: Env;
  db: Database;
  /** Hand a sign-in code to the mailer. Must not wait for delivery. */
  sendOtp: (message: EmailOTPMessage) => void;
};

/** The Better Auth instance for this configuration. Pure construction: no I/O until it serves. */
export function createAuth({ config, db, sendOtp }: AuthOptions) {
  const defaultApiOrigin = `http://localhost:${config.PORT}`;
  const baseURL = resolveBetterAuthBaseUrl(
    config.BETTER_AUTH_URL ?? defaultApiOrigin,
    defaultApiOrigin,
  );

  return betterAuth({
    secret: config.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: resolveBetterAuthTrustedOrigins({
      baseURL,
      trustedOrigins: config.BETTER_AUTH_TRUSTED_ORIGINS,
      additionalOrigins: [config.WEB_ORIGIN],
      includeLocalhost: config.NODE_ENV !== "production",
    }),
    advanced: {
      useSecureCookies: shouldUseSecureCookies(baseURL),
    },
    // Better Auth decides this from the raw process environment, which can disagree with the
    // validated one (it compares `NODE_ENV` exactly); follow the configuration this API booted with.
    rateLimit: { enabled: config.NODE_ENV === "production" },
    // When a query fails, Better Auth and its router log the drizzle error, whose message carries
    // the bound values: the one-time code and email of a sign-in, or a session token. Errors are
    // rethrown to this API's handler instead, which logs them through `errorMessage` without the
    // values, and Better Auth's own logger is off. Responses (4xx included) are unchanged.
    onAPIError: { throw: true },
    logger: { disabled: true },
    databaseHooks: {
      session: {
        create: {
          before: async (data, context) => ({
            data: resolveLocationFromAuthContext(
              context,
              typeof data.ipAddress === "string" ? data.ipAddress : null,
            ),
          }),
        },
      },
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: betterAuthSchema,
    }),
    emailAndPassword: {
      enabled: false,
    },
    plugins: [
      emailOtpPlugin(sendOtp),
      oauth({
        clientId: "kyomi-mobile",
        redirectURIs: ["kyomi://oauth/callback"],
      }),
    ],
    socialProviders: resolveGoogleSocialProvider({
      enabled: config.FEATURE_GOOGLE_OAUTH,
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
    }),
    session: {
      additionalFields: {
        locationLabel: {
          type: "string",
          required: false,
          input: false,
          returned: true,
        },
        locationCity: {
          type: "string",
          required: false,
          input: false,
          returned: true,
        },
        locationRegion: {
          type: "string",
          required: false,
          input: false,
          returned: true,
        },
        locationCountry: {
          type: "string",
          required: false,
          input: false,
          returned: true,
        },
      },
    },
  });
}
