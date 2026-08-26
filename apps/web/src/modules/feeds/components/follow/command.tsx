"use client";

import {
  AddCircleFill,
  CheckCircleFill,
  CornerDownLeftFill,
  RssFill,
  SearchLine,
} from "@kyomi/ui/icons/mingcute";
import { useRef } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "@kyomi/ui/motion";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@kyomi/ui/command";
import { Kbd } from "@kyomi/ui/kbd";
import { ScrollAreaPrimitive, ScrollBar } from "@kyomi/ui/scroll-area";
import { useFeedback } from "@kyomi/ui/hooks/use-feedback";
import { FeedFavicon } from "@modules/feeds/components/feed-favicon";
import type { DiscoverFeedResult } from "@modules/feeds/lib/api";

export const DISCOVER_RESULTS_UI_CAP = 200;
type FollowFeedHandler = (item: DiscoverFeedResult, anchor?: HTMLElement | null) => void;
const FOLLOW_ACTION_ICON_TRANSITION = { type: "spring" as const, duration: 0.3, bounce: 0 };
const FOLLOW_ACTION_ICON_STATE = {
  opacity: 1,
  scale: 1,
  filter: "blur(0px)",
};
const FOLLOW_ACTION_ICON_HIDDEN_STATE = {
  opacity: 0,
  scale: 0.25,
  filter: "blur(4px)",
};

export type FollowSourcesCommandState =
  | { kind: "idle" }
  | { kind: "opml" }
  | {
      kind: "search";
      results: DiscoverFeedResult[];
      resultsCount: number;
      showEmpty: boolean;
      showLoading: boolean;
      truncated: boolean;
    };

export function FollowSourcesCommand({
  isPendingFollow,
  opmlImportUrl,
  pendingOpmlImportUrl,
  query,
  state,
  onFollowFeed,
  onQueryChange,
  onStartOpmlImport,
}: {
  isPendingFollow: (item: DiscoverFeedResult) => boolean;
  opmlImportUrl: string | null;
  pendingOpmlImportUrl: string | null;
  query: string;
  state: FollowSourcesCommandState;
  onFollowFeed: FollowFeedHandler;
  onQueryChange: (query: string) => void;
  onStartOpmlImport: (url: string) => void;
}) {
  return (
    <Command
      className="kyomi-command"
      data-has-search-query={state.kind === "idle" ? undefined : "true"}
      data-has-results-panel={state.kind === "search" ? "true" : undefined}
      label="Add feed"
      shouldFilter={false}
    >
      <CommandSearch
        opmlImportUrl={opmlImportUrl}
        pendingOpmlImportUrl={pendingOpmlImportUrl}
        query={query}
        onQueryChange={onQueryChange}
        onStartOpmlImport={onStartOpmlImport}
      />
      <CommandResults isPendingFollow={isPendingFollow} state={state} onFollowFeed={onFollowFeed} />
    </Command>
  );
}

