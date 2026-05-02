/** Parse `FEED_ADMIN_USER_IDS` env (comma-separated Better Auth user ids). */
export function parseFeedAdminUserIds(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
