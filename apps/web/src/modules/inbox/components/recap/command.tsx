"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BookmarkFilledIcon,
  ClockFilledIcon,
  FilterDescFilledIcon,
  FolderFilledIcon,
  PlusCircleFilledIcon,
  SearchIcon,
  FileArrowLeftInFilledIcon,
} from "@kyomi/ui/icons/blode";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  controlSwapMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "@kyomi/ui/lib/motion";
import {
  Command,
  CommandDialog,
  CommandDialogPortal,
  CommandDialogPrimitive,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@kyomi/ui/components/command";
import { Kbd } from "@kyomi/ui/components/kbd";
import { useSquircle } from "@kyomi/ui/lib/squircle";
import { FeedFavicon } from "@modules/feeds/components/favicon";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { followedFeedsQueryOptions } from "@modules/feeds/queries/options";
import { matchesRecapTerm, parseRecapPaletteQuery } from "../../lib/recap/command-query";
import { Group, ManageFolders, type ManageFoldersProps } from "./manage-folders";
import { ContinueReadingPage, TopSourcesPage, WorthRevisitingPage } from "./section-pages";
import type { InboxItem } from "@modules/articles/lib/api";
import type { RecapSavedItem, RecapTopViewedFeed } from "../../lib/recap/types";
import { RecapSearch } from "./search";

// Concentric to the dialog in command.css: 24px radius - 1px border - 8px inset.
const FIELD_RADIUS_PX = 15;
const RESULT_LIMIT = 8;

export type RecapCommandPage = "root" | "folders" | "sources" | "saved" | "continue";

const PAGE_TITLES = {
  continue: "Continue reading",
  folders: "Folders",
  root: "Search",
  saved: "Worth revisiting",
  sources: "Top sources",
} satisfies Record<RecapCommandPage, string>;
export type RecapCommandMenu = { open: boolean; page: RecapCommandPage };

type RecapCommandActions = {
  continueReadingItems: InboxItem[];
  oldestSavedItems: RecapSavedItem[];
  topViewedFeeds: RecapTopViewedFeed[];
  onOpenArticle: (item: { id: string; title: string }) => void;
  onOpenSource: (feed: RecapTopViewedFeed) => void;
  onCreateFolder: () => void;
  onImportOpml: () => void;
  onOpenFeed: (feed: FollowedFeed) => void;
  /** An empty term shows the whole inbox again. */
  onSearchArticles: (term: string | undefined) => void;
};

/**
 * The rail's search field and the command menu it opens (⌘K or ⌃K from anywhere, or click the
 * field). Plain text searches articles and matches feeds and folders; `/feeds`, `/articles`,
 * `/folders`, `/sources` and `/saved` scope it, and the menu also offers the rail's own actions.
 */
export function RecapCommand({
  activeSearch,
  menu,
  onMenuChange,
  ...rest
}: RecapCommandActions &
  Omit<ManageFoldersProps, "feeds" | "onOpenFeed"> & {
    activeSearch: string | undefined;
    menu: RecapCommandMenu;
    onMenuChange: (menu: RecapCommandMenu) => void;
  }) {
  const openMenu = useCallback(() => onMenuChange({ open: true, page: "root" }), [onMenuChange]);

  return (
    <>
      <RecapSearch value={activeSearch} onOpen={openMenu} />
      <CommandDialog open={menu.open} onOpenChange={(open) => onMenuChange({ open, page: "root" })}>
        <CommandDialogPortal>
          <CommandDialogPrimitive.Backdrop className="kyomi-command-overlay" />
          <CommandDialogPrimitive.Popup
            aria-describedby="recap-command-description"
            className="kyomi-command-dialog"
          >
            <CommandDialogPrimitive.Title className="sr-only">Search</CommandDialogPrimitive.Title>
            <CommandDialogPrimitive.Description className="sr-only" id="recap-command-description">
              Search articles, feeds and folders, or open folder management.
            </CommandDialogPrimitive.Description>
            <RecapCommandPanel
              {...rest}
              activeSearch={activeSearch}
              initialPage={menu.page}
              onClose={() => onMenuChange({ open: false, page: "root" })}
            />
          </CommandDialogPrimitive.Popup>
        </CommandDialogPortal>
      </CommandDialog>
    </>
  );
}

function RecapCommandPanel({
  activeSearch,
  continueReadingItems,
  exportingOpml,
  folders,
  initialPage,
  oldestSavedItems,
  topViewedFeeds,
  onOpenArticle,
  onOpenSource,
  onExportOpml,
  moveFeed,
  onClose,
  onCreateFolder,
  onImportOpml,
  onOpenFeed,
  onSearchArticles,
}: RecapCommandActions &
  Omit<ManageFoldersProps, "feeds" | "onOpenFeed"> & {
    activeSearch: string | undefined;
    initialPage: RecapCommandPage;
    onClose: () => void;
  }) {
  const [page, setPage] = useState<RecapCommandPage>(initialPage);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const goTo = (next: RecapCommandPage) => {
    setPage(next);
    setEditMode(false);
    setPinMode(false);
    setQuery("");
    inputRef.current?.focus();
  };
  const squircle = useSquircle<HTMLDivElement>(FIELD_RADIUS_PX, 0.6);
  const { data: feeds = [] } = useQuery(followedFeedsQueryOptions());
  const parsed = parseRecapPaletteQuery(query);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };
  const feedMatches = (term: string) =>
    feeds
      .filter((feed) => matchesRecapTerm(feed.title, term) || matchesRecapTerm(feed.url, term))
      .slice(0, RESULT_LIMIT);
  const folderMatches = (term: string) =>
    folders.filter((folder) => matchesRecapTerm(folder.name, term)).slice(0, RESULT_LIMIT);

  const feedItems = (term: string) =>
    feedMatches(term).map((feed) => (
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
  const folderItems = (term: string) =>
    folderMatches(term).map((folder) => (
      <CommandItem key={folder.id} value={`folder-${folder.id}`} onSelect={() => goTo("folders")}>
        <FolderFilledIcon className="kyomi-command-item-icon" />
        <span className="min-w-0 truncate">{folder.name}</span>
      </CommandItem>
    ));
  const articleItem = (term: string) => (
    <CommandItem value="search-articles" onSelect={run(() => onSearchArticles(term))}>
      <SearchIcon className="kyomi-command-item-icon" />
      <span className="min-w-0 truncate">Search articles for “{term}”</span>
    </CommandItem>
  );

  let body: ReactNode = null;
  if (parsed.kind === "empty") {
    body = (
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
          {continueReadingItems.length > 0 ? (
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
  } else if (parsed.kind === "commands") {
    // Slash commands are not suggested yet; `/feeds term` and the others still scope a search.
    body = null;
  } else if (parsed.kind === "text") {
    const feedRows = feedItems(parsed.term);
    const folderRows = folderItems(parsed.term);
    body = (
      <>
        <Group label="Articles">{articleItem(parsed.term)}</Group>
        {feedRows.length > 0 ? <Group label="Feeds">{feedRows}</Group> : null}
        {folderRows.length > 0 ? <Group label="Folders">{folderRows}</Group> : null}
      </>
    );
  } else if (parsed.command === "articles") {
    body = parsed.term ? <Group label="Articles">{articleItem(parsed.term)}</Group> : null;
  } else if (parsed.command === "feeds") {
    body = <Group label="Feeds">{feedItems(parsed.term)}</Group>;
  } else {
    body = <Group label="Folders">{folderItems(parsed.term)}</Group>;
  }

  const onSubPage = page !== "root";
  const term = query.trim();

  const goBack = () => goTo("root");
  const reducedMotion = useReducedMotion();
  const onFolders = page === "folders";
  const activeMode = editMode
    ? { finish: () => setEditMode(() => false), label: "finish editing" }
    : pinMode
      ? { finish: () => setPinMode(() => false), label: "finish pinning" }
      : null;

  return (
    <Command
      className="kyomi-command kyomi-command-compact"
      label={PAGE_TITLES[page]}
      shouldFilter={false}
    >
      <div ref={squircle.ref} className="kyomi-command-search" style={squircle.style}>
        <SearchIcon className="kyomi-command-search-icon" />
        <CommandInput
          ref={inputRef}
          placeholder={onSubPage ? `Search ${PAGE_TITLES[page].toLowerCase()}` : "Search"}
          value={query}
          onKeyDown={(event) => {
            // Backspace or ← in an empty field steps back, as the footer says.
            if (
              onSubPage &&
              query === "" &&
              (event.key === "Backspace" || event.key === "ArrowLeft")
            ) {
              event.preventDefault();
              goBack();
            }
          }}
          onValueChange={setQuery}
        />
      </div>
      <CommandList className="max-h-96 overflow-y-auto">
        <CommandEmpty>Nothing matches.</CommandEmpty>
        {page === "folders" ? (
          <ManageFolders
            editMode={editMode}
            exportingOpml={exportingOpml}
            feeds={feeds}
            pinMode={pinMode}
            setEditMode={setEditMode}
            setPinMode={setPinMode}
            folders={folders}
            run={run}
            term={query.trim()}
            onCreateFolder={onCreateFolder}
            onExportOpml={onExportOpml}
            onImportOpml={onImportOpml}
            moveFeed={moveFeed}
            onOpenFeed={onOpenFeed}
          />
        ) : page === "sources" ? (
          <TopSourcesPage feeds={topViewedFeeds} run={run} term={term} onOpenFeed={onOpenSource} />
        ) : page === "saved" ? (
          <WorthRevisitingPage
            items={oldestSavedItems}
            run={run}
            term={term}
            onOpen={onOpenArticle}
          />
        ) : page === "continue" ? (
          <ContinueReadingPage
            items={continueReadingItems}
            run={run}
            term={term}
            onOpen={onOpenArticle}
          />
        ) : (
          body
        )}
      </CommandList>
      <div className="kyomi-command-footer">
        <span className="inline-flex items-center gap-4">
          {onSubPage ? (
            <button
              className="kyomi-command-footer-action"
              type="button"
              // Keep focus in the field: a button taking it on press leaves the dialog frame focused
              // after the page changes.
              onMouseDown={(event) => event.preventDefault()}
              onClick={goBack}
            >
              <Kbd className="px-1.5 text-[10px] leading-none">←</Kbd>
              to go back
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Kbd className="px-1.5 text-[10px] leading-none">/</Kbd>
              for commands
            </span>
          )}
          <LazyMotion features={domAnimation}>
            <AnimatePresence initial={false} mode="popLayout">
              {onFolders && activeMode ? (
                <m.button
                  key={activeMode.label}
                  className="kyomi-command-footer-action"
                  type="button"
                  {...controlSwapMotion(reducedMotion)}
                  transition={{ bounce: 0, duration: 0.2, type: "spring" }}
                  onClick={activeMode.finish}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <Kbd className="px-1.5 text-[10px] leading-none">×</Kbd>
                  to {activeMode.label}
                </m.button>
              ) : null}
            </AnimatePresence>
          </LazyMotion>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd className="px-1.5 text-[10px] leading-none">↵</Kbd>
          to select
        </span>
      </div>
    </Command>
  );
}
