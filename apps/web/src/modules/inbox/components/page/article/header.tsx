"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "@kyomi/ui/motion";
import type { ArticleDetailDto } from "@lib/schemas/index";
import { BackToInboxButton, SearchBar } from "@modules/inbox/components/list/header";
import { ReaderFontSizeControls } from "@modules/reader/components/toolbar";
import { useReaderToolbar } from "@hooks/use-toolbar";
import type { ToolbarModel } from "@modules/toolbar/lib/types";
import { ReaderToolbar } from "./toolbar";

const READER_HEADER_TOOLTIP_SIDE = "bottom";
const READER_HEADER_FONT_TOOLTIP_SIDE_OFFSET = 12;
const READER_HEADER_TOOLTIP_COLLISION_AVOIDANCE = {
  side: "shift",
  align: "shift",
  fallbackAxisSide: "none",
} as const;

const NAV_EXPANDED_STATE = { opacity: 1, scale: 1, filter: "blur(0px)" };

export function ArticleHeader({
  item,
  readerControlsCollapsed,
  onBackToList,
  onSelectPreviousItem,
  onSelectNextItem,
  canSelectPreviousItem,
  canSelectNextItem,
}: {
  item: ArticleDetailDto | null;
  readerControlsCollapsed?: boolean;
  onBackToList: () => void;
  onSelectPreviousItem?: () => void;
  onSelectNextItem?: () => void;
  canSelectPreviousItem?: boolean;
  canSelectNextItem?: boolean;
}) {
  if (!item) {
    return <ArticleHeaderShell onBackToList={onBackToList} />;
  }

  return (
    <SelectedArticleHeader
      item={item}
      readerControlsCollapsed={readerControlsCollapsed ?? false}
      onBackToList={onBackToList}
      onSelectPreviousItem={onSelectPreviousItem ?? (() => undefined)}
      onSelectNextItem={onSelectNextItem ?? (() => undefined)}
      canSelectPreviousItem={canSelectPreviousItem ?? false}
      canSelectNextItem={canSelectNextItem ?? false}
    />
  );
}

function ArticleHeaderShell({ onBackToList }: { onBackToList: () => void }) {
  return (
    <div
      className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 bg-transparent px-5.5 py-4.5 isolate"
      data-slot="inbox-article-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        <BackToInboxButton onClick={onBackToList} />
      </div>
      <SearchBar />
    </div>
  );
}

function SelectedArticleHeader({
  item,
  readerControlsCollapsed,
  onBackToList,
  onSelectPreviousItem,
  onSelectNextItem,
  canSelectPreviousItem,
  canSelectNextItem,
}: {
  item: ArticleDetailDto;
  readerControlsCollapsed: boolean;
  onBackToList: () => void;
  onSelectPreviousItem: () => void;
  onSelectNextItem: () => void;
  canSelectPreviousItem: boolean;
  canSelectNextItem: boolean;
}) {
  const toolbar = useReaderToolbar({ item, readerFocusMode: true, autoExtract: false });
  const prefersReducedMotion = useReducedMotion();
  const scopeControlTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.28, bounce: 0 };
  const navCollapsedState = prefersReducedMotion
    ? undefined
    : { opacity: 0, scale: 0.96, filter: "blur(4px)" };

  return (
    <div
      className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 bg-transparent px-5.5 py-4.5 isolate"
      data-slot="inbox-article-header"
    >
      <LazyMotion features={domAnimation}>
        <m.div
          layout
          className="flex min-w-0 items-center gap-2"
          transition={scopeControlTransition}
        >
          <SelectedHeaderControls
            toolbar={toolbar}
            readerControlsCollapsed={readerControlsCollapsed}
            onBackToList={onBackToList}
          />
        </m.div>
        <m.div
          layout
          className="flex min-w-0 flex-1 items-center justify-end gap-2"
          transition={scopeControlTransition}
        >
          <m.div
            layout
            className="flex min-w-0 flex-1 justify-end"
            transition={scopeControlTransition}
          >
            <SearchBar />
          </m.div>
          <AnimatePresence initial={false} mode="popLayout">
            {!readerControlsCollapsed ? (
              <m.div
                key="article-navigation"
                initial={navCollapsedState}
                animate={NAV_EXPANDED_STATE}
                exit={navCollapsedState}
                className="flex w-21 shrink-0 origin-right justify-end overflow-hidden will-change-[opacity,filter,transform]"
                transition={scopeControlTransition}
              >
                <ReaderToolbar
                  variant="navigation"
                  canSelectPreviousItem={canSelectPreviousItem}
                  canSelectNextItem={canSelectNextItem}
                  onSelectPreviousItem={onSelectPreviousItem}
                  onSelectNextItem={onSelectNextItem}
                />
              </m.div>
            ) : null}
          </AnimatePresence>
        </m.div>
      </LazyMotion>
    </div>
  );
}

function SelectedHeaderControls({
  toolbar,
  readerControlsCollapsed,
  onBackToList,
}: {
  toolbar: ToolbarModel;
  readerControlsCollapsed: boolean;
  onBackToList: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };

  return (
    <>
      <m.div layout transition={transition}>
        <BackToInboxButton onClick={onBackToList} />
      </m.div>
      <ReaderToolbar
        collapsed={readerControlsCollapsed}
        toolbar={toolbar}
        tooltipCollisionAvoidance={READER_HEADER_TOOLTIP_COLLISION_AVOIDANCE}
        tooltipSide={READER_HEADER_TOOLTIP_SIDE}
      />
      <m.div layout transition={transition}>
        <ReaderFontSizeControls
          canDecreaseFont={toolbar.toolbarProps.canDecreaseFont}
          canIncreaseFont={toolbar.toolbarProps.canIncreaseFont}
          fontSizePx={toolbar.toolbarProps.fontSizePx}
          onDecreaseFontSize={toolbar.toolbarProps.onDecreaseFontSize}
          onIncreaseFontSize={toolbar.toolbarProps.onIncreaseFontSize}
          tooltipCollisionAvoidance={READER_HEADER_TOOLTIP_COLLISION_AVOIDANCE}
          tooltipSide={READER_HEADER_TOOLTIP_SIDE}
          tooltipSideOffset={READER_HEADER_FONT_TOOLTIP_SIDE_OFFSET}
        />
      </m.div>
    </>
  );
}
