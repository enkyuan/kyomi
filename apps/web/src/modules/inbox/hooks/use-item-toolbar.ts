"use client";

import type { InboxItem } from "@modules/articles/lib/api";
import { useActions } from "@modules/articles/hooks/use-actions";
import type { ItemToolbarProps } from "../components/item/toolbar";

type ItemToolbarModel = {
  toolbarProps: ItemToolbarProps;
};

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
