import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  betterAuthSchema,
  resolveBetterAuthBaseUrl,
  resolveBetterAuthTrustedOrigins,
  shouldUseSecureCookies,
} from "@kyomi/db";
import { db } from "@adapters/db/client";
import { env } from "@config/env";
import { resolveLocationFromAuthContext } from "./location";

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
    enabled: true,
  },
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
