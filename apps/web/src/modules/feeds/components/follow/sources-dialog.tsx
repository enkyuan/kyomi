"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RssFill } from "@mingcute/react";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from "@vols.rss/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@vols.rss/ui/input-group";
import { Kbd, KbdGroup } from "@vols.rss/ui/kbd";
import { SidebarModeAnimatedText } from "@vols.rss/ui/sidebar-mode-animated-text";
import { SidebarMenuButton } from "@vols.rss/ui/sidebar";
import { toastManager } from "@vols.rss/ui/toast";
import { isPlatformModifierShortcut, type PlatformState } from "@hooks/use-platform";
import { followFeed, searchFeeds } from "@modules/feeds/api";
import {
  getDiscoverFeedsSnapshot,
  markDiscoverFeedSubscribed,
  restoreDiscoverFeedsSnapshot,
} from "@modules/feeds/queries/cache";
import { invalidateFeedAndInboxQueries } from "@modules/inbox/queries/options";

/** Cap list rows so opening the dialog never mounts thousands of command items in one commit. */
const DISCOVER_RESULTS_UI_CAP = 200;
const DISCOVER_QUERY_DEBOUNCE_MS = 260;

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
  hideTrigger = false,
  enableGlobalShortcut = true,
}: SourcesDialogProps) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const dialogOpen = open ?? internalOpen;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DISCOVER_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const discoverResultsQuery = useQuery({
    queryKey: ["discover", "feeds", debouncedQuery],
    queryFn: () => searchFeeds({ data: { query: debouncedQuery } }),
    enabled: dialogOpen && debouncedQuery.length > 0,
    placeholderData: (previousData) => previousData,
    retry: 0,
    refetchOnWindowFocus: false,
  });
  const searchResults = discoverResultsQuery.data ?? [];
  const cappedSearchResults =
    searchResults.length > DISCOVER_RESULTS_UI_CAP
      ? searchResults.slice(0, DISCOVER_RESULTS_UI_CAP)
      : searchResults;
  const discoverResultsTruncated = searchResults.length > DISCOVER_RESULTS_UI_CAP;
  const shouldShowLoading = discoverResultsQuery.isFetching && searchResults.length === 0;
  const shouldShowEmpty =
    !shouldShowLoading && (debouncedQuery.length === 0 || searchResults.length === 0);

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
      // Opening mounts a large Base UI dialog + autocomplete subtree; keep close synchronous
      // so Escape dismiss feels immediate.
      if (nextOpen) {
        startTransition(commit);
      } else {
        commit();
      }
    },
    [open, onOpenChange],
  );

  const followFeedMutation = useMutation({
    mutationFn: ({ url }: { url: string }) => followFeed({ data: { url } }),
    onMutate: async ({ url }) => {
      await queryClient.cancelQueries({ queryKey: ["discover", "feeds"] });
      const snapshot = getDiscoverFeedsSnapshot(queryClient);
      markDiscoverFeedSubscribed(queryClient, { url });
      return { snapshot };
    },
    onSuccess: async (result) => {
      markDiscoverFeedSubscribed(queryClient, { url: result.url, feedId: result.feedId });
      invalidateFeedAndInboxQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: ["folders"],
      });
      setDialogOpen(false);
      setQuery("");
      toastManager.add({
        title: result.newSubscription ? "Feed followed" : "Already following",
        description: result.title || result.url,
        type: "success",
      });
    },
    onError: (error, _variables, context) => {
      restoreDiscoverFeedsSnapshot(queryClient, context?.snapshot);
      toastManager.add({
        title: "Unable to follow feed",
        description: error instanceof Error ? error.message : "Try another topic or feed URL.",
        type: "error",
      });
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
    <CommandDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger ? (
        <CommandDialogTrigger
          render={
            <SidebarMenuButton className="mt-1 items-stretch overflow-visible rounded-xl p-0 shadow-none transition-shadow duration-150 ease-out hover:bg-transparent active:bg-transparent data-[active=true]:bg-transparent focus-visible:ring-0 focus-within:shadow-[0_0_0_2px_var(--sidebar-ring)] group-data-[reader-focus-sidebar=true]/sidebar-wrapper:gap-0 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:px-0">
              <InputGroup className="h-full min-h-0 w-full rounded-xl border-sidebar-border/70 bg-sidebar-accent/40 shadow-none outline-none ring-0 ring-transparent ring-offset-0 before:hidden transition-[background-color,border-color] hover:bg-sidebar-accent/56 has-[input:focus-visible,textarea:focus-visible]:border-sidebar-border/70 has-[input:focus-visible,textarea:focus-visible]:shadow-none has-[input:focus-visible,textarea:focus-visible]:ring-0! has-[input:focus-visible,textarea:focus-visible]:ring-transparent! dark:has-[input:focus-visible,textarea:focus-visible]:ring-0!">
                <InputGroupInput
                  aria-label="Discover"
                  size="sm"
                  className="cursor-text text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/56 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-base group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-6"
                  placeholder="Follow sources"
                  readOnly
                  type="search"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="ms-auto h-full items-center self-stretch has-[>kbd:last-child]:me-0"
                >
                  <KbdGroup className="-me-0.5">
                    <Kbd className="bg-sidebar-foreground/6 text-sidebar-foreground/60 shadow-none group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-5">
                      <SidebarModeAnimatedText>{platform.modifierKeyLabel}</SidebarModeAnimatedText>
                    </Kbd>
                    <Kbd className="bg-sidebar-foreground/6 text-sidebar-foreground/60 shadow-none group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-sm group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-5">
                      <SidebarModeAnimatedText>K</SidebarModeAnimatedText>
                    </Kbd>
                  </KbdGroup>
                </InputGroupAddon>
              </InputGroup>
            </SidebarMenuButton>
          }
        />
      ) : null}
      <CommandDialogPopup>
        <Command>
          <CommandInput
            placeholder="Search feeds or paste a feed URL…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <CommandPanel>
            <CommandList>
              {shouldShowEmpty ? (
                <CommandEmpty>
                  {debouncedQuery
                    ? "No feeds found yet. Try a broader topic or paste a feed URL."
                    : "Search by topic or paste an RSS, Atom, or site feed URL."}
                </CommandEmpty>
              ) : null}
              {shouldShowLoading ? (
                <CommandGroup>
                  <CommandGroupLabel>Feeds</CommandGroupLabel>
                  <CommandItem disabled value="searching">
                    <RssFill className="me-2 size-4 shrink-0" />
                    <span>Searching feeds…</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              {searchResults.length ? (
                <CommandGroup>
                  <CommandGroupLabel>Feeds</CommandGroupLabel>
                  {cappedSearchResults.map((item) => (
                    <CommandItem
                      key={`${item.id ?? item.url}-${item.url}`}
                      value={`${item.title} ${item.url} ${item.description ?? ""}`}
                      onClick={() => {
                        if (item.isSubscribed || followFeedMutation.isPending) {
                          return;
                        }

                        followFeedMutation.mutate({ url: item.url });
                      }}
                    >
                      <span className="me-2 inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-sidebar-foreground/8 ring-1 ring-sidebar-border/70">
                        <FeedFavicon
                          className="size-4 shrink-0 rounded-[3px] text-sidebar-foreground/70"
                          faviconUrl={item.faviconUrl}
                          feedUrl={item.url}
                          siteUrl={item.link}
                          title={item.title}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{item.title || item.url}</p>
                        <p className="truncate text-muted-foreground text-xs">
                          {item.description || item.url}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-sidebar-foreground/8 px-2 py-0.5 text-[11px] font-medium text-sidebar-foreground/72">
                        {item.isSubscribed ? "Following" : "Follow"}
                      </span>
                    </CommandItem>
                  ))}
                  {discoverResultsTruncated ? (
                    <CommandItem disabled value="discover-truncated-hint">
                      <span className="text-muted-foreground text-xs">
                        Showing first {DISCOVER_RESULTS_UI_CAP} results, refine your search to
                        narrow matches.
                      </span>
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              ) : null}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <span>Search by topic or paste a feed URL to follow it.</span>
            <Kbd className="px-1.5 text-[10px] leading-none">Esc</Kbd>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
