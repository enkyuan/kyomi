"use client";

import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  controlSwapMotion,
  m,
  useReducedMotion,
  springTransition,
} from "@kyomi/ui/lib/motion";
import { useRef } from "react";
import type { InboxFilter, InboxSort } from "@modules/articles/lib/api";
import type { ArticleDetailDto } from "@kyomi/reader/schemas";
import {
  BackToInboxButton,
  DEFAULT_SORT,
  FilterControl,
  SortButton,
  type PinnedFolderFilter,
} from "./header";
import { Toolbar as ReaderToolbar } from "@modules/reader/components/toolbar";
import { useReaderToolbar } from "@modules/reader/hooks/use-toolbar";

function HeaderReaderToolbar({ item }: { item: ArticleDetailDto }) {
  const toolbar = useReaderToolbar({ item });

  return (
    <div className="relative inline-flex h-11 min-w-0 max-w-96 items-center overflow-hidden rounded-full bg-muted-solid px-1.5 text-base font-medium text-muted-foreground *:relative">
      <ReaderToolbar {...toolbar.toolbarProps} />
    </div>
  );
}

export function ListHeader({
  activeFolderId,
  backAction,
  feedLabel,
  filter,
  isArticleScoped,
  isLoading,
  pinnedFolders,
  selectedArticle,
  showScopedHeader,
  sort,
  onFilterChange,
  onFolderFilterChange,
  onSortChange,
}: {
  activeFolderId?: string;
  backAction?: () => void;
  feedLabel?: string;
  filter: InboxFilter;
  isArticleScoped: boolean;
  isLoading: boolean;
  pinnedFolders: PinnedFolderFilter[];
  selectedArticle?: ArticleDetailDto | null;
  showScopedHeader: boolean;
  sort?: InboxSort;
  onFilterChange: (filter: InboxFilter) => void;
  onFolderFilterChange?: (folderId: string) => void;
  onSortChange: (sort: InboxSort) => void;
}) {
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const listToolsRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const scopeControlTransition = springTransition("standard", prefersReducedMotion);
  const controlSwap = controlSwapMotion(prefersReducedMotion);

  return (
    <div
      ref={listHeaderRef}
      className="isolate sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 px-5.5 py-4.5"
      data-slot="inbox-list-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        <LazyMotion features={domAnimation}>
          <m.div className="inline-flex shrink-0">
            <AnimatePresence initial={false} mode="popLayout">
              {showScopedHeader && backAction ? (
                <m.div
                  key="scoped-header"
                  className="flex min-w-0 items-center gap-2"
                  {...controlSwap}
                  transition={scopeControlTransition}
                >
                  <BackToInboxButton onClick={backAction} />
                  {isArticleScoped && selectedArticle && !isLoading ? (
                    <HeaderReaderToolbar item={selectedArticle} />
                  ) : feedLabel ? (
                    <span className="relative inline-flex h-11 min-w-0 max-w-72 items-center overflow-hidden rounded-full bg-muted-solid px-4 text-base font-medium text-muted-foreground *:relative">
                      <span className="truncate">{feedLabel}</span>
                    </span>
                  ) : null}
                </m.div>
              ) : (
                <m.div
                  key="filter-tabs"
                  layout
                  {...controlSwap}
                  transition={scopeControlTransition}
                >
                  <FilterControl
                    activeFolderId={activeFolderId}
                    filter={filter}
                    pinnedFolders={pinnedFolders}
                    onFilterChange={onFilterChange}
                    onFolderFilterChange={onFolderFilterChange}
                  />
                </m.div>
              )}
            </AnimatePresence>
          </m.div>
        </LazyMotion>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end">
        <div ref={listToolsRef} className="flex min-w-0 max-w-full items-center justify-end gap-2">
          <LazyMotion features={domAnimation}>
            <AnimatePresence initial={false} mode="popLayout">
              {!isArticleScoped ? (
                <m.div
                  key="sort"
                  layout
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -8, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: -8, scale: 0.96 }}
                  transition={scopeControlTransition}
                >
                  <SortButton
                    sort={sort ?? DEFAULT_SORT}
                    anchor={listToolsRef}
                    onSortChange={onSortChange}
                  />
                </m.div>
              ) : null}
            </AnimatePresence>
          </LazyMotion>
        </div>
      </div>
    </div>
  );
}
