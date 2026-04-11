"use client";

import { FeedFavicon } from "@components/navigation/feed-favicon";
import { getFeedSourceLabel } from "@lib/feed-source-label";
import { cn } from "@lib/utils";

type InboxSourceRowProps = {
  articleUrl: string;
  feedTitle: string;
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
};

export function InboxSourceRow({
  articleUrl,
  feedTitle,
  className,
  labelClassName,
  iconClassName,
}: InboxSourceRowProps) {
  return (
    <div className={cn("flex w-full min-w-0 items-center gap-2", className)}>
      <span className="inline-flex size-4.5 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-muted">
        <FeedFavicon
          className={cn("size-4 shrink-0 rounded-[inherit]", iconClassName)}
          feedUrl={articleUrl}
          siteUrl={articleUrl}
          title={feedTitle}
        />
      </span>
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-[12px] font-medium tracking-[0.015em] text-muted-foreground/85",
          labelClassName,
        )}
      >
        {getFeedSourceLabel(articleUrl, feedTitle)}
      </p>
    </div>
  );
}
