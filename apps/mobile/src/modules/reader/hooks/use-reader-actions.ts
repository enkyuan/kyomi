import { Alert, Linking, Share } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMobileApiJson } from "@/lib/api";
import { useArticleStateMutation } from "@modules/inbox/hooks/use-article-state";
import { triggerSavedToggleHaptic } from "@utils/haptics";
import { readerArticleQueryKey } from "./use-reader-article";
import type { ReaderArticle } from "../lib/article";

function showActionError(message: string) {
  Alert.alert("Unable to update article", message);
}

export function useReaderActions(article: ReaderArticle | undefined) {
  const queryClient = useQueryClient();
  const updateItem = useArticleStateMutation();

  const toggleSaved = () => {
    if (!article) {
      return;
    }

    const nextIsSaved = !article.isSaved;
    const queryKey = readerArticleQueryKey(article.id);
    const previousArticle = queryClient.getQueryData<ReaderArticle>(queryKey);

    void triggerSavedToggleHaptic(nextIsSaved);
    queryClient.setQueryData<ReaderArticle>(queryKey, (current) =>
      current ? { ...current, isSaved: nextIsSaved } : current,
    );

    void updateItem
      .mutateAsync({ itemId: article.id, patch: { isSaved: nextIsSaved } })
      .catch(() => {
        queryClient.setQueryData(queryKey, previousArticle);
        showActionError(nextIsSaved ? "Unable to save article." : "Please try again.");
      });
  };

  const shareArticle = () => {
    if (!article) {
      return;
    }

    void Share.share({
      message: article.summary
        ? `${article.title}\n${article.summary}\n${article.link}`
        : `${article.title}\n${article.link}`,
      title: article.title,
      url: article.link,
    }).catch(() => undefined);
  };

  const openSource = () => {
    if (!article) {
      return;
    }

    void Linking.openURL(article.link).catch(() => showActionError("Unable to open the source."));
  };

  return {
    isUpdating: updateItem.isPending,
    openSource,
    shareArticle,
    toggleSaved,
  };
}
