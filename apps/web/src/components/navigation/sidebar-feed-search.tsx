"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RssFill } from "@mingcute/react";
import { FeedFavicon } from "@components/navigation/feed-favicon";
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
} from "@components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@components/ui/input-group";
import { Kbd, KbdGroup } from "@components/ui/kbd";
import { SidebarMenuButton } from "@components/ui/sidebar";
import { toastManager } from "@components/ui/toast";
import { followFeed, searchFeeds } from "@modules/feeds/api";

/** Cap list rows so opening the dialog never mounts thousands of command items in one commit. */
const DISCOVER_RESULTS_UI_CAP = 200;

type SidebarFeedSearchTriggerProps = {
  isMacPlatform: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  enableGlobalShortcut?: boolean;
};

export function SidebarFeedSearchTrigger({
  isMacPlatform,
  open,
  onOpenChange,
  hideTrigger = false,
  enableGlobalShortcut = true,
}: SidebarFeedSearchTriggerProps) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogOpen = open ?? internalOpen;
  const deferredQuery = useDeferredValue(query.trim());
  const discoverResultsQuery = useQuery({
    queryKey: ["discover", "feeds", deferredQuery],
    queryFn: () => searchFeeds({ data: { query: deferredQuery } }),
    enabled: dialogOpen && deferredQuery.length > 0,
    placeholderData: (previousData) => previousData,
  });
  const searchResults = discoverResultsQuery.data ?? [];
  const cappedSearchResults =
    searchResults.length > DISCOVER_RESULTS_UI_CAP
      ? searchResults.slice(0, DISCOVER_RESULTS_UI_CAP)
      : searchResults;
  const discoverResultsTruncated = searchResults.length > DISCOVER_RESULTS_UI_CAP;
  const shouldShowLoading = discoverResultsQuery.isFetching && searchResults.length === 0;
  const shouldShowEmpty =
    !shouldShowLoading && (deferredQuery.length === 0 || searchResults.length === 0);

  const setDialogOpen = (nextOpen: boolean) => {
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
  };

  useEffect(() => {
    if (!dialogOpen) {
      setQuery("");
    }
  }, [dialogOpen]);

  const followFeedMutation = useMutation({
    mutationFn: ({ url }: { url: string }) => followFeed({ data: { url } }),
    onSuccess: async (result) => {
      queryClient.setQueriesData(
        { queryKey: ["discover", "feeds"] },
        (current: Awaited<ReturnType<typeof searchFeeds>> | undefined) =>
          current?.map((item) =>
            item.url === result.url
              ? { ...item, isSubscribed: true, id: item.id ?? result.feedId }
              : item,
          ),
      );
      await queryClient.invalidateQueries({
        queryKey: ["feeds", "followed"],
      });
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
    onError: (error) => {
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
      const usesPlatformShortcut = isMacPlatform
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey;

      if (
        event.key.toLowerCase() !== "k" ||
        !usesPlatformShortcut ||
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
  }, [enableGlobalShortcut, isMacPlatform]);

  return (
    <CommandDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!hideTrigger ? (
        <CommandDialogTrigger
          render={
            <SidebarMenuButton className="mt-1 h-auto rounded-2xl p-0 shadow-none hover:bg-transparent active:bg-transparent data-[active=true]:bg-transparent focus-visible:ring-0">
              <InputGroup className="h-9 w-full rounded-2xl bg-sidebar-accent/48 shadow-none before:shadow-none transition-colors hover:bg-sidebar-accent/72">
                <InputGroupInput
                  aria-label="Discover"
                  size="sm"
                  className="cursor-text text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/56"
                  placeholder="Follow sources"
                  readOnly
                  type="search"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="ms-auto h-full items-center self-stretch has-[>kbd:last-child]:me-0"
                >
                  <KbdGroup className="-me-1">
                    <Kbd>{isMacPlatform ? "\u2318" : "\u2303"}</Kbd>
                    <Kbd>K</Kbd>
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
            placeholder="Search feeds or paste a feed URL..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <CommandPanel>
            <CommandList>
              {shouldShowEmpty ? (
                <CommandEmpty>
                  {deferredQuery
                    ? "No feeds found yet. Try a broader topic or paste a feed URL."
                    : "Search by topic or paste an RSS, Atom, or site feed URL."}
                </CommandEmpty>
              ) : null}
              {shouldShowLoading ? (
                <CommandGroup>
                  <CommandGroupLabel>Feeds</CommandGroupLabel>
                  <CommandItem disabled value="searching">
                    <RssFill className="me-2 size-4 shrink-0" />
                    <span>Searching feeds...</span>
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
                        Showing first {DISCOVER_RESULTS_UI_CAP} results — refine your search to
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
