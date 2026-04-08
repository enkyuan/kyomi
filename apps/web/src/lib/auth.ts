import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import {
  betterAuthSchema,
  resolveBetterAuthBaseUrl,
  resolveBetterAuthTrustedOrigins,
  shouldUseSecureCookies,
} from "@/db/better-auth";
import { db } from "@/db";

function requireBetterAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error("[auth] Missing BETTER_AUTH_SECRET");
  }

  return secret;
}

const baseURL = resolveBetterAuthBaseUrl(
  process.env.BETTER_AUTH_URL ?? process.env.SERVER_URL,
  "http://localhost:3000",
);

export const auth = betterAuth({
  secret: requireBetterAuthSecret(),
  baseURL,
  trustedOrigins: resolveBetterAuthTrustedOrigins({
    baseURL,
    trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
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
  plugins: [tanstackStartCookies()],
});
