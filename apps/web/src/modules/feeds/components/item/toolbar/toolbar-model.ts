"use client";

import { toastManager } from "@kyomi/ui/toast";
import {
  useInboxItemStateMutation,
  type InboxItemPatch,
} from "@modules/inbox/hooks/use-inbox-data";
import type { InboxItem } from "@modules/inbox/services/api";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import type { ToolbarProps } from "./toolbar-props";

export type ToolbarModel = {
  toolbarProps: ToolbarProps;
};

export function useToolbarModel({
  item,
  onReportBrokenArticle,
}: {
  item: InboxItem;
  onReportBrokenArticle?: () => void;
}): ToolbarModel {
  const updateItemMutation = useInboxItemStateMutation();

  const updateItem = (patch: InboxItemPatch, removeFromList = false) => {
    updateItemMutation.mutate({ itemId: item.id, patch, removeFromList });
  };
  const toggleSaved = () => {
    const nextSaved = !item.isSaved;
    const savePromise = updateItemMutation.mutateAsync({
      itemId: item.id,
      patch: { isSaved: nextSaved },
    });

    void toastManager.promise(savePromise, {
      loading: {
        title: nextSaved ? "Saving article..." : "Removing from read later...",
        description: nextSaved ? "Adding this article to read later." : "Updating read later.",
        type: "loading",
        timeout: 0,
      },
      success: {
        title: nextSaved ? "Saved to read later" : "Removed from read later",
        description: nextSaved
          ? "This article is now in read later."
          : "This article was removed from read later.",
        type: nextSaved ? "success" : "info",
      },
      error: (error) => {
        logClientError("feed.item.saved_state", error);
        return {
          title: nextSaved ? "Unable to save article" : "Unable to update article",
          description: getUserSafeErrorMessage(error, "Try again in a moment."),
          type: "error",
        };
      },
    });
  };

  return {
    toolbarProps: {
      isSaved: item.isSaved,
      onCopyLink: () => {
        void copyTextToClipboard(item.link).catch(() => undefined);
      },
      onHide: () => updateItem({ isHidden: true }, true),
      onOpenSource: () => {
        window.open(item.link, "_blank", "noopener,noreferrer");
      },
      onReportBrokenArticle: () => {
        onReportBrokenArticle?.();
      },
      onShareArticle: () => {
        void shareArticle(item).catch(() => undefined);
      },
      onToggleSaved: toggleSaved,
    },
  };
}

async function shareArticle(item: InboxItem) {
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
