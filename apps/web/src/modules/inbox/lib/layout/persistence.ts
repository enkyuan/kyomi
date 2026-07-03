import type { ArticleOpenBehaviorDto } from "@lib/schemas/index";

export const INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME = "cronos_inbox_article_open_behavior";
const INBOX_LAYOUT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function parseCookieHeader(cookieHeader?: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const segments = trimmed.split("=", 2);
    if (segments.length < 2) {
      continue;
    }
    const key = segments[0]?.trim();
    const value = segments[1]?.trim();
    if (!key) {
      continue;
    }
    cookies.set(key, decodeURIComponent(value));
  }

  return cookies;
}

export function readInboxArticleOpenBehaviorCookie(
  cookieHeader?: string | null,
): ArticleOpenBehaviorDto | undefined {
  const value = parseCookieHeader(cookieHeader).get(INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME);
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
