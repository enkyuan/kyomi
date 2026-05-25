import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { apiJson, buildForwardHeaders, resolveApiUrl } from "@lib/api";

export type AuthSession = {
  session: {
    id: string;
    expiresAt: string;
    token: string;
    createdAt: string;
    updatedAt: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    userId: string;
  } | null;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
} | null;

async function fetchSessionFromHeaders(headers: Headers): Promise<AuthSession> {
  const response = await fetch(resolveApiUrl("/api/auth/get-session"), {
    method: "GET",
    headers: buildForwardHeaders(headers),
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Unable to fetch session: ${response.status}`);
  }

  return (await response.json()) as AuthSession;
}

export const getSession = createServerFn({ method: "POST" }).handler(async () => {
  const headers = getRequestHeaders();
  return fetchSessionFromHeaders(headers);
});

export const updateUserEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => input)
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
