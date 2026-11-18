import type { ArticleOpenBehaviorDto } from "@kyomi/reader/schemas";
import { readCookie } from "@lib/cookies";

export const INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME = "cronos_inbox_article_open_behavior";
const INBOX_LAYOUT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function readInboxArticleOpenBehaviorCookie(
  cookieHeader?: string | null,
): ArticleOpenBehaviorDto | undefined {
  const value = readCookie(cookieHeader, INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME);
  if (value === "split" || value === "reader") {
    return value;
  }
  return undefined;
}

export function writeInboxArticleOpenBehaviorCookie(value: ArticleOpenBehaviorDto) {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie =
    `${INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME}=${encodeURIComponent(value)}; ` +
    `path=/; max-age=${INBOX_LAYOUT_COOKIE_MAX_AGE}`;
}
