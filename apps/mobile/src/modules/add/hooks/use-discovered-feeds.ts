import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchMobileApiJson } from "@/lib/api-client";

const DISCOVER_DEBOUNCE_MS = 260;
const DISCOVER_RESULT_LIMIT = 50;
const discoverFeedsQueryKey = (query: string) => ["discover", "feeds", query] as const;

export type DiscoveredFeed = {
  readonly id: string | null;
  readonly url: string;
  readonly title: string;
  readonly description: string | null;
  readonly link: string | null;
  readonly faviconUrl: string | null;
  readonly isSubscribed: boolean;
};

function normalizeUrlCandidate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname || (!parsed.hostname.includes(".") && parsed.hostname !== "localhost")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

async function discoverFeeds(query: string): Promise<DiscoveredFeed[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const normalizedUrl = normalizeUrlCandidate(trimmedQuery);
  if (normalizedUrl) {
    try {
      const preview = await fetchMobileApiJson<DiscoveredFeed>(
        `/api/v1/discover/preview?url=${encodeURIComponent(normalizedUrl)}`,
      );
      return [preview];
    } catch {
      return [
        {
          id: null,
          url: normalizedUrl,
          title: normalizedUrl,
          description: "Couldn't preview this feed. Follow it to try adding it directly.",
          link: normalizedUrl,
          faviconUrl: null,
          isSubscribed: false,
        },
      ];
    }
  }

  if (trimmedQuery.length < 2) {
    return [];
  }

  try {
    return await fetchMobileApiJson<DiscoveredFeed[]>(
      `/api/v1/discover/search?q=${encodeURIComponent(trimmedQuery)}&limit=${DISCOVER_RESULT_LIMIT}`,
    );
  } catch {
    return [];
  }
}

type FollowFeedInput = Pick<DiscoveredFeed, "id" | "url">;

async function followFeed({ id, url }: FollowFeedInput) {
  if (id) {
    return fetchMobileApiJson<{ feedId: string }>(
      `/api/v1/feeds/${encodeURIComponent(id)}/subscribe`,
      {
        method: "POST",
      },
    );
  }

  return fetchMobileApiJson<{ feedId: string }>("/api/v1/feeds", {
    body: JSON.stringify({ url }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export function useDiscoveredFeeds(query: string) {
  const debouncedQuery = useDebouncedValue(query, DISCOVER_DEBOUNCE_MS);
  const normalizedQuery = debouncedQuery.trim();
  const queryKey = discoverFeedsQueryKey(normalizedQuery);
  const isSearchable = Boolean(normalizedQuery);
  const queryState = useQuery({
    enabled: isSearchable,
    placeholderData: (previousData) => previousData,
    queryFn: () => discoverFeeds(normalizedQuery),
    queryKey,
    retry: false,
  });

  return {
    items: queryState.data ?? [],
    isLoading: isSearchable && (queryState.isPending || queryState.isFetching),
    isSearching: query !== debouncedQuery,
  };
}

export function useFollowDiscoveredFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: followFeed,
    onSuccess: (_result, item) => {
      queryClient.setQueriesData<DiscoveredFeed[]>({ queryKey: ["discover", "feeds"] }, (items) =>
        items?.map((current) =>
          current.url === item.url ? { ...current, isSubscribed: true } : current,
        ),
      );
    },
  });
}
