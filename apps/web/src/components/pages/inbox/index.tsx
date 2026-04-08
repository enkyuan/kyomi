"use client";

import { layout, prepare } from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Filter2Fill } from "@mingcute/react";
import { Route } from "@/routes/inbox/index";
import { AppShell } from "@pages/app-shell";
import { getInboxItemDetail, getInboxItems } from "@lib/inbox-functions";
import { cn } from "@lib/utils";
import { EmptyStateIcon } from "@components/icons/empty-state-svg";
import { Checkbox } from "@components/ui/checkbox";
import { Separator } from "@components/ui/separator";

const MIN_LEFT_PERCENT = 30;
const MIN_RIGHT_PERCENT = 60;
const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";
const EMPTY_STATE_BODY_FONT = '400 14px "Inter Variable"';
const EMPTY_STATE_BODY_LINE_HEIGHT = 24;
const EMPTY_STATE_BODY_MAX_WIDTH = 360;
const EMPTY_STATE_BODY_MIN_WIDTH = 240;
const EMPTY_STATE_BODY_WIDTH_BUFFER = 56;

export function InboxPage() {
  const navigate = useNavigate();
  const { filter = "today", search, itemId } = Route.useSearch();
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [leftPanelPercent, setLeftPanelPercent] = useState(32);
  const [isResizing, setIsResizing] = useState(false);
  const selectedItemId = itemId;

  const inboxQuery = useQuery({
    queryKey: ["inbox", "items", filter, search],
    queryFn: () =>
      getInboxItems({
        data: {
          filter,
          search,
        },
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["inbox", "item-detail", selectedItemId],
    enabled: Boolean(selectedItemId),
    queryFn: () =>
      getInboxItemDetail({
        data: {
          itemId: selectedItemId!,
        },
      }),
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
    () => (Array.isArray(inboxQuery.data?.items) ? inboxQuery.data.items : []),
    [inboxQuery.data?.items],
  );
  const selectedItem = detailQuery.data?.item ?? null;

  return (
    <AppShell>
      <div
        ref={splitContainerRef}
        className="grid h-full min-h-0 min-w-0 gap-0"
        style={{
          gridTemplateColumns: `${leftPanelPercent}% 4px minmax(0, 1fr)`,
        }}
      >
        <section className="flex min-h-80 min-w-0 flex-col rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground md:min-h-0">
          <div className="flex items-center justify-between gap-3 ps-3 pe-2 py-2">
            <Checkbox aria-label="Select inbox items" />
            <button
              type="button"
              aria-label="Feed filters coming soon"
              className="inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <Filter2Fill className="size-4" />
            </button>
          </div>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {inboxItems.length === 0 ? (
              <div className="min-h-72" />
            ) : (
              <ul className="flex flex-col gap-3">
                {inboxItems.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "cursor-pointer rounded-lg border border-transparent p-3 transition-colors",
                      selectedItemId === item.id
                        ? "bg-background"
                        : "bg-background/60 hover:bg-background/80",
                    )}
                    onClick={() => {
                      void navigate({
                        to: "/inbox",
                        search: (prev) => ({
                          ...prev,
                          itemId: item.id,
                        }),
                      });
                    }}
                  >
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.feedTitle}</p>
                      </div>
                      <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {item.articleType}
                      </span>
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {item.summary || "No summary available."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatArticleTimestamp(item.publishedAt)}</span>
                      <span>{item.isRead ? "Read" : "Unread"}</span>
                      {item.isSaved ? <span>Saved</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          className="group flex cursor-col-resize items-stretch justify-center"
          onPointerDown={(event) => {
            event.preventDefault();
            setIsResizing(true);
          }}
        >
          <div className="h-full w-px bg-transparent" />
        </div>

        <section className="min-h-80 min-w-0 rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card p-4 text-card-foreground md:min-h-0">
          {selectedItem ? (
            <ItemDetail item={selectedItem} />
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

function ItemDetail({
  item,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getInboxItemDetail>>["item"]>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>{item.articleType}</span>
        <span>{formatArticleTimestamp(item.publishedAt)}</span>
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">{item.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{item.feedTitle}</p>
      </div>
      <p className="text-sm text-muted-foreground">{item.summary || "No summary available."}</p>
      {item.content ? <p className="text-sm leading-6 text-foreground/90">{item.content}</p> : null}
      <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-muted-foreground underline"
      >
        Open original article
      </a>
    </div>
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
