export const DEFAULT_AUTH_RETURN_TO = "/inbox";

const AUTH_RETURN_TO_ORIGIN = "https://kyomi.invalid";

export type AuthSearch = {
  redirect?: string;
};

export function parseAuthReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\")) {
    return undefined;
  }

  try {
    const url = new URL(value, AUTH_RETURN_TO_ORIGIN);
    if (url.origin !== AUTH_RETURN_TO_ORIGIN) {
      return undefined;
    }
    if (url.pathname !== "/inbox" && !url.pathname.startsWith("/inbox/")) {
      return undefined;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export function resolveAuthReturnTo(value: unknown) {
  return parseAuthReturnTo(value) ?? DEFAULT_AUTH_RETURN_TO;
}

export function preserveAuthEntryHash(value: unknown, entryHash: unknown) {
  const target = parseAuthReturnTo(value);
  if (!target || typeof entryHash !== "string" || !entryHash.startsWith("#") || entryHash === "#") {
    return target;
  }

  const url = new URL(target, AUTH_RETURN_TO_ORIGIN);
  if (!url.hash) {
    url.hash = entryHash;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildAuthEntryHref(path: "/" | "/register", returnTo: unknown) {
  const parsed = parseAuthReturnTo(returnTo);
  return parsed ? `${path}?redirect=${encodeURIComponent(parsed)}` : path;
}

export function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return { redirect: parseAuthReturnTo(search.redirect) };
}
