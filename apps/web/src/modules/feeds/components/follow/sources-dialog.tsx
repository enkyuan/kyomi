"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddCircleFill, CheckCircleFill, RssFill, SearchLine } from "@mingcute/react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { Kbd } from "@kyomi/ui/kbd";
import { toastManager } from "@kyomi/ui/toast";
import { isPlatformModifierShortcut, type PlatformState } from "@hooks/use-platform";
import { followFeed, searchFeeds } from "@modules/feeds/api";
import {
  markDiscoverFeedSubscribed,
  setDiscoverFeedSubscribed,
} from "@modules/feeds/queries/cache";
import { invalidateFeedAndInboxQueries } from "@modules/inbox/queries/options";

/** Cap list rows so opening the dialog never mounts thousands of command items in one commit. */
const DISCOVER_RESULTS_UI_CAP = 200;
const DISCOVER_QUERY_DEBOUNCE_MS = 260;

type FollowFeedMutationInput = {
  feedId?: string | null;
  url: string;
};

type SourcesDialogProps = {
  platform: PlatformState;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  enableGlobalShortcut?: boolean;
};

export function SourcesDialog({
  platform,
  open,
  onOpenChange,
  enableGlobalShortcut = true,
}: SourcesDialogProps) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const pendingFollowKeysRef = useRef<Set<string> | null>(null);
  if (pendingFollowKeysRef.current === null) {
    pendingFollowKeysRef.current = new Set();
  }
  const dialogOpen = open ?? internalOpen;
  const trimmedQuery = query.trim();
  const hasSearchQuery = trimmedQuery.length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DISCOVER_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: discoverData, isFetching: isDiscoverFetching } = useQuery({
    queryKey: ["discover", "feeds", debouncedQuery],
    queryFn: () => searchFeeds({ data: { query: debouncedQuery } }),
    enabled: dialogOpen && debouncedQuery.length > 0,
    placeholderData: (previousData) => previousData,
    retry: 0,
    refetchOnWindowFocus: false,
  });
  const searchResults = discoverData ?? [];
  const cappedSearchResults =
    searchResults.length > DISCOVER_RESULTS_UI_CAP
      ? searchResults.slice(0, DISCOVER_RESULTS_UI_CAP)
      : searchResults;
  const discoverResultsTruncated = searchResults.length > DISCOVER_RESULTS_UI_CAP;
  const isWaitingForDebouncedQuery = hasSearchQuery && debouncedQuery !== trimmedQuery;
  const shouldShowLoading =
    (isDiscoverFetching || isWaitingForDebouncedQuery) && searchResults.length === 0;
  const shouldShowEmpty =
    hasSearchQuery && !shouldShowLoading && debouncedQuery.length > 0 && searchResults.length === 0;

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setQuery("");
        setDebouncedQuery("");
      }
      const commit = () => {
        if (open === undefined) {
          setInternalOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
      };
      // Opening mounts the command dialog subtree; keep close synchronous so Escape dismiss feels
      // immediate.
      if (nextOpen) {
        startTransition(commit);
      } else {
        commit();
      }
    },
    [open, onOpenChange],
  );

  const followFeedMutation = useMutation({
    mutationFn: (input: FollowFeedMutationInput) => followFeed({ data: input }),
    onMutate: async ({ feedId, url }) => {
      const followKey = feedId ?? url;
      pendingFollowKeysRef.current?.add(followKey);
      await queryClient.cancelQueries({ queryKey: ["discover", "feeds"] });
      markDiscoverFeedSubscribed(queryClient, { url, feedId: feedId ?? undefined });
      return { feedId: feedId ?? undefined, followKey, url };
    },
    onSuccess: async (result) => {
      markDiscoverFeedSubscribed(queryClient, { url: result.url, feedId: result.feedId });
      invalidateFeedAndInboxQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ["folders"],
      });
      toastManager.add({
        title: result.newSubscription ? "Feed followed" : "Already following",
        description: result.title || result.url,
        type: "success",
      });
    },
    onError: (error, _variables, context) => {
      if (context) {
        setDiscoverFeedSubscribed(queryClient, context, false);
      }
      logClientError("feeds.follow", error);
      toastManager.add({
        title: "Unable to follow feed",
        description: getUserSafeErrorMessage(error, "Try another topic or feed URL."),
        type: "error",
      });
    },
    onSettled: (_result, _error, _variables, context) => {
      if (!context?.followKey) {
        return;
      }
      pendingFollowKeysRef.current?.delete(context.followKey);
    },
  });

  useEffect(() => {
    if (!enableGlobalShortcut) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        !isPlatformModifierShortcut(event, platform) ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      setDialogOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-doctor/prefer-use-effect-event
  }, [enableGlobalShortcut, platform, setDialogOpen]);

  return (
    <RadixDialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="kyomi-feed-command-overlay" />
        <RadixDialog.Content
          aria-describedby="kyomi-feed-command-description"
          className="kyomi-feed-command-dialog"
        >
          <RadixDialog.Title className="sr-only">Add feed</RadixDialog.Title>
          <RadixDialog.Description id="kyomi-feed-command-description" className="sr-only">
            Search feeds or paste a feed URL to follow it.
          </RadixDialog.Description>
          <Command
            className="kyomi-feed-command"
            data-has-search-query={hasSearchQuery ? "true" : undefined}
            label="Add feed"
            shouldFilter={false}
          >
            <div className="kyomi-feed-command-search">
              <SearchLine className="kyomi-feed-command-search-icon" />
              <Command.Input
                placeholder="Search feeds or paste a feed URL..."
                value={query}
                onValueChange={setQuery}
              />
            </div>
            {hasSearchQuery ? (
              <>
                <Command.List>
                  <div className="kyomi-feed-command-list-inner">
                    {shouldShowEmpty ? (
                      <Command.Empty>
                        No feeds found yet. Try a broader topic or paste a feed URL.
                      </Command.Empty>
                    ) : null}
                    {shouldShowLoading ? (
                      <Command.Group heading="Feeds">
                        <Command.Item disabled value="searching">
                          <RssFill className="kyomi-feed-command-item-icon" />
                          <span>Searching feeds...</span>
                        </Command.Item>
                      </Command.Group>
                    ) : null}
                    {searchResults.length ? (
                      <Command.Group heading="Feeds">
                        {cappedSearchResults.map((item) => (
                          <Command.Item
                            key={`${item.id ?? item.url}-${item.url}`}
                            value={`${item.title} ${item.url} ${item.description ?? ""}`}
                            onSelect={() => {
                              const followKey = item.id ?? item.url;
                              if (
                                item.isSubscribed ||
                                pendingFollowKeysRef.current?.has(followKey)
                              ) {
                                return;
                              }

                              followFeedMutation.mutate({ feedId: item.id, url: item.url });
                            }}
                          >
                            <span className="kyomi-feed-command-favicon">
                              <FeedFavicon
                                className="kyomi-feed-command-favicon-media"
                                faviconUrl={item.faviconUrl}
                                feedUrl={item.url}
                                shape="squircle"
                                siteUrl={item.link}
                                squircleCornerRadius={6}
                                title={item.title}
                              />
                            </span>
                            <div className="kyomi-feed-command-item-copy">
                              <p>{item.title || item.url}</p>
                              <p>{item.description || item.url}</p>
                            </div>
                            <span
                              aria-label={item.isSubscribed ? "Following" : "Add feed"}
                              className="kyomi-feed-command-item-action"
                              title={item.isSubscribed ? "Following" : "Add feed"}
                            >
                              {item.isSubscribed ? <CheckCircleFill /> : <AddCircleFill />}
                            </span>
                          </Command.Item>
                        ))}
                        {discoverResultsTruncated ? (
                          <Command.Item disabled value="discover-truncated-hint">
                            <span className="kyomi-feed-command-hint">
                              Showing first {DISCOVER_RESULTS_UI_CAP} results, refine your search to
                              narrow matches.
                            </span>
                          </Command.Item>
                        ) : null}
                      </Command.Group>
                    ) : null}
                  </div>
                </Command.List>
                <div className="kyomi-feed-command-footer">
                  <span>Search by topic or paste a feed URL to follow it.</span>
                  <Kbd className="px-1.5 text-[10px] leading-none">Esc</Kbd>
                </div>
              </>
            ) : null}
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
