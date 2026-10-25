import { useQuery } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import type { UserPreferencesDto } from "@kyomi/reader/schemas";

type ReaderPreferences = Pick<UserPreferencesDto, "rememberPosition">;

/** The reader preferences the mobile reader reads, from the same endpoint the web settings use. */
export function useReaderPreferences() {
  const query = useQuery({
    queryFn: ({ signal }) =>
      fetchMobileApiJson<ReaderPreferences>("/api/v1/me/preferences", { signal }),
    queryKey: ["me", "preferences"],
    // A failed request must not hold the article back; the API default (on) applies.
    retry: false,
  });

  return {
    /** Whether the preferences are known, or can no longer be waited for. */
    isSettled: query.status !== "pending" || query.fetchStatus === "paused",
    rememberPosition: query.data?.rememberPosition ?? true,
  };
}
