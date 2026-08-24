import { getAuthCookie, resolveAuthOrigin } from "./auth";
import {
  extractErrorMessageFromBody,
  getUserSafeErrorMessage,
  logClientError,
} from "@kyomi/reader/lib/errors";

type ApiFetchInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
};

export class MobileApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "MobileApiError";
    this.status = status;
    this.body = body;
  }
}

export function resolveMobileApiUrl(path: string): string {
  if (!path.startsWith("/api/")) {
    throw new Error("Mobile API paths must begin with /api/.");
  }

  return new URL(path, resolveAuthOrigin()).toString();
}

export function mobileApiErrorMessage(error: unknown): string {
  return getUserSafeErrorMessage(error, "Something went wrong. Try again.");
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
  } catch (error) {
    throw new MobileApiError(0, null, `Network error: ${getUserSafeErrorMessage(error)}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const summary = (body ? extractErrorMessageFromBody(body) : null) ?? response.statusText;
    logClientError("fetchMobileApiJson", `HTTP ${response.status}: ${summary}`);
    throw new MobileApiError(response.status, body || null, summary);
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new MobileApiError(
      response.status,
      null,
      `Invalid JSON response: ${getUserSafeErrorMessage(error)}`,
    );
  }
}
