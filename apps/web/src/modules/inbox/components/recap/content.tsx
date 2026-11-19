"use client";

import { FolderIcon } from "@kyomi/ui/icons/blode";
import { Button } from "@kyomi/ui/components/button";
import { ScrollArea } from "@kyomi/ui/components/scroll-area";
import { useViewport } from "@modules/inbox/hooks/use-viewport";
import { getRecapRowLimits } from "../../lib/recap/row-limits";
import { useRef } from "react";
import { cn } from "@kyomi/ui/lib/utils";
import { Folders } from "@modules/inbox/components/recap/folders/summary";
import type { InboxItem } from "@modules/articles/lib/api";

/** An expanded screen is one card inset like the summary's section cards, with the same 24px corner. */
const RECAP_EMPTY_CARD_CLASS =
  "mx-2 mt-4.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-sidebar p-2 shadow-sm/5";
import {
  RECAP_SUMMARY_LAYOUT_CLASS,
  RECAP_SUMMARY_SECTION_CLASS,
  RecapError,
  RecapSkeleton,
  SectionEmpty,
} from "./sections";
import { ContinueReading } from "./sections/continue-reading";
import { TopSources } from "./sections/top-sources";
import { WorthRevisiting } from "./sections/worth-revisiting";
import type { RecapFolder, RecapSavedItem, RecapTopViewedFeed } from "../../lib/recap/types";

export function RecapContent({
  continueReadingItems,
  folders,
  isFollowingFeed,
  isSummaryEmpty,
  movingFeedId,
  oldestSavedItems,
  recapError,
  recapLoading,
  refetchRecap,
  topViewedFeeds,
  unsavingItemId,
  followFeed,
  moveFeed,
  onCreateFolder,
  onDismissContinueReading,
  onImportOpml,
  onManageFolders,
  onUnsave,
}: {
  continueReadingItems: InboxItem[];
  folders: RecapFolder[];
  isFollowingFeed: (feedId: string) => boolean;
  isSummaryEmpty: boolean;
  movingFeedId: string | null;
  oldestSavedItems: RecapSavedItem[];
  recapError: boolean;
  recapLoading: boolean;
  refetchRecap: () => void;
  topViewedFeeds: RecapTopViewedFeed[];
  unsavingItemId: string | null;
  followFeed: (feed: RecapTopViewedFeed, folderId?: string) => void;
  moveFeed: (feedId: string, folderId: string) => void;
  onCreateFolder: () => void;
  onDismissContinueReading: (itemId: string) => void;
  onImportOpml: () => void;
  /** Opens the folders page of the command menu. */
  onManageFolders: () => void;
  onUnsave: (itemId: string) => void;
}) {
  const hasContinueReading = continueReadingItems.length > 0;
  const areaRef = useRef<HTMLDivElement | null>(null);
  const { viewportHeight } = useViewport(areaRef);
  const limits = getRecapRowLimits({
    availableHeight: viewportHeight,
    continueReadingCount: continueReadingItems.length,
    folderCount: folders.length,
    savedItemCount: oldestSavedItems.length,
    topSourceCount: topViewedFeeds.length,
  });
  if (recapLoading) {
    return <RecapSkeleton />;
  }
  if (recapError) {
    return <RecapError onRetry={refetchRecap} />;
  }
  if (isSummaryEmpty && !hasContinueReading) {
    return (
      <div className={cn(RECAP_EMPTY_CARD_CLASS, "items-center justify-center px-4")}>
        <SectionEmpty
          title="Nothing here yet"
          description="Folders, top sources, and saved items will appear here as you read and organize feeds."
          icon={<FolderIcon />}
          action={
            <Button shape="pill" size="sm" onClick={onCreateFolder}>
              Create folder
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <>
      <div ref={areaRef} className="min-h-0 flex-1">
        <ScrollArea className="h-full" scrollbarGutter>
          <div className={cn(RECAP_SUMMARY_LAYOUT_CLASS, "min-h-full")}>
            <div className={RECAP_SUMMARY_SECTION_CLASS}>
              <Folders
                folders={folders}
                limit={limits.folders}
                onExpand={onManageFolders}
                onCreateFolder={onCreateFolder}
                onImportOpml={onImportOpml}
                onSelectFolder={onManageFolders}
              />
            </div>
            <div className={RECAP_SUMMARY_SECTION_CLASS}>
              <TopSources
                feeds={topViewedFeeds}
                limit={limits.topSources}
                folders={folders}
                followFeed={followFeed}
                isFollowingFeed={isFollowingFeed}
                moveFeed={moveFeed}
                movingFeedId={movingFeedId}
              />
            </div>
            {hasContinueReading ? (
              <div className={RECAP_SUMMARY_SECTION_CLASS}>
                <ContinueReading
                  items={continueReadingItems}
                  onDismiss={onDismissContinueReading}
                />
              </div>
            ) : null}
            <div className={RECAP_SUMMARY_SECTION_CLASS}>
              <WorthRevisiting
                items={oldestSavedItems}
                limit={limits.savedItems}
                onUnsave={onUnsave}
                unsavingItemId={unsavingItemId}
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
