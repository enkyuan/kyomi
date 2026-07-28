"use client";

import { useCallback } from "react";
import { anchoredToastManager, toastManager } from "@kyomi/ui/atoms/toast";
import { logClientError } from "@lib/errors";
import { useInboxItemStateMutation } from "@modules/inbox/hooks/use-inbox-data";
import type { AnchoredToolbarActionOptions, ArticleActionItem, ToolbarSide } from "../lib/types";

const DEFAULT_SAVED_TOAST_SIDE: ToolbarSide = "top";
const DEFAULT_SAVED_TOAST_SIDE_OFFSET = 6;
const SAVED_STATE_TOAST_GROUP_KEY = "article.saved-state";

function showSavedToast(options: AnchoredToolbarActionOptions | undefined, isSaved: boolean) {
  const title = isSaved ? "Article saved" : "Article unsaved";
  const type = isSaved ? "success" : "info";
  const anchor = options?.anchor;

  if (anchor?.isConnected) {
    anchoredToastManager.add({
      title,
      type,
      timeout: 1800,
      data: { groupKey: SAVED_STATE_TOAST_GROUP_KEY, tooltipStyle: true },
      positionerProps: {
        anchor,
        side: options?.side ?? DEFAULT_SAVED_TOAST_SIDE,
        align: "center",
        sideOffset: options?.sideOffset ?? DEFAULT_SAVED_TOAST_SIDE_OFFSET,
        positionMethod: "fixed",
      },
    });
    return;
  }

  toastManager.add({ title, type });
}

export function useArticleActions({
  item,
  saveErrorScope,
}: {
  item: ArticleActionItem;
  saveErrorScope: string;
}) {
  const updateItemMutation = useInboxItemStateMutation();

  const toggleSaved = useCallback(
    (options?: AnchoredToolbarActionOptions) => {
      const nextSaved = !item.isSaved;
      const savePromise = updateItemMutation.mutateAsync({
        itemId: item.id,
        patch: { isSaved: nextSaved },
      });

      void savePromise
        .then(() => {
          showSavedToast(options, nextSaved);
        })
        .catch((error) => {
          logClientError(saveErrorScope, error);
          toastManager.add({
            title: nextSaved ? "Unable to save article" : "Unable to update article",
            type: "error",
          });
        });
    },
    [item.id, item.isSaved, saveErrorScope, updateItemMutation],
  );

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
