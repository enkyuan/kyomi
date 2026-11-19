"use client";

import { BookmarkFilledIcon } from "@kyomi/ui/icons/blode";
import { CommandItem } from "@kyomi/ui/components/command";
import { FeedFavicon } from "@modules/feeds/components/favicon";
import type { InboxItem } from "@modules/articles/lib/api";
import { formatRelativeTime, formatViewedCount } from "../../lib/recap/index";
import { matchesRecapTerm } from "../../lib/recap/command-query";
import type { RecapSavedItem, RecapTopViewedFeed } from "../../lib/recap/types";
import { Group } from "./manage-folders";

type Run = (action: () => void) => () => void;

const META = "ms-auto shrink-0 font-normal text-muted-foreground text-xs tabular-nums";

/** The rail's Top Sources card as a command page: a row per source, opening its feed. */
export function TopSourcesPage({
  feeds,
  onOpenFeed,
  run,
  term,
}: {
  feeds: RecapTopViewedFeed[];
  onOpenFeed: (feed: RecapTopViewedFeed) => void;
  run: Run;
  term: string;
}) {
  const rows = feeds.filter((feed) => matchesRecapTerm(feed.title, term));
  return rows.length > 0 ? (
    <Group label="Top sources">
      {rows.map((feed) => (
        <CommandItem
          key={feed.feedId}
          value={`source-${feed.feedId}`}
          onSelect={run(() => onOpenFeed(feed))}
        >
          <FeedFavicon
            className="size-5 shrink-0"
            faviconUrl={feed.faviconUrl}
            feedUrl={feed.url}
            shape="squircle"
            siteUrl={feed.siteUrl}
            squircleCornerRadius={5}
            title={feed.title}
          />
          <span className="min-w-0 truncate">{feed.title}</span>
          <span className={META}>{formatViewedCount(feed.viewedItemCount)}</span>
        </CommandItem>
      ))}
    </Group>
  ) : null;
}

type ArticleRow = { id: string; meta: string; title: string };

function ArticlesPage({
  icon,
  label,
  onOpen,
  rows,
  run,
  term,
}: {
  icon?: React.ReactNode;
  label: string;
  onOpen: (id: string) => void;
  rows: ArticleRow[];
  run: Run;
  term: string;
}) {
  const visible = rows.filter((row) => matchesRecapTerm(row.title, term));
  return visible.length > 0 ? (
    <Group label={label}>
      {visible.map((row) => (
        <CommandItem key={row.id} value={`${label}-${row.id}`} onSelect={run(() => onOpen(row.id))}>
          {icon}
          <span className="min-w-0 truncate">{row.title}</span>
          <span className={META}>{row.meta}</span>
        </CommandItem>
      ))}
    </Group>
  ) : null;
}

/** The rail's Worth revisiting card as a command page. */
export function WorthRevisitingPage({
  items,
  onOpen,
  run,
  term,
}: {
  items: RecapSavedItem[];
  onOpen: (item: RecapSavedItem) => void;
  run: Run;
  term: string;
}) {
  return (
    <ArticlesPage
      icon={<BookmarkFilledIcon className="kyomi-command-item-icon" />}
      label="Worth revisiting"
      rows={items.map((item) => ({
        id: item.id,
        meta: formatRelativeTime(item.savedAt),
        title: item.title,
      }))}
      run={run}
      term={term}
      onOpen={(id) => {
        const item = items.find((candidate) => candidate.id === id);
        if (item) {
          onOpen(item);
        }
      }}
    />
  );
}

/** The rail's Continue reading card as a command page. */
export function ContinueReadingPage({
  items,
  onOpen,
  run,
  term,
}: {
  items: InboxItem[];
  onOpen: (item: InboxItem) => void;
  run: Run;
  term: string;
}) {
  return (
    <ArticlesPage
      label="Continue reading"
      rows={items.map((item) => ({ id: item.id, meta: item.feedTitle, title: item.title }))}
      run={run}
      term={term}
      onOpen={(id) => {
        const item = items.find((candidate) => candidate.id === id);
        if (item) {
          onOpen(item);
        }
      }}
    />
  );
}
