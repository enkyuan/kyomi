"use client";

import type { DetailHeaderState } from "@modules/reader/components/detail";
import type { ArticleDetailDto } from "@lib/schemas";
import type { InboxPreferences } from "@modules/inbox/hooks/use-inbox-data";
import { ArticleHeader } from "./article-header";
import { DetailSection } from "./detail-section";

// oxlint-disable-next-line react-doctor/no-many-boolean-props
export function ArticleShell({
  preferences,
  detailError,
  isDetailError,
  isDetailFetching,
  selectedItem,
  onBackToList,
  onSelectPreviousItem,
  onSelectNextItem,
  canSelectPreviousItem,
  canSelectNextItem,
  articleStepDirection,
}: {
  preferences: InboxPreferences;
  detailError: unknown;
  isDetailError: boolean;
  isDetailFetching: boolean;
  selectedItem: ArticleDetailDto | null;
  onBackToList: () => void;
  onSelectPreviousItem: () => void;
  onSelectNextItem: () => void;
  canSelectPreviousItem: boolean;
  canSelectNextItem: boolean;
  articleStepDirection: 1 | -1;
}) {
  const header = selectedItem
    ? ({ readerControlsCollapsed }: DetailHeaderState) => (
        <ArticleHeader
          item={selectedItem}
          readerControlsCollapsed={readerControlsCollapsed}
          onBackToList={onBackToList}
          onSelectPreviousItem={onSelectPreviousItem}
          onSelectNextItem={onSelectNextItem}
          canSelectPreviousItem={canSelectPreviousItem}
          canSelectNextItem={canSelectNextItem}
        />
      )
    : () => <ArticleHeader item={null} onBackToList={onBackToList} />;

  return (
    <section className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden [--inbox-header-height:3rem] md:min-h-0">
      <div className="min-h-0 min-w-0 flex-1">
        <DetailSection
          preferences={preferences}
          detailError={detailError}
          isDetailError={isDetailError}
          isDetailFetching={isDetailFetching}
          selectedItem={selectedItem}
          surface="inbox"
          header={header}
          articleContentKey={selectedItem?.id}
          articleStepDirection={articleStepDirection}
        />
      </div>
    </section>
  );
}
