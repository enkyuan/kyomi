"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as RadixDialog from "@radix-ui/react-dialog";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { anchoredToastManager, toastManager } from "@kyomi/ui/toast";
import { isPlatformModifierShortcut, type PlatformState } from "@hooks/use-platform";
import {
  followFeed,
  importOpmlFromUrl,
  searchFeeds,
  type DiscoverFeedResult,
  type OpmlImportStatus,
} from "@modules/feeds/api";
import {
  getImportedCount,
  getOpmlImportUrlCandidate,
  pollOpmlImportStatus,
} from "@modules/feeds/opml-import";
import {
  markDiscoverFeedSubscribed,
  setDiscoverFeedSubscribed,
} from "@modules/feeds/queries/cache";
import { invalidateFeedAndInboxQueries } from "@modules/inbox/queries/options";
import {
  DISCOVER_RESULTS_UI_CAP,
  SourcesCommand,
  type SourcesCommandState,
} from "./sources-command";

/** Cap list rows so opening the dialog never mounts thousands of command items in one commit. */
const DISCOVER_QUERY_DEBOUNCE_MS = 260;

type FollowFeedMutationInput = {
  anchor?: HTMLElement | null;
  feedId?: string | null;
  url: string;
};

function showFollowedToast(anchor?: HTMLElement | null) {
  if (!anchor?.isConnected) {
    return;
  }

  anchoredToastManager.add({
    title: "Following!",
    type: "success",
    timeout: 1600,
    data: { tooltipStyle: true },
    positionerProps: {
      anchor,
      side: "top",
      align: "center",
      sideOffset: 6,
      positionMethod: "fixed",
    },
  });
}

function formatOpmlImportProgress(status: OpmlImportStatus) {
  const total = status.summary.totalUrls;
  if (total <= 0) {
    return "Preparing feed list.";
  }
  const completed = Math.min(status.summary.completed, total);
  return `${completed} of ${total} feeds imported.`;
}

