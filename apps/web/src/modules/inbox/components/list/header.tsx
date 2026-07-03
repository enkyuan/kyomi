"use client";

import {
  SegmentedControl,
  SegmentedControlList,
  SegmentedControlTab,
} from "@kyomi/ui/segmented-control";
import { Menu, MenuTrigger, MenuPopup, MenuItem } from "@kyomi/ui/menu";
import {
  ArrowLeftFill,
  DownFill,
  BookmarkFill,
  Folder2Fill,
  TimeDurationFill,
  SearchLine,
  CloseLine,
  SortDescendingFill,
  SortAscendingFill,
  type IconProps,
  AsteriskFill,
} from "@mingcute/react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState, type ComponentType, type RefObject } from "react";
import type { InboxFilter, InboxSort } from "@modules/inbox/lib/articles/index";
import { cn } from "@kyomi/ui/lib/utils";

const ALL_FILTER_GROUP: InboxFilter[] = ["all", "saved", "recent"];
const MAX_VISIBLE_FILTER_MENU_ITEMS = 4;
const FILTER_MENU_MAX_HEIGHT_CLASS =
  "!max-h-[min(calc(--spacing(9)*4+--spacing(4)+1px),var(--available-height))]";

export type PinnedFolderFilter = {
  id: string;
  name: string;
  isPinned: boolean;
  pinnedAt: string | null;
};

const ALL_FILTER_MENU: {
  value: InboxFilter;
  label: string;
  icon: ComponentType<IconProps>;
}[] = [
  { value: "all", label: "All", icon: AsteriskFill },
  { value: "saved", label: "Saved", icon: BookmarkFill },
  { value: "recent", label: "Recent", icon: TimeDurationFill },
];

const SORT_MENU: {
  value: InboxSort;
  label: string;
  icon: ComponentType<IconProps>;
}[] = [
  { value: "newest", label: "Newest", icon: SortDescendingFill },
  { value: "oldest", label: "Oldest", icon: SortAscendingFill },
];

export const DEFAULT_SORT: InboxSort = "newest";

const EMPTY_PINNED_FOLDERS: PinnedFolderFilter[] = [];

