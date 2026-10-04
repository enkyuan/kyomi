import { useQuery } from "@tanstack/react-query";
import { resolveAuthOrigin } from "@/lib/auth";
import { fetchMobile } from "@/lib/mobile-fetch";
import { AUTH_CAPABILITIES_HEADER, parseAuthCapabilities } from "../lib/capabilities";

export const authCapabilitiesQueryKey = ["auth", "capabilities"] as const;

async function fetchAuthCapabilities(signal: AbortSignal) {
  const response = await fetchMobile(`${resolveAuthOrigin()}/api/auth/ok`, {
    credentials: "omit",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Auth capabilities request failed with ${response.status}`);
  }
  return parseAuthCapabilities(response.headers.get(AUTH_CAPABILITIES_HEADER));
}

export function useAuthCapabilities({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    enabled,
    queryFn: ({ signal }) => fetchAuthCapabilities(signal),
    queryKey: authCapabilitiesQueryKey,
  });
}
