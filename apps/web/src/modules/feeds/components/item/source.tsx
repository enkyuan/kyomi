"use client";

import { FeedFavicon } from "@modules/sidebar/components/feed-favicon";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@kyomi/ui/preview-card";
import { getFeedSourceLabel } from "@modules/inbox/utils/source-label";
import type { InboxSearch } from "@/routes/_app/inbox/-route-helpers";
import { cn } from "@kyomi/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { m } from "motion/react";
import type { CSSProperties } from "react";

type SourceProps = {
  articleUrl: string;
  feedId?: string;
  feedFaviconUrl?: string | null;
  feedUrl?: string | null;
  feedSiteUrl?: string | null;
  feedTitle: string;
  showFavicon?: boolean;
  className?: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  iconClassName?: string;
  enablePreview?: boolean;
  layoutId?: string;
  sharedSourceLayoutId?: string;
};

export function Source({
  articleUrl,
  feedId,
  feedFaviconUrl,
  feedUrl,
  feedSiteUrl,
  feedTitle,
  showFavicon = true,
  className,
  labelClassName,
  labelStyle,
  iconClassName,
  enablePreview = true,
  layoutId,
  sharedSourceLayoutId,
}: SourceProps) {
  const sourceLabel = getFeedSourceLabel(articleUrl, feedTitle);
  const label = (
    <span
      className={cn(
        "min-w-0 flex-1 truncate text-xs font-medium tracking-[0.015em] text-muted-foreground/95",
        labelClassName,
      )}
      style={labelStyle}
    >
      {sourceLabel}
    </span>
  );

  const content = (
    <>
      {showFavicon ? (
        <FeedFavicon
          className={cn("size-4 shrink-0 rounded-[3px] bg-card/85", iconClassName)}
          faviconUrl={feedFaviconUrl}
          feedUrl={feedUrl ?? articleUrl}
          shape="squircle"
          siteUrl={feedSiteUrl ?? null}
          squircleCornerRadius={5}
          title={feedTitle}
        />
      ) : null}
      {enablePreview ? (
        <PreviewCard>
          <PreviewCardTrigger render={label}>{sourceLabel}</PreviewCardTrigger>
          <PreviewCardPopup align="start" className="w-72 gap-0 p-3">
            <div className="flex flex-col gap-1.5">
              <h4 className="truncate font-medium text-sm">{sourceLabel}</h4>
              <p className="line-clamp-2 text-muted-foreground text-xs">{feedTitle}</p>
              <p className="break-all text-muted-foreground/90 text-xs">{articleUrl}</p>
            </div>
          </PreviewCardPopup>
        </PreviewCard>
      ) : (
        label
      )}
    </>
  );
  const interactiveContent = feedId ? (
    <Link
      aria-label={`Open ${sourceLabel} feed`}
      className="flex min-w-0 flex-1 items-center gap-[inherit] rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={(event) => event.stopPropagation()}
      search={(prev: InboxSearch) => ({
        ...prev,
        filter: "all" as const,
        feedId,
        folderId: undefined,
        itemId: undefined,
        search: undefined,
      })}
      to="/inbox"
    >
      {content}
    </Link>
  ) : (
    content
  );

  return (
    <m.div
      layoutId={layoutId}
      className={cn("flex w-full min-w-0 items-center gap-2.5", className)}
      transition={{ type: "spring", duration: 0.28, bounce: 0 }}
    >
      {sharedSourceLayoutId ? (
        <m.div
          layoutId={sharedSourceLayoutId}
          className="flex min-w-0 flex-1 items-center gap-[inherit]"
          transition={{ type: "spring", duration: 0.28, bounce: 0 }}
        >
          {interactiveContent}
        </m.div>
      ) : (
        interactiveContent
      )}
    </m.div>
  );
}
