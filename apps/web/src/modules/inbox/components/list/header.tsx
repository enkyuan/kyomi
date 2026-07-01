"use client";

import {
  SegmentedControl,
  SegmentedControlList,
  SegmentedControlTab,
} from "@kyomi/ui/segmented-control";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "@kyomi/ui/menu";
import { Badge } from "@kyomi/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import {
  DownFill,
  BookmarkFill,
  HistoryFill,
  SearchLine,
  CloseLine,
  SortDescendingFill,
  SortAscendingFill,
  InboxFill,
  type IconProps,
} from "@mingcute/react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState, type ComponentType, type RefObject } from "react";
import type { InboxFilter, InboxSort } from "@modules/inbox/services/api";

const ALL_FILTER_GROUP: InboxFilter[] = ["all", "saved", "recent"];

const ALL_FILTER_MENU: {
  value: InboxFilter;
  label: string;
  icon: ComponentType<IconProps>;
}[] = [
  { value: "saved", label: "Saved", icon: BookmarkFill },
  { value: "recent", label: "Recent", icon: HistoryFill },
];

const SORT_MENU: {
  value: InboxSort;
  label: string;
  icon: ComponentType<IconProps>;
}[] = [
  { value: "newest", label: "Newest", icon: SortDescendingFill },
  { value: "oldest", label: "Oldest", icon: SortAscendingFill },
  { value: "unread-first", label: "Unread first", icon: InboxFill },
];

export const DEFAULT_SORT: InboxSort = "newest";

function formatFilterCount(count: number | undefined | null): string | null {
  if (count === undefined || count === null || count <= 0) {
    return null;
  }
  if (count > 999) {
    return "999+";
  }
  return String(count);
}

export function FilterControl({
  filter,
  onFilterChange,
  filterCounts,
}: {
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  filterCounts?: Partial<Record<InboxFilter, number>>;
}) {
  const segmentedRef = useRef<HTMLDivElement | null>(null);
  const isAllGroupActive = ALL_FILTER_GROUP.includes(filter);
  const activeAllLabel = filter === "saved" ? "Saved" : filter === "recent" ? "Recent" : "All";
  const segmentValue: InboxFilter =
    filter === "today" ? "today" : isAllGroupActive ? filter : "all";

  return (
    <div ref={segmentedRef} className="inline-flex w-fit rounded-full bg-background">
      <SegmentedControl
        className="w-fit"
        value={segmentValue}
        onValueChange={(v) => onFilterChange(v as InboxFilter)}
      >
        <SegmentedControlList>
          <SegmentedControlTab value="today">My Feed</SegmentedControlTab>
          <SegmentedControlTab
            value={segmentValue === "today" ? "all" : segmentValue}
            className="gap-1.5 pe-2.5"
            render={<div />}
            nativeButton={false}
          >
            <span className="leading-none">{activeAllLabel}</span>
            <Menu>
              <MenuTrigger
                aria-label="Choose filter"
                className="-me-0.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center self-center rounded-full leading-none text-current outline-none transition-colors hover:bg-accent"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                }}
              >
                <DownFill className="size-3" />
              </MenuTrigger>
              <MenuPopup
                align="center"
                side="bottom"
                sideOffset={6}
                anchor={segmentedRef}
                className="w-(--anchor-width) min-w-(--anchor-width) rounded-[22px] p-1 before:rounded-[21px]"
              >
                {ALL_FILTER_MENU.map((item) => {
                  const Icon = item.icon;
                  const countLabel = formatFilterCount(filterCounts?.[item.value]);
                  return (
                    <MenuItem
                      key={item.value}
                      className="h-9 justify-between gap-2 rounded-full px-3 font-medium text-base sm:h-9 sm:text-base"
                      onClick={() => onFilterChange(item.value)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {countLabel ? (
                        <Badge variant="secondary" size="sm" className="rounded-full">
                          {countLabel}
                        </Badge>
                      ) : null}
                    </MenuItem>
                  );
                })}
              </MenuPopup>
            </Menu>
          </SegmentedControlTab>
        </SegmentedControlList>
      </SegmentedControl>
    </div>
  );
}

export function SearchBar() {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.32, bounce: 0 };

  const open = useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const close = useCallback(() => {
    setValue("");
    setExpanded(false);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        layout
        initial={false}
        animate={{ width: expanded ? 420 : 44 }}
        transition={transition}
        className="relative flex h-11 shrink-0 items-center overflow-hidden rounded-full bg-background text-muted-foreground will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
      >
        <button
          type="button"
          aria-label="Search"
          aria-expanded={expanded}
          onClick={expanded ? undefined : open}
          tabIndex={expanded ? -1 : 0}
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-current outline-none transition-colors hover:text-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
        >
          <SearchLine className="size-5" />
        </button>
        <AnimatePresence initial={false}>
          {expanded ? (
            <m.div
              key="search-input"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
              className="flex min-w-0 flex-1 items-center gap-1 pe-1"
            >
              <input
                ref={inputRef}
                type="search"
                aria-label="Search inbox"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                  }
                }}
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={close}
                className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-flex size-5 items-center justify-center rounded-full transition-colors hover:bg-accent">
                  <CloseLine className="size-4" />
                </span>
              </button>
            </m.div>
          ) : null}
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  );
}

function SortMenuItem({
  icon: Icon,
  label,
  active,
  onSelect,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <MenuItem
      closeOnClick={false}
      onClick={(event) => {
        event.preventDefault();
        onSelect();
      }}
      data-active={active || undefined}
      className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-xl px-3 font-medium text-base text-muted-foreground sm:h-9 sm:text-base data-highlighted:bg-transparent data-highlighted:text-foreground/70 data-active:bg-background data-active:text-foreground data-active:shadow-sm/8 data-active:data-highlighted:bg-background data-active:data-highlighted:text-foreground"
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </MenuItem>
  );
}

export function SortButton({
  sort,
  anchor,
}: {
  sort: InboxSort;
  anchor?: RefObject<HTMLDivElement | null>;
}) {
  const navigate = useNavigate();

  const activeLabel = SORT_MENU.find((item) => item.value === sort)?.label ?? "Newest";

  const updateSort = (next: InboxSort) => {
    void navigate({
      from: "/inbox/",
      search: (prev) => ({
        ...prev,
        sort: next === DEFAULT_SORT ? undefined : next,
      }),
    });
  };

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label="Sort"
            className="relative inline-flex h-11 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-full bg-background px-4 pe-3 font-medium text-base text-muted-foreground outline-none transition-colors hover:text-foreground/70 data-[popup-open]:text-foreground focus-visible:ring-2 focus-visible:ring-ring before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
          />
        }
      >
        <span className="leading-none">{activeLabel}</span>
        <span className="-me-0.5 inline-flex size-5 shrink-0 items-center justify-center self-center rounded-full leading-none transition-colors hover:bg-accent">
          <DownFill className="size-3" />
        </span>
      </MenuTrigger>
      <MenuPopup
        align="end"
        sideOffset={6}
        anchor={anchor}
        className="w-(--anchor-width) min-w-(--anchor-width) rounded-2xl p-1 before:rounded-[15px]"
      >
        {SORT_MENU.map((item) => (
          <SortMenuItem
            key={item.value}
            icon={item.icon}
            label={item.label}
            active={sort === item.value}
            onSelect={() => updateSort(item.value)}
          />
        ))}
      </MenuPopup>
    </Menu>
  );
}
