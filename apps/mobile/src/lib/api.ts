import { fetch as nitroFetch, prefetch as nitroPrefetch } from "react-native-nitro-fetch";
import { getAuthCookie, resolveAuthOrigin } from "./auth";
import {
  extractErrorMessageFromBody,
  getUserSafeErrorMessage,
  logClientError,
} from "@kyomi/reader/lib/errors";

export type ApiFetchInit = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  /** An internal Nitro cache key. It is never sent to the API. */
  prefetchKey?: string;
};

function buildMobileApiRequest(path: string, init?: ApiFetchInit) {
  const { prefetchKey, ...requestInit } = init ?? {};
  const headers = new Headers(requestInit.headers);
  const cookie = getAuthCookie();

  headers.set("accept", "application/json");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  if (prefetchKey) {
    headers.set("prefetchKey", prefetchKey);
  }

  return {
    init: {
      ...requestInit,
      credentials: "omit" as const,
      headers,
    },
    url: resolveMobileApiUrl(path),
  };
}

const inFlightPrefetches = new Set<string>();

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
  const request = buildMobileApiRequest(path, init);

  let response: Response;
  try {
    response = await nitroFetch(request.url, request.init);
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

export function prefetchMobileApi(path: string, init?: ApiFetchInit): void {
  const method = init?.method?.toUpperCase() ?? "GET";
  const prefetchKey = init?.prefetchKey;

  if (method !== "GET" || !prefetchKey || inFlightPrefetches.has(prefetchKey)) {
    return;
  }

  const request = buildMobileApiRequest(path, init);
  inFlightPrefetches.add(prefetchKey);

  void nitroPrefetch(request.url, request.init)
    .catch((error) => {
      logClientError("prefetchMobileApi", getUserSafeErrorMessage(error));
    })
    .finally(() => {
      inFlightPrefetches.delete(prefetchKey);
    });
}
