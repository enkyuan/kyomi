"use client";

import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "@kyomi/ui/icons/blode";
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
  CommandList,
} from "@kyomi/ui/components/command";
import { Kbd } from "@kyomi/ui/components/kbd";
import { useSquircle } from "@kyomi/ui/lib/squircle";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { followedFeedsQueryOptions } from "@modules/feeds/queries/options";
import { parseRecapPaletteQuery } from "../../lib/recap/command-query";
import { ManageFolders, type ManageFoldersProps } from "./manage-folders";
import { PaletteBody } from "./palette-body";
import { ContinueReadingPage, TopSourcesPage, WorthRevisitingPage } from "./section-pages";
import type { InboxItem } from "@modules/articles/lib/api";
import type { RecapSavedItem, RecapTopViewedFeed } from "../../lib/recap/types";
import { RecapSearch } from "./search";

// Concentric to the dialog in command.css: 24px radius - 1px border - 8px inset.
const FIELD_RADIUS_PX = 15;

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
  const body = (
    <PaletteBody
      activeSearch={activeSearch}
      feeds={feeds}
      folders={folders}
      goTo={goTo}
      hasContinueReading={continueReadingItems.length > 0}
      parsed={parsed}
      run={run}
      onCreateFolder={onCreateFolder}
      onImportOpml={onImportOpml}
      onOpenFeed={onOpenFeed}
      onSearchArticles={onSearchArticles}
    />
  );

  const onSubPage = page !== "root";
  const term = query.trim();

  const goBack = () => goTo("root");
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
      <CommandFooter
        activeMode={onFolders ? activeMode : null}
        onGoBack={goBack}
        onSubPage={onSubPage}
      />
    </Command>
  );
}

function CommandFooter({
  activeMode,
  onGoBack,
  onSubPage,
}: {
  activeMode: { finish: () => void; label: string } | null;
  onGoBack: () => void;
  onSubPage: boolean;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="kyomi-command-footer">
      <span className="inline-flex items-center gap-4">
        {onSubPage ? (
          <button
            className="kyomi-command-footer-action"
            type="button"
            // Keep focus in the field: a button taking it on press leaves the dialog frame focused
            // after the page changes.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onGoBack}
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
            {activeMode ? (
              <m.button
                key={activeMode.label}
                className="kyomi-command-footer-action"
                type="button"
                {...controlSwapMotion(reducedMotion)}
                transition={{ bounce: 0, duration: 0.2, type: "spring" }}
                onClick={activeMode.finish}
                onMouseDown={(event) => event.preventDefault()}
              >
                <Kbd className="px-1.5 text-[10px] leading-none">x</Kbd>
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
  );
}
