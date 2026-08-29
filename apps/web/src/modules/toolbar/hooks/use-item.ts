"use client";

import type { InboxItem } from "@modules/inbox/lib/articles/index";
import type { ItemToolbarModel } from "../lib/types";
import { useActions } from "./use-actions";

export function useItemToolbarModel({
  item,
  onReportBrokenArticle,
}: {
  item: InboxItem;
  onReportBrokenArticle?: () => void;
}): ItemToolbarModel {
  const articleActions = useActions({ item, saveErrorScope: "feed.item.saved_state" });

  return {
    toolbarProps: {
      isSaved: articleActions.isSaved,
      onCopyLink: articleActions.copyLink,
      onHide: () => articleActions.hide(true),
      onOpenSource: () => articleActions.openSource({ newTab: true }),
      onReportBrokenArticle: () => onReportBrokenArticle?.(),
      onShareArticle: articleActions.shareArticle,
      onToggleSaved: articleActions.toggleSaved,
    },
  };
}
