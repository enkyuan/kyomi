"use client";

import { layout, prepare } from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useNavigate } from "@tanstack/react-router";
import { Filter2Fill } from "@mingcute/react";
import { Route } from "@/routes/inbox/index";
import { FeedItem } from "@components/pages/inbox/feed-item";
import { InboxSourceRow } from "@components/pages/inbox/inbox-source-row";
import { ReaderContent } from "@components/reader/reader-content";
import { AppShell } from "@pages/app-shell";
import {
  extractInboxItemFullText,
  getInboxItemDetail,
  getInboxItems,
  type ReaderContentResponse,
} from "@lib/inbox-functions";
import { EmptyStateIcon } from "@components/icons/empty-state-svg";

import { ScrollAreaPrimitive, ScrollBar } from "@components/ui/scroll-area";
import { Skeleton } from "@components/ui/skeleton";

const MIN_LEFT_PERCENT = 26;
const MIN_RIGHT_PERCENT = 64;
const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";
const EMPTY_STATE_BODY_FONT = '400 14px "Inter Variable"';
const EMPTY_STATE_BODY_LINE_HEIGHT = 24;
const EMPTY_STATE_BODY_MAX_WIDTH = 360;
const EMPTY_STATE_BODY_MIN_WIDTH = 240;
const EMPTY_STATE_BODY_WIDTH_BUFFER = 56;
const FEED_ITEM_ROW_ESTIMATE = 176;

