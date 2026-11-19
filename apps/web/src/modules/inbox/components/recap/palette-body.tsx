"use client";

import {
  BookmarkFilledIcon,
  ClockFilledIcon,
  FilterDescFilledIcon,
  FolderFilledIcon,
  PlusCircleFilledIcon,
  SearchIcon,
  FileArrowLeftInFilledIcon,
} from "@kyomi/ui/icons/blode";
import { CommandItem } from "@kyomi/ui/components/command";
import { FeedFavicon } from "@modules/feeds/components/favicon";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { matchesRecapTerm, type RecapPaletteQuery } from "../../lib/recap/command-query";
import type { RecapFolder } from "../../lib/recap/types";
import { Group } from "./manage-folders";

const RESULT_LIMIT = 8;

type PaletteBodyPage = "root" | "folders" | "sources" | "saved" | "continue";

/** The root page of the command menu: the quick links when empty, search results otherwise. */
export function PaletteBody({
  activeSearch,
  feeds,
  folders,
  goTo,
  hasContinueReading,
  onCreateFolder,
  onImportOpml,
  onOpenFeed,
  onSearchArticles,
  parsed,
  run,
}: {
  activeSearch: string | undefined;
  feeds: FollowedFeed[];
  folders: RecapFolder[];
  goTo: (page: PaletteBodyPage) => void;
  hasContinueReading: boolean;
  onCreateFolder: () => void;
  onImportOpml: () => void;
  onOpenFeed: (feed: FollowedFeed) => void;
  onSearchArticles: (term: string | undefined) => void;
  parsed: RecapPaletteQuery;
  run: (action: () => void) => () => void;
}) {
  const feedItems = (term: string) => (
    <FeedItems feeds={feeds} term={term} run={run} onOpenFeed={onOpenFeed} />
  );
  const folderItems = (term: string) => <FolderItems folders={folders} term={term} goTo={goTo} />;
  const articleItem = (term: string) => (
    <ArticleItem term={term} run={run} onSearchArticles={onSearchArticles} />
  );

  if (parsed.kind === "empty") {
    return (
      <QuickLinks
        activeSearch={activeSearch}
        goTo={goTo}
        hasContinueReading={hasContinueReading}
        onCreateFolder={onCreateFolder}
        onImportOpml={onImportOpml}
        onSearchArticles={onSearchArticles}
        run={run}
      />
    );
  } else if (parsed.kind === "commands") {
    // Slash commands are not suggested yet; `/feeds term` and the others still scope a search.
    return null;
  } else if (parsed.kind === "text") {
    return (
      <TextResults
        feeds={feeds}
        folders={folders}
        goTo={goTo}
        onOpenFeed={onOpenFeed}
        onSearchArticles={onSearchArticles}
        run={run}
        term={parsed.term}
      />
    );
  } else if (parsed.command === "articles") {
    return parsed.term ? <Group label="Articles">{articleItem(parsed.term)}</Group> : null;
  } else if (parsed.command === "feeds") {
    return <Group label="Feeds">{feedItems(parsed.term)}</Group>;
  } else {
    return <Group label="Folders">{folderItems(parsed.term)}</Group>;
  }
}

type RunAction = (action: () => void) => () => void;

function matchingFeeds(feeds: FollowedFeed[], term: string) {
  return feeds
    .filter((feed) => matchesRecapTerm(feed.title, term) || matchesRecapTerm(feed.url, term))
    .slice(0, RESULT_LIMIT);
}

function matchingFolders(folders: RecapFolder[], term: string) {
  return folders.filter((folder) => matchesRecapTerm(folder.name, term)).slice(0, RESULT_LIMIT);
}

function feedRowItems(
  feeds: FollowedFeed[],
  run: RunAction,
  onOpenFeed: (feed: FollowedFeed) => void,
) {
  return feeds.map((feed) => (
    <CommandItem
      key={feed.feedId}
      value={`feed-${feed.feedId}`}
      onSelect={run(() => onOpenFeed(feed))}
    >
      <FeedFavicon
        className="size-5 shrink-0"
        faviconUrl={feed.faviconUrl}
        feedUrl={feed.url}
        shape="squircle"
        siteUrl={feed.link}
        squircleCornerRadius={5}
        title={feed.title || feed.url}
      />
      <span className="min-w-0 truncate">{feed.title || feed.url}</span>
    </CommandItem>
  ));
}

