"use client";

import {
  AddCircleFill,
  CheckCircleFill,
  CornerDownLeftFill,
  RssFill,
  SearchLine,
} from "@mingcute/react";
import { Command } from "cmdk";
import { Kbd } from "@kyomi/ui/kbd";
import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import type { DiscoverFeedResult } from "@modules/feeds/api";

export const DISCOVER_RESULTS_UI_CAP = 200;

export type SourcesCommandState =
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

export function SourcesCommand({
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
  state: SourcesCommandState;
  onFollowFeed: (item: DiscoverFeedResult) => void;
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
      <SourcesCommandSearch
        opmlImportUrl={opmlImportUrl}
        pendingOpmlImportUrl={pendingOpmlImportUrl}
        query={query}
        onQueryChange={onQueryChange}
        onStartOpmlImport={onStartOpmlImport}
      />
      <SourcesCommandResults
        isPendingFollow={isPendingFollow}
        state={state}
        onFollowFeed={onFollowFeed}
      />
    </Command>
  );
}

function SourcesCommandSearch({
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

function SourcesCommandResults({
  isPendingFollow,
  state,
  onFollowFeed,
}: {
  isPendingFollow: (item: DiscoverFeedResult) => boolean;
  state: SourcesCommandState;
  onFollowFeed: (item: DiscoverFeedResult) => void;
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
          {state.showLoading ? <SourcesCommandLoading /> : null}
          {state.resultsCount > 0 ? (
            <Command.Group heading="Feeds">
              {state.results.map((item) => (
                <SourcesCommandResultItem
                  key={`${item.id ?? item.url}-${item.url}`}
                  isPendingFollow={isPendingFollow(item)}
                  item={item}
                  onFollowFeed={onFollowFeed}
                />
              ))}
              {state.truncated ? <SourcesCommandTruncatedHint /> : null}
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

function SourcesCommandLoading() {
  return (
    <Command.Group heading="Feeds">
      <Command.Item disabled value="searching">
        <RssFill className="kyomi-feed-command-item-icon" />
        <span>Searching feeds...</span>
      </Command.Item>
    </Command.Group>
  );
}

function SourcesCommandTruncatedHint() {
  return (
    <Command.Item disabled value="discover-truncated-hint">
      <span className="kyomi-feed-command-hint">
        Showing first {DISCOVER_RESULTS_UI_CAP} results, refine your search to narrow matches.
      </span>
    </Command.Item>
  );
}

function SourcesCommandResultItem({
  isPendingFollow,
  item,
  onFollowFeed,
}: {
  isPendingFollow: boolean;
  item: DiscoverFeedResult;
  onFollowFeed: (item: DiscoverFeedResult) => void;
}) {
  const isSubscribed = item.isSubscribed || isPendingFollow;

  return (
    <Command.Item
      value={`${item.title} ${item.url} ${item.description ?? ""}`}
      onSelect={() => onFollowFeed(item)}
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
        aria-label={isSubscribed ? "Following" : "Add feed"}
        className="kyomi-feed-command-item-action"
        title={isSubscribed ? "Following" : "Add feed"}
      >
        {isSubscribed ? <CheckCircleFill /> : <AddCircleFill />}
      </span>
    </Command.Item>
  );
}
