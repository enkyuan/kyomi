"use client";

import { useCallback } from "react";
import { anchoredToastManager, toastManager } from "@kyomi/ui/components/toast";
import { normalizeSafeHttpUrl } from "@kyomi/reader/core";
import { getUserSafeErrorMessage, logClientError } from "@kyomi/reader/lib/errors";
import { useInboxItemStateMutation } from "@modules/articles/hooks/use-item-state";
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

export function useActions({
  item,
  saveErrorScope,
}: {
  item: ArticleActionItem;
  saveErrorScope: string;
}) {
  const updateItemMutation = useInboxItemStateMutation({ reportErrors: false });

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
            description: getUserSafeErrorMessage(error, "Try again in a moment."),
            type: "error",
          });
        });
    },
    [item.id, item.isSaved, saveErrorScope, updateItemMutation],
  );

  return {
    isSaved: item.isSaved,
    copyLink: () => {
      // A feed supplies the link, so only an http(s) one is copied, opened, or shared.
      const link = normalizeSafeHttpUrl(item.link);
      if (!link) {
        showCopyFailedToast();
        return;
      }
      void copyTextToClipboard(link)
        .then(() => toastManager.add({ title: "Link copied", type: "success", timeout: 1800 }))
        .catch(() => showCopyFailedToast());
    },
    hide: (removeFromList = true) => {
      updateItemMutation.mutate(
        {
          itemId: item.id,
          patch: { isHidden: true },
          removeFromList,
        },
        {
          onError: (error) => {
            logClientError(saveErrorScope, error);
            toastManager.add({
              title: "Unable to hide article",
              description: getUserSafeErrorMessage(error, "Try again in a moment."),
              type: "error",
            });
          },
        },
      );
    },
    openSource: (options?: { newTab?: boolean }) => {
      // `javascript:` would run in this origin when opened in the same tab.
      const link = normalizeSafeHttpUrl(item.link);
      if (!link) {
        return;
      }
      const newTab = options?.newTab ?? true;
      window.open(link, newTab ? "_blank" : "_self", newTab ? "noopener,noreferrer" : undefined);
    },
    shareArticle: () => {
      void shareArticle(item).catch((error: unknown) => {
        // Dismissing the native share sheet rejects with an AbortError; that is not a failure.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        toastManager.add({
          title: "Unable to share article",
          description: "Try again in a moment.",
          type: "error",
        });
      });
    },
    toggleSaved,
  };
}

async function shareArticle(item: ArticleActionItem) {
  const link = normalizeSafeHttpUrl(item.link);
  if (!link) {
    throw new Error("The article link is not a web address.");
  }

  const shareData: ShareData = {
    title: item.title,
    text: item.summary ?? item.feedTitle,
    url: link,
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    await navigator.share(shareData);
    return;
  }

  // No native share sheet: copying is the only action, so it needs its own confirmation.
  await copyTextToClipboard(link);
  toastManager.add({ title: "Link copied", type: "success", timeout: 1800 });
}

function showCopyFailedToast() {
  toastManager.add({
    title: "Unable to copy link",
    description: "Copy it from the address bar instead.",
    type: "error",
  });
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
