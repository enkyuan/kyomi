import { readCookie } from "@lib/cookies";

const TIMEZONE_OFFSET_COOKIE_NAME = "kyomi_timezone_offset";
const TIMEZONE_OFFSET_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const MAX_TIMEZONE_OFFSET_MINUTES = 24 * 60;

function normalizeTimezoneOffset(value: unknown): number | undefined {
  const offset = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(offset) || Math.abs(offset) > MAX_TIMEZONE_OFFSET_MINUTES) {
    return undefined;
  }
  return Math.trunc(offset);
}

export function readTimezoneOffsetCookie(cookieHeader?: string | null): number | undefined {
  return normalizeTimezoneOffset(readCookie(cookieHeader, TIMEZONE_OFFSET_COOKIE_NAME));
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
