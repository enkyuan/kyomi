import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mobileApiErrorMessage } from "@/lib/api";
import type { TabBarComposerProps } from "@ui/tab-bar/lib/types";
import { articleListQueryKeys } from "@modules/articles/queries/keys";
import { normalizeFeedUrl } from "../lib/url";
import { followFeed, listFolders, previewFeed, searchFeeds, type DiscoveredFeed } from "../lib/api";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;
const foldersQueryKey = ["feeds", "folders"] as const;

type ComposerProps = TabBarComposerProps;

function toComposerFeed(feed: DiscoveredFeed): TabBarComposerProps["feeds"][number] {
  return {
    detail: feed.description ?? feed.link ?? undefined,
    faviconUrl: feed.faviconUrl ?? undefined,
    feedId: feed.id ?? undefined,
    id: feed.id ?? feed.url,
    isSubscribed: feed.isSubscribed,
    title: feed.title,
    url: feed.url,
  };
}

/**
 * Backs the tab bar's add composer: a typed address previews that feed to import; other text
 * searches feeds to follow. The native card owns the text and the selection and reports both back
 * with the submit; this owns the requests.
 */
export function useComposer() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const feedUrl = normalizeFeedUrl(debounced);
  const kind = feedUrl ? "import" : "follow";
  const enabled = active && (feedUrl !== null || debounced.length >= MIN_SEARCH_LENGTH);

  const discovery = useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<DiscoveredFeed[]> =>
      feedUrl ? [await previewFeed(feedUrl, signal)] : searchFeeds(debounced, signal),
    queryKey: ["feeds", "discover", kind, feedUrl ?? debounced],
    retry: false,
    staleTime: 30_000,
  });
  const folders = useQuery({ enabled: active, queryFn: listFolders, queryKey: foldersQueryKey });

  const follow = useMutation({
    mutationFn: followFeed,
    onSuccess: () => {
      for (const key of articleListQueryKeys) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const handleActiveChange = useCallback(
    (next: boolean) => {
      setActive(next);
      if (!next) {
        setQuery("");
        follow.reset();
      }
    },
    [follow],
  );
  const handleSubmit = useCallback(
    (input: { feedId?: string; url: string; folderId?: string }) => {
      const url = normalizeFeedUrl(input.url);
      if (url) follow.mutate({ ...input, url });
    },
    [follow],
  );

  return useMemo<ComposerProps>(() => {
    const status = follow.isPending
      ? "submitting"
      : follow.isSuccess
        ? "done"
        : follow.isError || (enabled && discovery.isError && !discovery.isFetching)
          ? "failed"
          : enabled && discovery.isFetching
            ? "loading"
            : "idle";
    const message = follow.isError
      ? mobileApiErrorMessage(follow.error)
      : feedUrl && discovery.isError
        ? "Couldn't preview this feed. Import it to try anyway."
        : enabled && !discovery.isFetching && discovery.data?.length === 0
          ? "No feeds found."
          : null;

    return {
      feeds: enabled ? (discovery.data ?? []).map(toComposerFeed) : [],
      folders: folders.data ?? [],
      kind,
      message,
      onActiveChange: handleActiveChange,
      onQueryChange: setQuery,
      onSubmit: handleSubmit,
      status,
    };
  }, [
    discovery.data,
    discovery.isError,
    discovery.isFetching,
    enabled,
    feedUrl,
    folders.data,
    follow.error,
    follow.isError,
    follow.isPending,
    follow.isSuccess,
    handleActiveChange,
    handleSubmit,
    kind,
  ]);
}
