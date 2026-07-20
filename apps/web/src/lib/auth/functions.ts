import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  apiFailureUserMessage,
  apiJson,
  buildForwardHeaders,
  logApiNetworkError,
  logApiResponseError,
  resolveApiUrl,
} from "@lib/api";
import { formatErrorForLog, readResponseErrorSummary } from "@lib/errors";
import {
  classifyAuthSessionPayload,
  type AuthSessionState,
  unavailableAuthSessionState,
} from "@lib/auth/session";

export type { AuthSession } from "@lib/auth/session";

async function fetchAuthSessionStateFromHeaders(headers: Headers): Promise<AuthSessionState> {
  const method = "GET";
  const path = "/api/auth/get-session";
  let response: Response;

  try {
    response = await fetch(resolveApiUrl(path), {
      method,
      headers: buildForwardHeaders(headers),
    });
  } catch (error) {
    logApiNetworkError(method, path, error);
    return unavailableAuthSessionState();
  }

  if (response.status === 401) {
    return { status: "anonymous", session: null };
  }

  if (!response.ok) {
    const summary = await readResponseErrorSummary(response);
    logApiResponseError(method, path, response.status, summary);
    return unavailableAuthSessionState(apiFailureUserMessage(response.status));
  }

  try {
    return classifyAuthSessionPayload(await response.json());
  } catch (error) {
    console.error(`[api] ${method} ${path} -> invalid JSON: ${formatErrorForLog(error)}`);
    return unavailableAuthSessionState("Received an invalid response from the server.");
  }
}

export const getAuthSessionState = createServerFn({ method: "POST" }).handler(async () => {
  const headers = getRequestHeaders();
  return fetchAuthSessionStateFromHeaders(headers);
});

export const updateUserEmail = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const headers = buildForwardHeaders(getRequestHeaders());
    headers.set("content-type", "application/json");
    const normalizedEmail = data.email.trim();

    return apiJson<{
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      image: string | null;
      createdAt: string;
      updatedAt: string;
    }>("/api/v1/users/profile/email", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: normalizedEmail }),
    });
  });
