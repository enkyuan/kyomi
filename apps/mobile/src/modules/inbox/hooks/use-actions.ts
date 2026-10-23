import { useCallback, useEffect, useRef } from "react";
import { Alert, Linking, Share } from "react-native";
import { fetchMobileApiJson } from "@/lib/api";
import { triggerSavedToggleHaptic } from "../lib/haptics";
import { useArticleStateMutation } from "@modules/inbox/hooks/use-state";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

function showActionError(message: string) {
  Alert.alert("Unable to update article", message);
}

type ArticleStateMutation = ReturnType<typeof useArticleStateMutation>;

function createArticleActions(item: ArticleListItemDto, updateItem: ArticleStateMutation) {
  const toggleSaved = () => {
    const nextIsSaved = !item.isSaved;
    void triggerSavedToggleHaptic(nextIsSaved);

    void updateItem
      .mutateAsync({ itemId: item.id, patch: { isSaved: nextIsSaved } })
      .catch(() => showActionError(item.isSaved ? "Please try again." : "Unable to save article."));
  };

  const shareArticle = () => {
    void Share.share({
      message: item.summary
        ? `${item.title}\n${item.summary}\n${item.link}`
        : `${item.title}\n${item.link}`,
      title: item.title,
      url: item.link,
    }).catch(() => undefined);
  };

  const openSource = () => {
    void Linking.openURL(item.link).catch(() => showActionError("Unable to open the source."));
  };

  const hideArticle = () => {
    void updateItem
      .mutateAsync({ itemId: item.id, patch: { isHidden: true }, removeFromList: true })
      .catch(() => showActionError("Please try again."));
  };

  const reportBrokenArticle = () => {
    void fetchMobileApiJson<{ message: string }>(
      `/api/v1/articles/${encodeURIComponent(item.id)}/reports/broken`,
      {
        body: JSON.stringify({ reason: "broken_article" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    )
      .then(() => Alert.alert("Report sent", "Thanks for helping improve Kyomi."))
      .catch(() => showActionError("Unable to send the report."));
  };

  return { hideArticle, openSource, reportBrokenArticle, shareArticle, toggleSaved };
}

export function useArticleActions(item: ArticleListItemDto) {
  const updateItem = useArticleStateMutation();

  return { ...createArticleActions(item, updateItem), isUpdating: updateItem.isPending };
}

export type ArticleRowAction = "hide" | "openSource" | "report" | "share" | "toggleSaved";

/**
 * Actions for a native list, which reports `(id, action)` instead of rendering one React toolbar
 * per row. Items and the mutation are read through refs so the handler stays stable across pages.
 */
export function useArticleRowActions(items: readonly ArticleListItemDto[]) {
  const updateItem = useArticleStateMutation();
  const itemsRef = useRef(items);
  const mutationRef = useRef(updateItem);

  useEffect(() => {
    itemsRef.current = items;
    mutationRef.current = updateItem;
  });

  return useCallback((id: string, action: ArticleRowAction) => {
    const item = itemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;

    const actions = createArticleActions(item, mutationRef.current);
    switch (action) {
      case "hide":
        return actions.hideArticle();
      case "openSource":
        return actions.openSource();
      case "report":
        return actions.reportBrokenArticle();
      case "share":
        return actions.shareArticle();
      case "toggleSaved":
        return actions.toggleSaved();
    }
  }, []);
}