function formatOpmlImportCompletion(status: OpmlImportStatus) {
  const parts = [
    `${status.summary.subscribed} added`,
    `${status.summary.alreadySubscribed} already followed`,
  ];
  if (status.summary.failed > 0) {
    parts.push(`${status.summary.failed} failed`);
  }
  return parts.join(". ");
}

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
  const [pendingOpmlImportUrl, setPendingOpmlImportUrl] = useState<string | null>(null);
  const pendingFollowKeysRef = useRef<Set<string> | null>(null);
  if (pendingFollowKeysRef.current === null) {
    pendingFollowKeysRef.current = new Set();
  }
  const dialogOpen = open ?? internalOpen;
  const trimmedQuery = query.trim();
  const hasSearchQuery = trimmedQuery.length > 0;
  const opmlImportUrl = getOpmlImportUrlCandidate(trimmedQuery);
  const hasOpmlImportCandidate = Boolean(opmlImportUrl);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DISCOVER_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: discoverData, isFetching: isDiscoverFetching } = useQuery({
    queryKey: ["discover", "feeds", debouncedQuery],
    queryFn: () => searchFeeds({ data: { query: debouncedQuery } }),
    enabled: dialogOpen && debouncedQuery.length > 0 && !hasOpmlImportCandidate,
    placeholderData: (previousData) => previousData,
    retry: 0,
    refetchOnWindowFocus: false,
  });
  const searchResults = hasOpmlImportCandidate ? [] : (discoverData ?? []);
  const cappedSearchResults =
    searchResults.length > DISCOVER_RESULTS_UI_CAP
      ? searchResults.slice(0, DISCOVER_RESULTS_UI_CAP)
      : searchResults;
  const discoverResultsTruncated = searchResults.length > DISCOVER_RESULTS_UI_CAP;
  const isWaitingForDebouncedQuery = hasSearchQuery && debouncedQuery !== trimmedQuery;
  const shouldShowLoading =
    (isDiscoverFetching || isWaitingForDebouncedQuery) && searchResults.length === 0;
  const shouldShowEmpty =
    hasSearchQuery &&
    !hasOpmlImportCandidate &&
    !shouldShowLoading &&
    debouncedQuery.length > 0 &&
    searchResults.length === 0;
  const commandState: SourcesCommandState = hasOpmlImportCandidate
    ? { kind: "opml" }
    : hasSearchQuery
      ? {
          kind: "search",
          results: cappedSearchResults,
          resultsCount: searchResults.length,
          showEmpty: shouldShowEmpty,
          showLoading: shouldShowLoading,
          truncated: discoverResultsTruncated,
        }
      : { kind: "idle" };

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
    mutationFn: ({ feedId, url }: FollowFeedMutationInput) =>
      followFeed({ data: { feedId, url } }),
    onMutate: async ({ feedId, url }) => {
      const followKey = feedId ?? url;
      pendingFollowKeysRef.current?.add(followKey);
      await queryClient.cancelQueries({ queryKey: ["discover", "feeds"] });
      markDiscoverFeedSubscribed(queryClient, { url, feedId: feedId ?? undefined });
      return { feedId: feedId ?? undefined, followKey, url };
    },
    onSuccess: async (result, variables) => {
      showFollowedToast(variables.anchor);
      markDiscoverFeedSubscribed(queryClient, { url: result.url, feedId: result.feedId });
      invalidateFeedAndInboxQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ["folders"],
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
  const { mutate: submitFollowFeed } = followFeedMutation;

  const isPendingFollow = useCallback(
    (item: DiscoverFeedResult) => pendingFollowKeysRef.current?.has(item.id ?? item.url) ?? false,
    [],
  );

  const handleFollowFeed = useCallback(
    (item: DiscoverFeedResult, anchor?: HTMLElement | null) => {
      if (item.isSubscribed || isPendingFollow(item)) {
        return;
      }

      submitFollowFeed({ anchor, feedId: item.id, url: item.url });
    },
    [isPendingFollow, submitFollowFeed],
  );

  const startOpmlImport = useCallback(
    (url: string) => {
      if (pendingOpmlImportUrl) {
        return;
      }

      const toastId =
        typeof globalThis.crypto?.randomUUID === "function"
          ? `opml-import-${globalThis.crypto.randomUUID()}`
          : `opml-import-${Date.now()}`;
      const loadingToast = {
        id: toastId,
        title: "Importing feeds...",
        description: "Starting OPML import.",
        type: "loading",
        timeout: 0,
        data: {
          progress: {
            value: 0,
            max: 1,
            label: "OPML import progress",
          },
        },
      };

      setPendingOpmlImportUrl(url);

      const importPromise = (async () => {
        try {
          const accepted = await importOpmlFromUrl({ data: { url } });
          setDialogOpen(false);

          const finalStatus = await pollOpmlImportStatus(accepted.taskId, {
            onStatus: (status) => {
              toastManager.update(toastId, {
                title: "Importing feeds...",
                description: formatOpmlImportProgress(status),
                type: "loading",
                timeout: 0,
                data: {
                  progress: {
                    value: status.summary.completed,
                    max: Math.max(status.summary.totalUrls, 1),
                    label: "OPML import progress",
                  },
                },
              });
            },
          });

          if (finalStatus.status === "failed") {
            throw new Error(finalStatus.message ?? "OPML import failed.");
          }
          if (finalStatus.status === "cancelled") {
            throw new Error("OPML import was cancelled.");
          }

          invalidateFeedAndInboxQueries(queryClient);
          await queryClient.invalidateQueries({ queryKey: ["folders"] });

          return finalStatus;
        } finally {
          setPendingOpmlImportUrl(null);
        }
      })();

      void toastManager
        .promise(importPromise, {
          loading: loadingToast,
          success: (status) => ({
            title: `Imported ${getImportedCount(status)} of ${status.summary.totalUrls} feeds`,
            description: formatOpmlImportCompletion(status),
            type: "success",
            timeout: 3000,
            data: undefined,
          }),
          error: (error) => {
            logClientError("feeds.opml_import", error);
            return {
              title: "Unable to import feeds",
              description: getUserSafeErrorMessage(error, "Try another OPML URL."),
              type: "error",
              timeout: 7000,
              data: undefined,
            };
          },
        })
        .catch(() => undefined);
    },
    [pendingOpmlImportUrl, queryClient, setDialogOpen],
  );

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
            Search feeds, paste a feed URL to follow it, or paste an OPML URL to import feeds.
          </RadixDialog.Description>
          <SourcesCommand
            isPendingFollow={isPendingFollow}
            opmlImportUrl={opmlImportUrl}
            pendingOpmlImportUrl={pendingOpmlImportUrl}
            query={query}
            state={commandState}
            onFollowFeed={handleFollowFeed}
            onQueryChange={setQuery}
            onStartOpmlImport={startOpmlImport}
          />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
