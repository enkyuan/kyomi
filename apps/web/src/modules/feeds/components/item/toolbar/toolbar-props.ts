import type { CSSProperties } from "react";

export type ToolbarProps = {
  className?: string;
  style?: CSSProperties;
  isSaved: boolean;
  onOpenAi?: () => void;
  onCopyLink: () => void;
  onHide: () => void;
  onOpenSource: () => void;
  onReportBrokenArticle: () => void;
  onShareArticle: () => void;
  onToggleSaved: () => void;
  presentation?: "row" | "articleHeader";
};
