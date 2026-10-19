import { useQuery } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";

type SubscribedFeedsResponse = {
  items: unknown[];
};

export const subscribedFeedsQueryKey = ["feeds", "subscribed"] as const;

export function useSubscribedFeeds(enabled = true) {
  const query = useQuery({
    enabled,
    queryKey: subscribedFeedsQueryKey,
    queryFn: () => fetchMobileApiJson<SubscribedFeedsResponse>("/api/v1/feeds"),
  });

  return {
    count: query.data?.items.length ?? 0,
    isError: query.isError,
    isLoading: query.isPending,
  };
}
