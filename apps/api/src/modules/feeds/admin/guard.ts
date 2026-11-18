import { timingSafeEqual } from "node:crypto";
import { Effect } from "effect";
import { AppConfig } from "@config/env/service";
import { Forbidden } from "@shared/effect/errors";
import { parseFeedAdminUserIds } from "./allowlist";

function sharedSecretMatches(configured: string | undefined, headers: Headers | undefined) {
  const configuredSecret = configured?.trim();
  const providedSecret = headers?.get("x-feed-admin-secret")?.trim();
  if (!configuredSecret || !providedSecret) {
    return false;
  }

  const expected = new TextEncoder().encode(configuredSecret);
  const provided = new TextEncoder().encode(providedSecret);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

/**
 * Allows the platform admins named in `FEED_ADMIN_USER_IDS`, or any caller presenting
 * `FEED_ADMIN_SHARED_SECRET` in `x-feed-admin-secret`. Fails with `Forbidden` otherwise.
 */
export const requireFeedAdmin = Effect.fn("feeds.admin.require")(function* (
  userId: string,
  headers?: Headers,
) {
  const config = yield* AppConfig;
  const allowlist = parseFeedAdminUserIds(config.FEED_ADMIN_USER_IDS);
  if (allowlist.includes(userId) || sharedSecretMatches(config.FEED_ADMIN_SHARED_SECRET, headers)) {
    return;
  }

  if (allowlist.length === 0 && !config.FEED_ADMIN_SHARED_SECRET) {
    return yield* new Forbidden({
      message: "Feed admin is not configured",
      code: "FEED_ADMIN_DISABLED",
    });
  }

  return yield* new Forbidden({ message: "Forbidden", code: "FEED_ADMIN_FORBIDDEN" });
});
