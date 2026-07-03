"use client";

import type { ArticleDetailDto, InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas/index";
import { AnimatedContent } from "./animated-content";
import { ArticleContent } from "./article-content";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { LoadingState } from "./loading-state";

type DetailState =
  | { status: "selected"; item: ArticleDetailDto }
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "empty" };

export function ContentView({
  detailState,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList,
  onBackToList,
  isInboxSurface,
  selectedContentKey,
  articleStepDirection,
}: {
  detailState: DetailState;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList: boolean;
  onBackToList?: () => void;
  isInboxSurface: boolean;
  selectedContentKey?: string;
  articleStepDirection: 1 | -1;
}) {
  switch (detailState.status) {
    case "selected": {
      const content = (
        <ArticleContent
          item={detailState.item}
          density={density}
          fontSizePx={fontSizePx}
          showFavicons={showFavicons}
          timestampDisplay={timestampDisplay}
          timestampHourCycle={timestampHourCycle}
          showBackToList={showBackToList}
          onBackToList={onBackToList}
          isInboxSurface={isInboxSurface}
        />
      );

      return selectedContentKey ? (
        <AnimatedContent
          contentKey={selectedContentKey}
          articleStepDirection={articleStepDirection}
        >
          {content}
        </AnimatedContent>
      ) : (
        content
      );
    }
    case "loading":
      return <LoadingState />;
    case "error":
      return <ErrorState error={detailState.error} />;
    case "empty":
      return <EmptyState />;
  }
}
