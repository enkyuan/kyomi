const TIMEZONE_OFFSET_COOKIE_NAME = "kyomi_timezone_offset";
const TIMEZONE_OFFSET_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const MAX_TIMEZONE_OFFSET_MINUTES = 24 * 60;

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
    const key = segments[0]?.trim();
    const value = segments[1]?.trim();
    if (!key || value === undefined) {
      continue;
    }
    cookies.set(key, decodeURIComponent(value));
  }

  return cookies;
}

function normalizeTimezoneOffset(value: unknown): number | undefined {
  const offset = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(offset) || Math.abs(offset) > MAX_TIMEZONE_OFFSET_MINUTES) {
    return undefined;
  }
  return Math.trunc(offset);
}

export function readTimezoneOffsetCookie(cookieHeader?: string | null): number | undefined {
  return normalizeTimezoneOffset(parseCookieHeader(cookieHeader).get(TIMEZONE_OFFSET_COOKIE_NAME));
}

export function writeTimezoneOffsetCookie(value: number) {
  if (typeof document === "undefined") {
    return;
  }

  const offset = normalizeTimezoneOffset(value);
  if (offset === undefined) {
    return;
  }

  document.cookie =
    `${TIMEZONE_OFFSET_COOKIE_NAME}=${encodeURIComponent(String(offset))}; ` +
    `path=/; max-age=${TIMEZONE_OFFSET_COOKIE_MAX_AGE}; samesite=lax`;
}
