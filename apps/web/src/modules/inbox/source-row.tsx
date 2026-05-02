"use client";

import { FeedFavicon } from "@components/navigation/feed-favicon";
import { getFeedSourceLabel } from "@lib/feed-source-label";
import { cn } from "@lib/utils";

type InboxSourceRowProps = {
  articleUrl: string;
  feedFaviconUrl?: string | null;
  feedTitle: string;
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
};

export function InboxSourceRow({
  articleUrl,
  feedFaviconUrl,
  feedTitle,
  className,
  labelClassName,
  iconClassName,
}: InboxSourceRowProps) {
  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2.5", className)}>
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
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-[12px] font-medium tracking-[0.015em] text-muted-foreground/95",
          labelClassName,
        )}
      >
        {getFeedSourceLabel(articleUrl, feedTitle)}
      </p>
    </div>
  );
}
