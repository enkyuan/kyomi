"use client";

import { FeedFavicon } from "@components/navigation/feed-favicon";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@components/ui/preview-card";
import { getFeedSourceLabel } from "@lib/feed-source-label";
import { cn } from "@lib/utils";
import type { CSSProperties } from "react";

type InboxSourceRowProps = {
  articleUrl: string;
  feedFaviconUrl?: string | null;
  feedTitle: string;
  showFavicon?: boolean;
  className?: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  iconClassName?: string;
};

export function InboxSourceRow({
  articleUrl,
  feedFaviconUrl,
  feedTitle,
  showFavicon = true,
  className,
  labelClassName,
  labelStyle,
  iconClassName,
}: InboxSourceRowProps) {
  const sourceLabel = getFeedSourceLabel(articleUrl, feedTitle);

  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2.5", className)}>
      {showFavicon ? (
        <FeedFavicon
          className={cn(
            "size-4 shrink-0 rounded-[3px] bg-card/85 ring-1 ring-border/55 shadow-[0_1px_0_0_color-mix(in_srgb,var(--foreground)_7%,transparent)]",
            iconClassName,
          )}
          faviconUrl={feedFaviconUrl}
          feedUrl={articleUrl}
          siteUrl={articleUrl}
          title={feedTitle}
        />
      ) : null}
      <PreviewCard>
        <PreviewCardTrigger
          render={
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[12px] font-medium tracking-[0.015em] text-muted-foreground/95",
                labelClassName,
              )}
              style={labelStyle}
            />
          }
        >
          {sourceLabel}
        </PreviewCardTrigger>
        <PreviewCardPopup align="start" className="w-72 gap-0 p-3">
          <div className="flex flex-col gap-1.5">
            <h4 className="truncate font-medium text-sm">{sourceLabel}</h4>
            <p className="line-clamp-2 text-muted-foreground text-xs">{feedTitle}</p>
            <p className="break-all text-muted-foreground/90 text-xs">{articleUrl}</p>
          </div>
        </PreviewCardPopup>
      </PreviewCard>
    </div>
  );
}
