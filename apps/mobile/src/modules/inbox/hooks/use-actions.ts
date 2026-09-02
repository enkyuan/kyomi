import { Alert, Linking, Share } from "react-native";
import { fetchMobileApiJson } from "@/lib/api";
import { triggerSavedToggleHaptic } from "@/utils/haptics";
import { useArticleStateMutation } from "@modules/inbox/hooks/use-state";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";

function showActionError(message: string) {
  Alert.alert("Unable to update article", message);
}

export function useArticleActions(item: ArticleListItemDto) {
  const updateItem = useArticleStateMutation();

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

  return {
    hideArticle,
    isUpdating: updateItem.isPending,
    openSource,
    reportBrokenArticle,
    shareArticle,
    toggleSaved,
  };
}
