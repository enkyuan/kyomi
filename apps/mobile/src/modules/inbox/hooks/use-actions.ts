import { useCallback, useEffect, useRef } from "react";
import { Linking, Share } from "react-native";
import { normalizeSafeHttpUrl } from "@kyomi/reader/core";
import { fetchMobileApiJson } from "@/lib/api";
import { toast } from "@ui/toast";
import { triggerSavedToggleHaptic } from "../lib/haptics";
import { useArticleStateMutation } from "@modules/inbox/hooks/use-state";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

function showActionError(message: string) {
  toast.error(message);
}

type ArticleStateMutation = ReturnType<typeof useArticleStateMutation>;

function createArticleActions(item: ArticleListItemDto, updateItem: ArticleStateMutation) {
  const toggleSaved = () => {
    const nextIsSaved = !item.isSaved;
    void triggerSavedToggleHaptic(nextIsSaved);

    void updateItem
      .mutateAsync({ itemId: item.id, patch: { isSaved: nextIsSaved } })
      .catch(() =>
        showActionError(item.isSaved ? "Couldn't unsave article" : "Couldn't save article"),
      );
  };

  // A publisher controls `link`, so only a web page is ever shared or launched; any other scheme
  // (tel:, itms-services:, another app's deep link) would run an app or a prompt the user did not
  // expect from "Open source".
  const shareArticle = () => {
    const link = normalizeSafeHttpUrl(item.link);
    if (!link) return;

    void Share.share({
      message: item.summary ? `${item.title}\n${item.summary}\n${link}` : `${item.title}\n${link}`,
      title: item.title,
      url: link,
    }).catch(() => undefined);
  };

  const openSource = () => {
    const link = normalizeSafeHttpUrl(item.link);
    if (!link) return;

    void Linking.openURL(link).catch(() => showActionError("Couldn't open the source"));
  };

  const hideArticle = () => {
    void updateItem
      .mutateAsync({ itemId: item.id, patch: { isHidden: true }, removeFromList: true })
      .catch(() => showActionError("Couldn't hide article"));
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
      .then(() => toast.success("Report sent"))
      .catch(() => showActionError("Couldn't send the report"));
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