function folderRowItems(folders: RecapFolder[], goTo: (page: PaletteBodyPage) => void) {
  return folders.map((folder) => (
    <CommandItem key={folder.id} value={`folder-${folder.id}`} onSelect={() => goTo("folders")}>
      <FolderFilledIcon className="kyomi-command-item-icon" />
      <span className="min-w-0 truncate">{folder.name}</span>
    </CommandItem>
  ));
}

function FeedItems({
  feeds,
  term,
  run,
  onOpenFeed,
}: {
  feeds: FollowedFeed[];
  term: string;
  run: RunAction;
  onOpenFeed: (feed: FollowedFeed) => void;
}) {
  return <>{feedRowItems(matchingFeeds(feeds, term), run, onOpenFeed)}</>;
}

function FolderItems({
  folders,
  term,
  goTo,
}: {
  folders: RecapFolder[];
  term: string;
  goTo: (page: PaletteBodyPage) => void;
}) {
  return <>{folderRowItems(matchingFolders(folders, term), goTo)}</>;
}

function ArticleItem({
  term,
  run,
  onSearchArticles,
}: {
  term: string;
  run: RunAction;
  onSearchArticles: (term: string | undefined) => void;
}) {
  return (
    <CommandItem value="search-articles" onSelect={run(() => onSearchArticles(term))}>
      <SearchIcon className="kyomi-command-item-icon" />
      <span className="min-w-0 truncate">Search articles for “{term}”</span>
    </CommandItem>
  );
}

function TextResults({
  feeds,
  folders,
  goTo,
  onOpenFeed,
  onSearchArticles,
  run,
  term,
}: {
  feeds: FollowedFeed[];
  folders: RecapFolder[];
  goTo: (page: PaletteBodyPage) => void;
  onOpenFeed: (feed: FollowedFeed) => void;
  onSearchArticles: (term: string | undefined) => void;
  run: RunAction;
  term: string;
}) {
  const feedRows = feedRowItems(matchingFeeds(feeds, term), run, onOpenFeed);
  const folderRows = folderRowItems(matchingFolders(folders, term), goTo);
  return (
    <>
      <Group label="Articles">
        <ArticleItem term={term} run={run} onSearchArticles={onSearchArticles} />
      </Group>
      {feedRows.length > 0 ? <Group label="Feeds">{feedRows}</Group> : null}
      {folderRows.length > 0 ? <Group label="Folders">{folderRows}</Group> : null}
    </>
  );
}

function QuickLinks({
  activeSearch,
  goTo,
  hasContinueReading,
  onCreateFolder,
  onImportOpml,
  onSearchArticles,
  run,
}: {
  activeSearch: string | undefined;
  goTo: (page: PaletteBodyPage) => void;
  hasContinueReading: boolean;
  onCreateFolder: () => void;
  onImportOpml: () => void;
  onSearchArticles: (term: string | undefined) => void;
  run: RunAction;
}) {
  return (
    <>
      <Group label="Go to">
        <CommandItem value="go-folders" onSelect={() => goTo("folders")}>
          <FolderFilledIcon className="kyomi-command-item-icon" />
          Folders
        </CommandItem>
        <CommandItem value="go-sources" onSelect={() => goTo("sources")}>
          <FilterDescFilledIcon className="kyomi-command-item-icon" />
          Top sources
        </CommandItem>
        <CommandItem value="go-saved" onSelect={() => goTo("saved")}>
          <BookmarkFilledIcon className="kyomi-command-item-icon" />
          Worth revisiting
        </CommandItem>
        {hasContinueReading ? (
          <CommandItem value="go-continue" onSelect={() => goTo("continue")}>
            <ClockFilledIcon className="kyomi-command-item-icon" />
            Continue reading
          </CommandItem>
        ) : null}
      </Group>
      <Group label="Actions">
        <CommandItem value="create-folder" onSelect={run(onCreateFolder)}>
          <PlusCircleFilledIcon className="kyomi-command-item-icon" />
          Create folder
        </CommandItem>
        <CommandItem value="import-opml" onSelect={run(onImportOpml)}>
          <FileArrowLeftInFilledIcon className="kyomi-command-item-icon" />
          Import OPML
        </CommandItem>
        {activeSearch ? (
          <CommandItem value="clear-search" onSelect={run(() => onSearchArticles(undefined))}>
            <ClockFilledIcon className="kyomi-command-item-icon" />
            Clear search “{activeSearch}”
          </CommandItem>
        ) : null}
      </Group>
    </>
  );
}
