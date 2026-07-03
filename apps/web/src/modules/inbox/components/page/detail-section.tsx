"use client";

import { useMemo, type ReactNode } from "react";
import { Detail, type DetailHeaderState } from "@modules/reader/components/detail";
import type { ArticleDetailDto } from "@lib/schemas/index";
import type { InboxPreferences } from "@modules/inbox/hooks/data";

export function DetailSection({
  preferences,
  detailError,
  isDetailError,
  isDetailFetching,
  selectedItem,
  clearSelectedItem,
  showBackToList,
  surface,
  header,
  articleContentKey,
  articleStepDirection,
}: {
  preferences: InboxPreferences;
  detailError: unknown;
  isDetailError: boolean;
  isDetailFetching: boolean;
  selectedItem: ArticleDetailDto | null;
  clearSelectedItem?: () => void;
  showBackToList?: boolean;
  surface?: "card" | "inbox";
  header?: ReactNode | ((state: DetailHeaderState) => ReactNode);
  articleContentKey?: string;
  articleStepDirection?: 1 | -1;
}) {
  const isDetailLoading = isDetailFetching && !selectedItem;

  const detailProps = useMemo(
    () => ({
      detailState: selectedItem
        ? ({ status: "selected", item: selectedItem } as const)
        : isDetailLoading
          ? ({ status: "loading" } as const)
          : isDetailError
            ? ({ status: "error", error: detailError } as const)
            : ({ status: "empty" } as const),
      density: preferences.inboxDensity,
      fontSizePx: preferences.inboxFontSizePx,
      showFavicons: preferences.inboxShowFavicons,
      timestampDisplay: preferences.inboxTimestampDisplay,
      timestampHourCycle: preferences.inboxTimestampHourCycle,
    }),
    [
      detailError,
      isDetailError,
      isDetailLoading,
      preferences.inboxDensity,
      preferences.inboxFontSizePx,
      preferences.inboxShowFavicons,
      preferences.inboxTimestampDisplay,
      preferences.inboxTimestampHourCycle,
      selectedItem,
    ],
  );

  return (
    <Detail
      {...detailProps}
      showBackToList={showBackToList}
      onBackToList={clearSelectedItem}
      surface={surface}
      header={header}
      articleContentKey={articleContentKey}
      articleStepDirection={articleStepDirection}
    />
  );
}
