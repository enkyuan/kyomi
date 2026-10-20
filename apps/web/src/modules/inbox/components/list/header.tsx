"use client";

import { ButtonGroup, ButtonLabel } from "@kyomi/ui/components/button";
import { Tabs, TabsList, TabsTab } from "@kyomi/ui/components/tabs";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@kyomi/ui/components/menu";
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
} from "@kyomi/ui/icons/mingcute";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "@kyomi/ui/lib/motion";
import { useCallback, useRef, useState, type ComponentType, type RefObject } from "react";
import type { InboxFilter, InboxSort } from "@modules/articles/lib/api";
import { cn } from "@kyomi/ui/lib/utils";
import { SplitSegment } from "./split";

const ALL_FILTER_GROUP: InboxFilter[] = ["all", "saved", "recent"];
const MAX_VISIBLE_FILTER_MENU_ITEMS = 4;

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
  { value: "latest", label: "Latest", icon: SortDescendingFill },
  { value: "oldest", label: "Oldest", icon: SortAscendingFill },
];

export const DEFAULT_SORT: InboxSort = "latest";

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
            className="justify-between gap-2"
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
      {pinnedFolderMenuItems.length > 0 ? <MenuSeparator className="bg-border/70" /> : null}
      {pinnedFolderMenuItems.map((folder) => (
        <MenuItem
          key={folder.id}
          className="min-w-0 justify-between gap-2"
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
      <Tabs
        className="w-fit"
        value={segmentValue}
        onValueChange={(v) => onFilterChange(v as InboxFilter)}
      >
        <TabsList
          className="has-[[data-variant=split][data-active]]:**:data-[slot=tab-indicator]:opacity-0 **:data-[slot=tab-indicator]:transition-[width,translate,opacity]"
          variant="pill"
        >
          <TabsTab value="my-feed">My Feed</TabsTab>
          <TabsTab
            value={segmentValue === "my-feed" ? "all" : segmentValue}
            className="[--split-fill:transparent] [--split-h:2.25rem] data-active:[--split-fill:var(--background)] gap-0.75 px-0"
            render={<ButtonGroup variant="split" />}
            nativeButton={false}
          >
            <SplitSegment className="ps-4 pe-1.5" edge="start" render={<span />}>
              <ButtonLabel className="max-w-32 *:min-w-0 *:truncate sm:max-w-44">
                {activeAllGroupLabel}
              </ButtonLabel>
            </SplitSegment>
            <Menu>
              <MenuTrigger
                render={
                  <SplitSegment
                    aria-label="Choose filter"
                    className="w-7.5 justify-end ps-0 pe-3"
                    edge="end"
                  />
                }
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") event.stopPropagation();
                }}
              >
                <DownFill className="mx-0 size-3" />
              </MenuTrigger>
              <MenuPopup
                align="center"
                side="bottom"
                sideOffset={6}
                anchor={segmentedRef}
                className="w-(--anchor-width) min-w-(--anchor-width) max-w-64"
                maxVisibleItems={shouldScrollMenu ? MAX_VISIBLE_FILTER_MENU_ITEMS : undefined}
                shape="pill"
                size="lg"
              >
                {menuItems}
              </MenuPopup>
            </Menu>
          </TabsTab>
        </TabsList>
      </Tabs>
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
        variant === "pill" && "bg-muted-solid",
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
      <div
        className={cn(
          "relative flex h-11 min-w-11 max-w-full items-center overflow-hidden rounded-full text-muted-foreground [&>*]:relative",
          expanded ? "w-[420px]" : "w-11",
          variant === "pill" && "bg-muted-solid",
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
      </div>
    </LazyMotion>
  );
}

function SortMenuItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  value: InboxSort;
}) {
  return (
    <MenuRadioItem
      className="cursor-pointer justify-start text-muted-foreground data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm/8 data-checked:data-highlighted:bg-accent data-checked:data-highlighted:text-accent-foreground"
      indicator="none"
      value={value}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </MenuRadioItem>
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
  const activeLabel = SORT_MENU.find((item) => item.value === sort)?.label ?? "Latest";

  return (
    <Menu>
      <MenuTrigger
        nativeButton={false}
        render={
          <ButtonGroup
            aria-label="Sort"
            className="[--split-fill:var(--muted-solid)] [--split-h:2.75rem] h-(--split-h) cursor-pointer select-none rounded-full font-medium text-base text-muted-foreground outline-none transition-colors hover:text-foreground/70 data-popup-open:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            variant="split"
          />
        }
      >
        <SplitSegment className="ps-4 pe-1.5" edge="start" render={<span />}>
          {activeLabel}
        </SplitSegment>
        <SplitSegment className="w-8.5 justify-end ps-0 pe-4" edge="end" render={<span />}>
          <DownFill className="mx-0 size-3" />
        </SplitSegment>
      </MenuTrigger>
      <MenuPopup
        align="end"
        sideOffset={6}
        anchor={anchor}
        className="w-(--anchor-width) min-w-(--anchor-width)"
        shape="pill"
        size="lg"
      >
        <MenuRadioGroup value={sort} onValueChange={(value: InboxSort) => onSortChange(value)}>
          {SORT_MENU.map((item) => (
            <SortMenuItem key={item.value} icon={item.icon} label={item.label} value={item.value} />
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