function CommandSearch({
  opmlImportUrl,
  pendingOpmlImportUrl,
  query,
  onQueryChange,
  onStartOpmlImport,
}: {
  opmlImportUrl: string | null;
  pendingOpmlImportUrl: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onStartOpmlImport: (url: string) => void;
}) {
  return (
    <div className="kyomi-command-search">
      <SearchLine className="kyomi-command-search-icon" />
      <CommandInput
        placeholder="Search feeds or paste a feed URL..."
        value={query}
        onValueChange={onQueryChange}
      />
      {opmlImportUrl ? (
        <button
          aria-label="Import feeds from OPML"
          className="kyomi-command-import-button"
          disabled={Boolean(pendingOpmlImportUrl)}
          type="button"
          onClick={() => onStartOpmlImport(opmlImportUrl)}
        >
          Import
          <CornerDownLeftFill aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function CommandResults({
  isPendingFollow,
  state,
  onFollowFeed,
}: {
  isPendingFollow: (item: DiscoverFeedResult) => boolean;
  state: FollowSourcesCommandState;
  onFollowFeed: FollowFeedHandler;
}) {
  if (state.kind !== "search") {
    return null;
  }

  return (
    <>
      <ScrollAreaPrimitive.Root className="kyomi-command-list-scroll">
        <ScrollAreaPrimitive.Viewport
          className="kyomi-command-list-viewport"
          data-slot="scroll-area-viewport"
        >
          <CommandList className="not-empty:p-0">
            <div className="kyomi-command-list-inner">
              {state.showEmpty ? (
                <CommandEmpty>
                  No feeds found yet. Try a broader topic or paste a feed URL.
                </CommandEmpty>
              ) : null}
              {state.showLoading ? <CommandLoading /> : null}
              {state.resultsCount > 0 ? (
                <>
                  {state.results.map((item) => (
                    <CommandResultItem
                      key={`${item.id ?? item.url}-${item.url}`}
                      isPendingFollow={isPendingFollow(item)}
                      item={item}
                      onFollowFeed={onFollowFeed}
                    />
                  ))}
                  {state.truncated ? <CommandTruncatedHint /> : null}
                </>
              ) : null}
            </div>
          </CommandList>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar orientation="vertical" />
        <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
      </ScrollAreaPrimitive.Root>
      <div className="kyomi-command-footer">
        <span>Search by topic or paste a feed URL to follow it.</span>
        <Kbd className="px-1.5 text-[10px] leading-none">Esc</Kbd>
      </div>
    </>
  );
}

function CommandLoading() {
  return (
    <CommandItem disabled value="searching">
      <RssFill className="kyomi-command-item-icon" />
      <span>Searching feeds...</span>
    </CommandItem>
  );
}

function CommandTruncatedHint() {
  return (
    <CommandItem disabled value="discover-truncated-hint">
      <span className="kyomi-command-hint">
        Showing first {DISCOVER_RESULTS_UI_CAP} results, refine your search to narrow matches.
      </span>
    </CommandItem>
  );
}

function CommandResultItem({
  isPendingFollow,
  item,
  onFollowFeed,
}: {
  isPendingFollow: boolean;
  item: DiscoverFeedResult;
  onFollowFeed: FollowFeedHandler;
}) {
  const isSubscribed = item.isSubscribed || isPendingFollow;
  const { isActive: isShowingFollowFeedback, showFeedback } = useFeedback();
  const showFollowedState = isSubscribed || isShowingFollowFeedback;
  const itemRef = useRef<HTMLDivElement | null>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  const followFromAction = () => {
    if (showFollowedState) {
      return;
    }

    showFeedback();
    onFollowFeed(item, actionRef.current ?? itemRef.current);
  };

  return (
    <CommandItem
      ref={itemRef}
      value={`${item.title} ${item.url} ${item.description ?? ""}`}
      onSelect={followFromAction}
    >
      <span className="kyomi-command-favicon">
        <FeedFavicon
          className="kyomi-command-favicon-media"
          faviconUrl={item.faviconUrl}
          feedUrl={item.url}
          shape="squircle"
          siteUrl={item.link}
          squircleCornerRadius={6}
          title={item.title}
        />
      </span>
      <div className="kyomi-command-item-copy">
        <p>{item.title || item.url}</p>
        <p>{item.description || item.url}</p>
      </div>
      <button
        ref={actionRef}
        aria-label={showFollowedState ? "Following" : "Add feed"}
        className="kyomi-command-item-action"
        disabled={showFollowedState}
        tabIndex={-1}
        title={showFollowedState ? "Following" : "Add feed"}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          followFromAction();
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <FollowActionIcon isFollowing={showFollowedState} />
      </button>
    </CommandItem>
  );
}

function FollowActionIcon({ isFollowing }: { isFollowing: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = isFollowing ? CheckCircleFill : AddCircleFill;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={isFollowing ? "following" : "add"}
          className="kyomi-command-action-icon"
          initial={prefersReducedMotion ? false : FOLLOW_ACTION_ICON_HIDDEN_STATE}
          animate={FOLLOW_ACTION_ICON_STATE}
          exit={prefersReducedMotion ? undefined : FOLLOW_ACTION_ICON_HIDDEN_STATE}
          transition={prefersReducedMotion ? { duration: 0 } : FOLLOW_ACTION_ICON_TRANSITION}
        >
          <Icon />
        </m.span>
      </AnimatePresence>
    </LazyMotion>
  );
}
