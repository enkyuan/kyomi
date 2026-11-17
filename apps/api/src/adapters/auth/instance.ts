import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import {
  betterAuthSchema,
  resolveBetterAuthBaseUrl,
  resolveBetterAuthTrustedOrigins,
  shouldUseSecureCookies,
} from "@kyomi/db";
import type { Database } from "@adapters/db/service";
import type { Env } from "@config/env/runtime";
import { resolveGoogleSocialProvider } from "./capabilities";
import { resolveLocationFromAuthContext } from "./location";
import { oauth } from "./oauth";

type AuthOptions = {
  config: Env;
  db: Database;
  /** Hand a sign-in code to the mailer. Must not wait for delivery. */
  sendOtp: (message: { to: string; otp: string }) => void;
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
    }),
    advanced: {
      useSecureCookies: shouldUseSecureCookies(baseURL),
    },
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
      emailOTP({
        sendVerificationOTP: async ({ email, otp }) => {
          sendOtp({ to: email, otp });
        },
      }),
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
