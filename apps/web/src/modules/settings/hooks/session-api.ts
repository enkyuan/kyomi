import { readResponseErrorSummary, getUserSafeErrorMessage } from "@lib/errors";
import { authSessionListSchema } from "@lib/schemas";
import type { SessionRow } from "./session-types";

export function parseSessionsResponse(value: unknown): SessionRow[] {
  return authSessionListSchema.parse(value).map((session) => ({
    ...session,
    isCurrent: false,
  }));
}

export function parseApiErrorMessage(
  error: unknown,
  fallback = "Request failed. Try again.",
): string {
  return getUserSafeErrorMessage(error, fallback);
}

export function authSessionsQueryKey() {
  return ["auth", "sessions"] as const;
}

export async function postAuthSessionAction(path: string, body?: Record<string, string>) {
  const response = await fetch(path, {
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readResponseErrorSummary(response));
  }

  const data = (await response.json()) as { status?: boolean };
  if (!data.status) {
    throw new Error("Session action was not confirmed.");
  }
}
