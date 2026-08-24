"use client";

import type { InboxDensityDto, InboxTimestampDisplayDto } from "@kyomi/reader/schemas";
import type { ArticleStepDirection, ReaderDetailState } from "@modules/reader/lib/detail";
import { EmptyState } from "../states/empty";
import { ErrorState } from "../states/error";
import { LoadingState } from "../states/loading";
import { AnimatedContent } from "./animated";
import { ArticleContent } from "./article";

export function ContentView({
  detailState,
  density,
  fontSizePx,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList,
  onBackToList,
  isBrowserSurface,
  selectedContentKey,
  articleStepDirection,
}: {
  detailState: ReaderDetailState;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList: boolean;
  onBackToList?: () => void;
  isBrowserSurface: boolean;
  selectedContentKey?: string;
  articleStepDirection: ArticleStepDirection;
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
          isBrowserSurface={isBrowserSurface}
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
