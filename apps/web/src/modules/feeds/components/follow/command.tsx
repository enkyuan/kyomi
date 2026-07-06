"use client";

import {
  AddCircleFill,
  CheckCircleFill,
  CornerDownLeftFill,
  RssFill,
  SearchLine,
} from "@mingcute/react";
import { Command } from "cmdk";
import { useRef } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { Kbd } from "@kyomi/ui/kbd";
import { useFeedback } from "@hooks/use-feedback";
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
      className="kyomi-feed-command"
      data-has-search-query={state.kind === "idle" ? undefined : "true"}
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
    <div className="kyomi-feed-command-search">
      <SearchLine className="kyomi-feed-command-search-icon" />
      <Command.Input
        placeholder="Search feeds or paste a feed URL..."
        value={query}
        onValueChange={onQueryChange}
      />
      {opmlImportUrl ? (
        <button
          aria-label="Import feeds from OPML"
          className="kyomi-feed-command-import-button"
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
      <Command.List>
        <div className="kyomi-feed-command-list-inner">
          {state.showEmpty ? (
            <Command.Empty>
              No feeds found yet. Try a broader topic or paste a feed URL.
            </Command.Empty>
          ) : null}
          {state.showLoading ? <CommandLoading /> : null}
          {state.resultsCount > 0 ? (
            <Command.Group heading="Feeds">
              {state.results.map((item) => (
                <CommandResultItem
                  key={`${item.id ?? item.url}-${item.url}`}
                  isPendingFollow={isPendingFollow(item)}
                  item={item}
                  onFollowFeed={onFollowFeed}
                />
              ))}
              {state.truncated ? <CommandTruncatedHint /> : null}
            </Command.Group>
          ) : null}
        </div>
      </Command.List>
      <div className="kyomi-feed-command-footer">
        <span>Search by topic or paste a feed URL to follow it.</span>
        <Kbd className="px-1.5 text-[10px] leading-none">Esc</Kbd>
      </div>
    </>
  );
}

function CommandLoading() {
  return (
    <Command.Group heading="Feeds">
      <Command.Item disabled value="searching">
        <RssFill className="kyomi-feed-command-item-icon" />
        <span>Searching feeds...</span>
      </Command.Item>
    </Command.Group>
  );
}

function CommandTruncatedHint() {
  return (
    <Command.Item disabled value="discover-truncated-hint">
      <span className="kyomi-feed-command-hint">
        Showing first {DISCOVER_RESULTS_UI_CAP} results, refine your search to narrow matches.
      </span>
    </Command.Item>
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
    <Command.Item
      ref={itemRef}
      value={`${item.title} ${item.url} ${item.description ?? ""}`}
      onSelect={followFromAction}
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
      <button
        ref={actionRef}
        aria-label={showFollowedState ? "Following" : "Add feed"}
        className="kyomi-feed-command-item-action"
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
    </Command.Item>
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
          className="kyomi-feed-command-action-icon"
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
