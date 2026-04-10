import { timingSafeEqual } from "node:crypto";
import { env } from "@config/env";
import { AppError } from "@shared/errors/app-error";
import { parseFeedAdminUserIds } from "./feeds.admin-allowlist";

function sharedSecretMatches(headers: Headers | undefined): boolean {
  const configuredSecret = env.FEED_ADMIN_SHARED_SECRET?.trim();
  const providedSecret = headers?.get("x-feed-admin-secret")?.trim();
  if (!configuredSecret || !providedSecret) {
    return false;
  }

  const configured = Buffer.from(configuredSecret);
  const provided = Buffer.from(providedSecret);
  return configured.length === provided.length && timingSafeEqual(configured, provided);
}

export function assertFeedAdminUser(userId: string, headers?: Headers): void {
  const allowlist = parseFeedAdminUserIds(env.FEED_ADMIN_USER_IDS);
  if (allowlist.includes(userId) || sharedSecretMatches(headers)) {
    return;
  }

  if (allowlist.length === 0 && !env.FEED_ADMIN_SHARED_SECRET) {
    throw new AppError("Feed admin is not configured", {
      status: 403,
      code: "FEED_ADMIN_DISABLED",
    });
  }

  throw new AppError("Forbidden", { status: 403, code: "FEED_ADMIN_FORBIDDEN" });
}
