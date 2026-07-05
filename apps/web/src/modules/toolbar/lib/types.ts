import type React from "react";
import type { ArticleDetailDto } from "@lib/schemas/index";
import type { InboxItem } from "@modules/inbox/lib/articles/index";
import type { ReaderContentWidth } from "@modules/reader/lib/preferences";

export type ToolbarMode = "original" | "extracted";
export type ToolbarSide = "top" | "bottom" | "left" | "right";
export type AnchoredToolbarActionOptions = {
  anchor?: HTMLElement | null;
  side?: ToolbarSide;
  sideOffset?: number;
};
export type AnchoredToolbarAction = (options?: AnchoredToolbarActionOptions) => void;

export type ToolbarProps = {
  isSaved: boolean;
  activeMode: ToolbarMode;
  extractedAvailable: boolean;
  contentWidth: ReaderContentWidth;
  fontSizePx: number;
  canDecreaseFont: boolean;
  canIncreaseFont: boolean;
  readerFocusMode?: boolean;
  onToggleSaved: AnchoredToolbarAction;
  onToggleMode: () => void;
  onCycleContentWidth: () => void;
  onDecreaseFontSize: () => void;
  onIncreaseFontSize: () => void;
  onTranslateArticle: () => void;
  onOpenOriginal: () => void;
  onOpenAi: () => void;
  onShareArticle: () => void;
  variant?: "inline" | "floating";
  controlSize?: "default" | "large";
  hideFontControls?: boolean;
  readerFocusVariant?: "full" | "compact";
  tooltipSide?: ToolbarSide;
  tooltipCollisionAvoidance?:
    | {
        side?: "flip" | "none";
        align?: "flip" | "shift" | "none";
        fallbackAxisSide?: "start" | "end" | "none";
      }
    | {
        side?: "shift" | "none";
        align?: "shift" | "none";
        fallbackAxisSide?: "start" | "end" | "none";
      };
};

export type ToolbarModel = {
  articleClassName: string;
  articleStyle: Record<string, string>;
  canRequestExtraction: boolean;
  displayReader: ArticleDetailDto["reader"]["selected"];
  extractPending: boolean;
  extractionError: string | null;
  inlineToolbarRef: React.RefObject<HTMLDivElement | null>;
  onRetryExtraction: () => void;
  openLinksInNewTab: boolean;
  showLinkPreviews: boolean;
  showFailedBanner: boolean;
  floatingToolbarEdge: "top" | "bottom";
  showFloatingToolbar: boolean;
  toolbarProps: ToolbarProps;
};

export type ArticleActionItem = Pick<
  InboxItem,
  "id" | "title" | "summary" | "feedTitle" | "link" | "isSaved"
>;
