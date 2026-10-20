import type React from "react";
import type { ArticleDetailDto } from "@kyomi/reader/schemas";
import type { AnchoredToolbarAction, ToolbarSide } from "@modules/articles/lib/types";
import type { ReaderMode } from "./mode";
import type { ReaderContentWidth } from "./preferences";

export type ToolbarProps = {
  isSaved: boolean;
  activeMode: ReaderMode;
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
