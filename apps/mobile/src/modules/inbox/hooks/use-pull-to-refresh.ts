import { useCallback, useState } from "react";

/**
 * The pull-to-refresh spinner belongs to the user's pull. A refetch the app starts itself (on
 * open, when data goes stale) updates the list quietly, so the spinner follows this state rather
 * than the query's `isRefetching`.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  return { onRefresh, refreshing };
}
