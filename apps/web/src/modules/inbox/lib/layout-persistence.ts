import type { ArticleOpenBehaviorDto } from "@lib/api-schemas";

export const INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME = "cronos_inbox_article_open_behavior";
export const INBOX_SPLIT_PANE_PERCENT_COOKIE_NAME = "cronos_inbox_split_pane_percent";
export const INBOX_LAYOUT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
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

export function readInboxSplitPanePercentCookie(cookieHeader?: string | null): number | undefined {
  const value = parseCookieHeader(cookieHeader).get(INBOX_SPLIT_PANE_PERCENT_COOKIE_NAME);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

export function writeInboxArticleOpenBehaviorCookie(value: ArticleOpenBehaviorDto) {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie =
    `${INBOX_ARTICLE_OPEN_BEHAVIOR_COOKIE_NAME}=${encodeURIComponent(value)}; ` +
    `path=/; max-age=${INBOX_LAYOUT_COOKIE_MAX_AGE}`;
}

export function writeInboxSplitPanePercentCookie(value: number) {
  if (typeof document === "undefined" || !Number.isFinite(value)) {
    return;
  }
  document.cookie =
    `${INBOX_SPLIT_PANE_PERCENT_COOKIE_NAME}=${encodeURIComponent(value.toFixed(3))}; ` +
    `path=/; max-age=${INBOX_LAYOUT_COOKIE_MAX_AGE}`;
}
