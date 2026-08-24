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
import { formatErrorForLog, readResponseErrorSummary } from "@kyomi/reader/lib/errors";
import {
  AUTH_CAPABILITIES_HEADER,
  DEFAULT_AUTH_CAPABILITIES,
  parseAuthCapabilities,
  type AuthCapabilities,
} from "@lib/auth/capabilities";
import {
  classifyAuthSessionPayload,
  type AuthSessionState,
  unavailableAuthSessionState,
} from "@lib/auth/session";

export type { AuthSession } from "@lib/auth/session";

export type AuthBootstrapState = {
  authState: AuthSessionState;
  authCapabilities: AuthCapabilities;
};

async function fetchAuthBootstrapStateFromHeaders(headers: Headers): Promise<AuthBootstrapState> {
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
    return {
      authState: unavailableAuthSessionState(),
      authCapabilities: DEFAULT_AUTH_CAPABILITIES,
    };
  }

  const authCapabilities = parseAuthCapabilities(response.headers.get(AUTH_CAPABILITIES_HEADER));

  if (response.status === 401) {
    return { authState: { status: "anonymous", session: null }, authCapabilities };
  }

  if (!response.ok) {
    const summary = await readResponseErrorSummary(response);
    logApiResponseError(method, path, response.status, summary);
    return {
      authState: unavailableAuthSessionState(apiFailureUserMessage(response.status)),
      authCapabilities,
    };
  }

  try {
    return {
      authState: classifyAuthSessionPayload(await response.json()),
      authCapabilities,
    };
  } catch (error) {
    console.error(`[api] ${method} ${path} -> invalid JSON: ${formatErrorForLog(error)}`);
    return {
      authState: unavailableAuthSessionState("Received an invalid response from the server."),
      authCapabilities,
    };
  }
}

export const getAuthBootstrapState = createServerFn({ method: "POST" }).handler(async () => {
  const headers = getRequestHeaders();
  return fetchAuthBootstrapStateFromHeaders(headers);
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
