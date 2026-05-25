import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  betterAuthSchema,
  resolveBetterAuthBaseUrl,
  resolveBetterAuthTrustedOrigins,
  shouldUseSecureCookies,
} from "@vols.rss/db";
import { db } from "@adapters/db/client";
import { env } from "@config/env";

const defaultApiOrigin = `http://localhost:${env.PORT}`;
const baseURL = resolveBetterAuthBaseUrl(env.BETTER_AUTH_URL ?? defaultApiOrigin, defaultApiOrigin);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: resolveBetterAuthTrustedOrigins({
    baseURL,
    trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
    additionalOrigins: [env.WEB_ORIGIN],
  }),
  advanced: {
    useSecureCookies: shouldUseSecureCookies(baseURL),
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: betterAuthSchema,
  }),
  emailAndPassword: {
    enabled: true,
  },
});
