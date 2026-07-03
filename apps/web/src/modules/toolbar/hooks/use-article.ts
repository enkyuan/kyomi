"use client";

import { useCallback } from "react";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { useInboxItemStateMutation } from "@modules/inbox/hooks/use-inbox-data";
import type { ArticleActionItem } from "../lib/types";

export function useArticleActions({
  item,
  saveErrorScope,
}: {
  item: ArticleActionItem;
  saveErrorScope: string;
}) {
  const updateItemMutation = useInboxItemStateMutation();

  const toggleSaved = useCallback(() => {
    const nextSaved = !item.isSaved;
    const savePromise = updateItemMutation.mutateAsync({
      itemId: item.id,
      patch: { isSaved: nextSaved },
    });
    const toastId = toastManager.add({
      title: nextSaved ? "Saving article..." : "Removing from read later...",
      description: nextSaved ? "Adding this article to read later." : "Updating read later.",
      type: "loading",
      timeout: 0,
    });

    void savePromise
      .then(() => {
        toastManager.update(toastId, {
          title: nextSaved ? "Saved to read later" : "Removed from read later",
          description: nextSaved
            ? "This article is now in read later."
            : "This article was removed from read later.",
          type: nextSaved ? "success" : "info",
        });
      })
      .catch((error) => {
        logClientError(saveErrorScope, error);
        toastManager.update(toastId, {
          title: nextSaved ? "Unable to save article" : "Unable to update article",
          description: getUserSafeErrorMessage(error, "Try again in a moment."),
          type: "error",
        });
      });
  }, [item.id, item.isSaved, saveErrorScope, updateItemMutation]);

  return {
    isSaved: item.isSaved,
    copyLink: () => {
      void copyTextToClipboard(item.link).catch(() => undefined);
    },
    hide: (removeFromList = true) => {
      updateItemMutation.mutate({
        itemId: item.id,
        patch: { isHidden: true },
        removeFromList,
      });
    },
    openSource: (options?: { newTab?: boolean }) => {
      const newTab = options?.newTab ?? true;
      window.open(
        item.link,
        newTab ? "_blank" : "_self",
        newTab ? "noopener,noreferrer" : undefined,
      );
    },
    shareArticle: () => {
      void shareArticle(item).catch(() => undefined);
    },
    toggleSaved,
  };
}

async function shareArticle(item: ArticleActionItem) {
  const shareData: ShareData = {
    title: item.title,
    text: item.summary ?? item.feedTitle,
    url: item.link,
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    await navigator.share(shareData);
    return;
  }

  await copyTextToClipboard(item.link);
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back to the legacy copy path below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.position = "fixed";
  textarea.style.top = "0";

  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
