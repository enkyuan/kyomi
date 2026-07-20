export const DEFAULT_AUTH_RETURN_TO = "/inbox";

const AUTH_RETURN_TO_ORIGIN = "https://kyomi.invalid";

export type AuthSearch = {
  redirect?: string;
  authError?: "oauth";
};

export type ResetPasswordSearch = AuthSearch & {
  token?: string;
  resetError?: boolean;
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

export function buildAuthEntryHref(
  path: "/" | "/register" | "/forgot-password" | "/reset-password",
  returnTo: unknown,
) {
  const parsed = parseAuthReturnTo(returnTo);
  return parsed ? `${path}?redirect=${encodeURIComponent(parsed)}` : path;
}

export function buildOAuthErrorHref(returnTo: unknown, path: "/" | "/register" = "/") {
  const parsed = parseAuthReturnTo(returnTo);
  const search = new URLSearchParams({ authError: "oauth" });
  if (parsed) {
    search.set("redirect", parsed);
  }
  return `${path}?${search.toString()}`;
}

export function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return {
    redirect: parseAuthReturnTo(search.redirect),
    authError: search.authError === "oauth" ? "oauth" : undefined,
  };
}

export function validateResetPasswordSearch(search: Record<string, unknown>): ResetPasswordSearch {
  const token =
    typeof search.token === "string" && search.token.length > 0 && search.token.length <= 4096
      ? search.token
      : undefined;
  return {
    ...validateAuthSearch(search),
    token,
    resetError: typeof search.error === "string" && search.error.length > 0 ? true : undefined,
  };
}