export function InboxPage() {
  const navigate = useNavigate();
  const { filter = "today", search, feedId, folderId, itemId } = Route.useSearch();
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const [leftPanelPercent, setLeftPanelPercent] = useState(32);
  const [isResizing, setIsResizing] = useState(false);
  const [listViewportHeight, setListViewportHeight] = useState(0);
  const [listContainerWidth, setListContainerWidth] = useState(0);
  const [hasListVerticalOverflow, setHasListVerticalOverflow] = useState(false);
  const selectedItemId = itemId;

  const inboxQuery = useQuery({
    queryKey: ["inbox", "items", filter, search, feedId, folderId],
    queryFn: () =>
      getInboxItems({
        data: {
          filter,
          search,
          feedId,
          folderId,
        },
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["inbox", "item-detail", selectedItemId],
    enabled: Boolean(selectedItemId),
    retry: 1,
    queryFn: () => {
      if (!selectedItemId) {
        throw new Error("Missing inbox item id");
      }
      return getInboxItemDetail({
        data: {
          itemId: selectedItemId,
        },
      });
    },
  });

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = splitContainerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const next = ((event.clientX - rect.left) / rect.width) * 100;
      const maxLeft = 100 - MIN_RIGHT_PERCENT;
      const clamped = Math.min(maxLeft, Math.max(MIN_LEFT_PERCENT, next));
      setLeftPanelPercent(clamped);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing]);

  const inboxItems = useMemo(
    () => dedupeInboxItems(Array.isArray(inboxQuery.data?.items) ? inboxQuery.data.items : []),
    [inboxQuery.data?.items],
  );
  const unreadCount = useMemo(
    () => inboxItems.reduce((count, item) => count + (item.isRead ? 0 : 1), 0),
    [inboxItems],
  );
  const selectedItem = detailQuery.data?.item ?? null;
  const isDetailLoading = detailQuery.isFetching;
  const isDetailError = detailQuery.isError;
  const virtualizer = useVirtualizer({
    count: inboxItems.length,
    getItemKey: (index) => inboxItems[index]?.id ?? index,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => FEED_ITEM_ROW_ESTIMATE,
    overscan: 6,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const showBottomSeparatorOnLastItem =
    inboxItems.length > 0 && virtualizer.getTotalSize() < listViewportHeight;

  const listContentHeight = virtualizer.getTotalSize();

  useEffect(() => {
    const viewport = listScrollRef.current;
    if (!viewport) {
      return;
    }

    const updateViewportMetrics = () => {
      setListViewportHeight(viewport.clientHeight);
      setListContainerWidth(viewport.clientWidth);
      setHasListVerticalOverflow(viewport.scrollHeight - viewport.clientHeight > 1);
    };

    updateViewportMetrics();

    const observer = new ResizeObserver(() => {
      updateViewportMetrics();
    });

    observer.observe(viewport);
    const rafId = window.requestAnimationFrame(updateViewportMetrics);
    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [inboxQuery.isLoading, inboxItems.length, listContentHeight]);

  return (
    <AppShell>
      <div
        ref={splitContainerRef}
        className="grid h-full max-h-full min-h-0 min-w-0 flex-1 gap-0 overflow-hidden"
        style={{
          gridTemplateColumns: `${leftPanelPercent}% 4px minmax(0, 1fr)`,
        }}
      >
        <section className="flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground md:min-h-0">
          <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-card">
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <span className="ps-1 font-medium text-muted-foreground text-sm tabular-nums">
                {unreadCount} unread
              </span>
              <button
                type="button"
                aria-label="Feed filters coming soon"
                className="inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Filter2Fill className="size-4" />
              </button>
            </div>
          </div>
          <ScrollAreaPrimitive.Root className="min-h-0 flex-1 overflow-hidden">
            <ScrollAreaPrimitive.Viewport
              ref={listScrollRef}
              className="h-full overflow-x-hidden outline-none data-has-overflow-y:overscroll-y-contain"
              data-slot="inbox-list-viewport"
            >
              <div className="min-h-full w-full pb-4">
                {inboxQuery.isLoading ? (
                  <ul className="w-full">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <li
                        key={`skeleton-${index}`}
                        className={`w-full border-x-0 border-border/70 bg-transparent${index === 0 ? "" : " border-t"}`}
                      >
                        {/* Source row zone */}
                        <div className="flex flex-col gap-2 px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Skeleton className="size-4.5 shrink-0 rounded-[3px]" />
                            <Skeleton className="h-3 w-24 rounded" />
                          </div>
                          {/* Title: 2 lines */}
                          <div className="space-y-1.5">
                            <Skeleton className="h-[18px] w-full rounded" />
                            <Skeleton className="h-[18px] w-3/4 rounded" />
                          </div>
                        </div>
                        {/* Summary: 3 lines */}
                        <div className="space-y-1.5 px-5">
                          <Skeleton className="h-3.5 w-full rounded" />
                          <Skeleton className="h-3.5 w-full rounded" />
                          <Skeleton className="h-3.5 w-4/5 rounded" />
                        </div>
                        {/* Timestamp */}
                        <div className="mt-2 px-5 pb-3">
                          <Skeleton className="h-3 w-28 rounded" />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : inboxItems.length === 0 ? (
                  <div className="min-h-72" />
                ) : (
                  <div
                    className="relative w-full"
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                    }}
                  >
                    {virtualItems.map((virtualRow) => {
                      const item = inboxItems[virtualRow.index];
                      if (!item) {
                        return null;
                      }
                      return (
                        <div
                          key={item.id}
                          className="absolute left-0 top-0 w-full"
                          data-index={virtualRow.index}
                          ref={(node) => {
                            if (node) {
                              virtualizer.measureElement(node);
                            }
                          }}
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <FeedItem
                            item={item}
                            isSelected={selectedItemId === item.id}
                            isFirst={virtualRow.index === 0}
                            containerWidth={listContainerWidth || undefined}
                            showBottomSeparator={
                              showBottomSeparatorOnLastItem &&
                              virtualRow.index === inboxItems.length - 1
                            }
                            onSelect={() => {
                              void navigate({
                                from: Route.fullPath,
                                search: (prev) => ({
                                  ...prev,
                                  itemId: item.id,
                                }),
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollAreaPrimitive.Viewport>
            {hasListVerticalOverflow ? <ScrollBar orientation="vertical" /> : null}
          </ScrollAreaPrimitive.Root>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          className="group flex h-full cursor-col-resize items-stretch justify-center"
          onPointerDown={(event) => {
            event.preventDefault();
            setIsResizing(true);
          }}
        >
          <div className="h-full w-px bg-transparent" />
        </div>

        <section className="flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground md:min-h-0">
          {selectedItem ? (
            <ScrollAreaPrimitive.Root className="min-h-0 flex-1 overflow-hidden">
              <ScrollAreaPrimitive.Viewport className="h-full overflow-x-hidden outline-none data-has-overflow-y:overscroll-y-contain">
                <div className="min-h-full px-4 md:px-8">
                  <ItemDetail item={selectedItem} />
                </div>
              </ScrollAreaPrimitive.Viewport>
              <ScrollBar orientation="vertical" />
            </ScrollAreaPrimitive.Root>
          ) : isDetailLoading ? (
            <div className="flex min-h-0 flex-1 flex-col gap-5 p-12">
              <div className="space-y-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-6 w-3/4 rounded" />
                <Skeleton className="h-6 w-1/2 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[94%] rounded" />
                <Skeleton className="h-4 w-[88%] rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[91%] rounded" />
                <Skeleton className="h-4 w-[85%] rounded" />
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-[96%] rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[90%] rounded" />
              </div>
            </div>
          ) : isDetailError ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <p className="text-base font-semibold text-foreground">Couldn&apos;t load article</p>
              <p className="text-sm text-muted-foreground">
                {detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "There was a problem loading this item."}
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
              <EmptyStateIcon className="size-40 shrink-0 sm:size-44" height={176} width={176} />
              <div className="w-full max-w-sm space-y-2">
                <p className="text-base font-semibold text-foreground">
                  Select an item to start reading
                </p>
                <BalancedEmptyStateBody text={EMPTY_STATE_BODY_COPY} />
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function dedupeInboxItems(items: Awaited<ReturnType<typeof getInboxItems>>["items"]) {
  const unique = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  }
  return [...unique.values()];
}

function BalancedEmptyStateBody({ text }: { text: string }) {
  const containerRef = useRef<HTMLParagraphElement | null>(null);
  const prepared = useMemo(() => prepare(text, EMPTY_STATE_BODY_FONT), [text]);
  const [maxWidth, setMaxWidth] = useState(EMPTY_STATE_BODY_MAX_WIDTH);

  useEffect(() => {
    const element = containerRef.current;
    const parent = element?.parentElement;
    if (!element || !parent) {
      return;
    }

    const updateWidth = () => {
      setMaxWidth(Math.min(EMPTY_STATE_BODY_MAX_WIDTH, parent.clientWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(parent);

    return () => {
      observer.disconnect();
    };
  }, []);

  const fittedWidth = useMemo(() => {
    if (maxWidth <= 0) {
      return undefined;
    }

    let low = EMPTY_STATE_BODY_MIN_WIDTH;
    let high = maxWidth;
    let best = maxWidth;
    let exactTwoLineWidth: number | undefined;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const { lineCount } = layout(prepared, mid, EMPTY_STATE_BODY_LINE_HEIGHT);

      if (lineCount === 2) {
        exactTwoLineWidth = mid;
        best = mid;
        high = mid - 1;
      } else if (lineCount < 2) {
        best = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return Math.min(maxWidth, (exactTwoLineWidth ?? best) + EMPTY_STATE_BODY_WIDTH_BUFFER);
  }, [maxWidth, prepared]);

  return (
    <p
      ref={containerRef}
      className="mx-auto text-sm leading-6 text-muted-foreground"
      style={fittedWidth ? { maxWidth: `${fittedWidth}px` } : undefined}
    >
      {text}
    </p>
  );
}

function estimateReadingTime(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 238));
}

/** Content sources that haven't gone through Readability — always extract. */
const UNEXTRACTED_SOURCES = new Set([null, "text_fallback", "feed_markdown", "feed_summary"]);

function ItemDetail({
  item,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getInboxItemDetail>>["item"]>;
}) {
  const [readerOverride, setReaderOverride] = useState<ReaderContentResponse | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    setReaderOverride(null);

    // Extract if the backend flagged it, OR if the content source is a raw
    // RSS text/markdown blob (no Readability-parsed HTML available yet).
    const needsExtraction =
      item.reader.shouldExtract || UNEXTRACTED_SOURCES.has(item.reader.contentSource);

    if (!needsExtraction) return;

    let cancelled = false;
    setIsExtracting(true);
    extractInboxItemFullText({ data: { itemId: item.id } })
      .then((result) => {
        if (cancelled) return;
        setReaderOverride(result.reader);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setReaderOverride({
          ...item.reader,
          notice: "Full preview unavailable right now.",
          contentStatus: item.reader.fallbackSummary ? "partial" : "failed",
          extractionErrorCode: "FETCH_FAILED",
          extractionErrorMessage:
            error instanceof Error ? error.message : "Failed to extract full text.",
          shouldExtract: false,
        });
      })
      .finally(() => {
        if (cancelled) return;
        setIsExtracting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.reader]);

  const reader = readerOverride ?? item.reader;

  const displayContent = reader.contentHtml ?? reader.contentMarkdown ?? reader.contentText ?? "";
  const readTime = displayContent ? estimateReadingTime(displayContent) : null;

  return (
    <article className="reader-content prose prose-neutral dark:prose-invert mx-auto max-w-3xl py-10 px-2">
      {/* Header */}
      <div className="not-prose mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span>{formatArticleTimestamp(item.publishedAt)}</span>
          {readTime && (
            <>
              <span>·</span>
              <span>{readTime} min read</span>
            </>
          )}
        </div>
        <p className="text-xl font-semibold text-foreground">{item.title}</p>
        <InboxSourceRow
          articleUrl={item.link}
          feedTitle={item.feedTitle}
          className=""
          labelClassName="text-sm"
        />
      </div>

      {/* Extraction loading state */}
      {isExtracting && (
        <div className="not-prose space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Extracting full text…
          </p>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[92%]" />
            <Skeleton className="h-4 w-[86%]" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[84%]" />
          </div>
        </div>
      )}

      {/* Article body */}
      {!isExtracting && <ReaderContent reader={reader} />}

      {/* Footer link */}
      <div className="not-prose mt-10 border-t border-border pt-6">
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          View original article →
        </a>
      </div>
    </article>
  );
}

function formatArticleTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