export function FilterControl({
  activeFolderId,
  filter,
  onFilterChange,
  onFolderFilterChange,
  pinnedFolders = EMPTY_PINNED_FOLDERS,
}: {
  activeFolderId?: string;
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  onFolderFilterChange?: (folderId: string) => void;
  pinnedFolders?: PinnedFolderFilter[];
}) {
  const segmentedRef = useRef<HTMLDivElement | null>(null);
  const activeFolder = activeFolderId
    ? pinnedFolders.find((folder) => folder.id === activeFolderId)
    : undefined;
  const isAllGroupActive = ALL_FILTER_GROUP.includes(filter);
  const segmentValue: InboxFilter =
    filter === "my-feed" ? "my-feed" : isAllGroupActive ? filter : "all";
  const activeAllGroupLabel =
    activeFolder?.name ??
    ALL_FILTER_MENU.find((item) => item.value === segmentValue)?.label ??
    "All";
  const shouldShowAllMenuItem =
    Boolean(activeFolder) || (segmentValue !== "all" && ALL_FILTER_GROUP.includes(segmentValue));
  const allGroupMenuItems = ALL_FILTER_MENU.filter(
    (item) =>
      (Boolean(activeFolder) || item.value !== segmentValue) &&
      (item.value !== "all" || shouldShowAllMenuItem),
  );
  const pinnedFolderMenuItems = pinnedFolders.filter((folder) => folder.id !== activeFolderId);
  const menuItemCount = allGroupMenuItems.length + pinnedFolderMenuItems.length;
  const shouldScrollMenu = menuItemCount > MAX_VISIBLE_FILTER_MENU_ITEMS;

  const menuItems = (
    <>
      {allGroupMenuItems.map((item) => {
        const Icon = item.icon;
        return (
          <MenuItem
            key={item.value}
            className="h-9 justify-between gap-2 rounded-full px-3 font-medium text-base sm:h-9 sm:text-base"
            onClick={(event) => {
              event.stopPropagation();
              onFilterChange(item.value);
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
          </MenuItem>
        );
      })}
      {pinnedFolderMenuItems.length > 0 ? (
        <hr className="mx-2 my-1 h-px border-0 bg-border/70" />
      ) : null}
      {pinnedFolderMenuItems.map((folder) => (
        <MenuItem
          key={folder.id}
          className="h-9 min-w-0 justify-between gap-2 rounded-full px-3 font-medium text-base sm:h-9 sm:text-base"
          onClick={(event) => {
            event.stopPropagation();
            onFolderFilterChange?.(folder.id);
          }}
        >
          <span className="flex min-w-0 max-w-full items-center gap-2">
            <Folder2Fill className="size-4 shrink-0" />
            <span className="min-w-0 max-w-32 truncate sm:max-w-44">{folder.name}</span>
          </span>
        </MenuItem>
      ))}
    </>
  );

  return (
    <div ref={segmentedRef} className="inline-flex w-fit rounded-full bg-background">
      <SegmentedControl
        className="w-fit"
        value={segmentValue}
        onValueChange={(v) => onFilterChange(v as InboxFilter)}
      >
        <SegmentedControlList>
          <SegmentedControlTab value="my-feed">My Feed</SegmentedControlTab>
          <SegmentedControlTab
            value={segmentValue === "my-feed" ? "all" : segmentValue}
            className="gap-1.5 pe-2.5"
            render={<div />}
            nativeButton={false}
          >
            <span className="max-w-32 truncate leading-none sm:max-w-44">
              {activeAllGroupLabel}
            </span>
            <Menu>
              <MenuTrigger
                aria-label="Choose filter"
                className="-me-0.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center self-center rounded-full leading-none text-current outline-none transition-colors hover:bg-accent"
                onPointerDown={(event) => event.stopPropagation()}
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
                className={cn(
                  "w-(--anchor-width) min-w-(--anchor-width) max-w-64 rounded-[22px] before:rounded-[21px]",
                  shouldScrollMenu && "overflow-hidden",
                )}
                contentClassName={shouldScrollMenu ? FILTER_MENU_MAX_HEIGHT_CLASS : undefined}
              >
                {menuItems}
              </MenuPopup>
            </Menu>
          </SegmentedControlTab>
        </SegmentedControlList>
      </SegmentedControl>
    </div>
  );
}

export function BackToInboxButton({
  onClick,
  variant = "pill",
}: {
  onClick: () => void;
  variant?: "pill" | "transparent";
}) {
  return (
    <button
      type="button"
      aria-label="Back to inbox"
      onClick={onClick}
      className={cn(
        "relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground/70 focus-visible:ring-2 focus-visible:ring-ring [&>*]:relative",
        variant === "pill" &&
          "bg-background before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted",
      )}
    >
      <ArrowLeftFill className="size-5" />
    </button>
  );
}

export function SearchBar({ variant = "pill" }: { variant?: "pill" | "transparent" }) {
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
        className={cn(
          "relative flex h-11 min-w-11 max-w-full items-center overflow-hidden rounded-full text-muted-foreground will-change-transform [&>*]:relative",
          variant === "pill" &&
            "bg-background before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted",
        )}
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
                className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
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
  onSortChange,
}: {
  sort: InboxSort;
  anchor?: RefObject<HTMLDivElement | null>;
  onSortChange: (sort: InboxSort) => void;
}) {
  const activeLabel = SORT_MENU.find((item) => item.value === sort)?.label ?? "Newest";

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
        className="w-(--anchor-width) min-w-(--anchor-width) rounded-2xl before:rounded-[15px]"
      >
        {SORT_MENU.map((item) => (
          <SortMenuItem
            key={item.value}
            icon={item.icon}
            label={item.label}
            active={sort === item.value}
            onSelect={() => onSortChange(item.value)}
          />
        ))}
      </MenuPopup>
    </Menu>
  );
}
