import { authClient } from "./auth";

export function useSessionGate() {
  const { data, isPending } = authClient.useSession();

  return {
    isAuthenticated: Boolean((data as { session?: unknown } | null | undefined)?.session),
    isPending,
  };
}
