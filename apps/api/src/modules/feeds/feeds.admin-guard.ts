import { env } from "@config/env";
import { AppError } from "@shared/errors/app-error";
import { parseFeedAdminUserIds } from "./feeds.admin-allowlist";

export function assertFeedAdminUser(userId: string): void {
  const allowlist = parseFeedAdminUserIds(env.FEED_ADMIN_USER_IDS);
  if (allowlist.length === 0) {
    throw new AppError("Feed admin is not configured", {
      status: 403,
      code: "FEED_ADMIN_DISABLED",
    });
  }
  if (!allowlist.includes(userId)) {
    throw new AppError("Forbidden", { status: 403, code: "FEED_ADMIN_FORBIDDEN" });
  }
}
