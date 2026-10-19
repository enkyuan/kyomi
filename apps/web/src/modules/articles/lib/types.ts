import type { InboxItem } from "./api";

export type ToolbarSide = "top" | "bottom" | "left" | "right";
export type AnchoredToolbarActionOptions = {
  anchor?: HTMLElement | null;
  side?: ToolbarSide;
  sideOffset?: number;
};
export type AnchoredToolbarAction = (options?: AnchoredToolbarActionOptions) => void;

export type ArticleActionItem = Pick<
  InboxItem,
  "id" | "title" | "summary" | "feedTitle" | "link" | "isSaved"
>;
