import { getAuthCookie } from "./auth-client";
import { resolveAuthOrigin } from "./auth-origin";

type ApiFetchInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

export class MobileApiError extends Error {
  constructor() {
    super("Request failed.");
    this.name = "MobileApiError";
  }
}

export function resolveMobileApiUrl(path: string): string {
  if (!path.startsWith("/api/")) {
    throw new Error("Mobile API paths must begin with /api/.");
  }

  return new URL(path, resolveAuthOrigin()).toString();
}

export async function fetchMobileApiJson<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const cookie = getAuthCookie();

  headers.set("accept", "application/json");
  if (cookie) {
    headers.set("cookie", cookie);
  }

  let response: Response;
  try {
    response = await fetch(resolveMobileApiUrl(path), {
      ...init,
      credentials: "omit",
      headers,
    });
  } catch {
    throw new MobileApiError();
  }

  if (!response.ok) {
    throw new MobileApiError();
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new MobileApiError();
  }
}
