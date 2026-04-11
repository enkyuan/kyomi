"use client";

import { useDeferredValue, useEffect, useState } from "react";
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
import { Kbd } from "@components/ui/kbd";
import { SidebarMenuButton } from "@components/ui/sidebar";
import { toastManager } from "@components/ui/toast";
import { followFeed, searchFeeds } from "@lib/feed-functions";

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
  const shouldShowLoading = discoverResultsQuery.isFetching && searchResults.length === 0;
  const shouldShowEmpty =
    !shouldShowLoading && (deferredQuery.length === 0 || searchResults.length === 0);

  const setDialogOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

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
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      setDialogOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableGlobalShortcut]);

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
                  className="h-full items-center self-stretch has-[>kbd:last-child]:me-0"
                >
                  <Kbd className="min-w-0 whitespace-nowrap px-1.5 text-[10px] leading-none">
                    {isMacPlatform ? "⌘K" : "⌃K"}
                  </Kbd>
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
                  {searchResults.map((item) => (
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
                      <FeedFavicon
                        className="me-2 size-4 shrink-0 rounded-sm"
                        feedUrl={item.url}
                        siteUrl={item.link}
                        title={item.title}
                      />
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
