export const INBOX_PREVIOUS_FEED_ID_STATE_KEY = "kyomiInboxPreviousFeedId";

export function getPreviousInboxFeedId(state: unknown) {
  if (!state || typeof state !== "object") {
    return undefined;
  }

  const value = (state as Record<string, unknown>)[INBOX_PREVIOUS_FEED_ID_STATE_KEY];
  return typeof value === "string" && value ? value : undefined;
}
