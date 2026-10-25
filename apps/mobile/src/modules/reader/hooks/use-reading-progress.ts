import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import {
  READING_FLUSH_INTERVAL_MS,
  buildContentKey,
  createActiveTimer,
  createReadingSession,
  type ActiveTimer,
  type ReadingSession,
} from "@kyomi/reader/core";
import { toHtmlReaderContent } from "@/lib/reader-document";
import type { ReaderArticle } from "../lib/article";
import { applyReadingProgressToCache } from "../lib/progress-cache";
import { readingProgressSync } from "../lib/progress-store";
import { useReaderPreferences } from "./use-reader-preferences";

export type ReadingSample = {
  readonly progress: number;
  readonly completed: boolean;
};

/**
 * Tracks how far the user reads `article` and where to put them back.
 *
 * Samples come from the body renderer through `onReadingProgress`. A session accumulates them with
 * the active reading time and is flushed every `READING_FLUSH_INTERVAL_MS`, when the app leaves the
 * foreground, and when the article closes. A write that fails is kept for the next foreground.
 * With the "Remember reading position" preference off nothing is tracked or restored.
 */
export function useReadingProgress(article: ReaderArticle | undefined) {
  const queryClient = useQueryClient();
  const { isSettled, rememberPosition } = useReaderPreferences();
  const sessionRef = useRef<{ session: ReadingSession; timer: ActiveTimer } | null>(null);
  const articleId = article?.id;
  const selected = article?.reader.selected;
  // Progress is a scroll fraction of the body, so the key names the article content, not the
  // renderer: a document body keys like the HTML body it was compiled from.
  const contentKey = useMemo(
    () => (selected ? buildContentKey(toHtmlReaderContent(selected)) : null),
    [selected],
  );

  useEffect(() => {
    if (!articleId || !contentKey || !rememberPosition) return;

    const timer = createActiveTimer();
    const session = createReadingSession({ contentKey, timer });
    timer.setVisible(AppState.currentState === "active");
    sessionRef.current = { session, timer };

    const flush = () => {
      const body = session.takeUpdate();
      if (!body) return;

      void readingProgressSync.push(articleId, body).then((readingProgress) => {
        if (readingProgress) {
          applyReadingProgressToCache(queryClient, articleId, readingProgress, body);
        }
      });
    };

    const interval = setInterval(flush, READING_FLUSH_INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      timer.setVisible(state === "active");
      if (state !== "active") flush();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
      sessionRef.current = null;
      flush();
    };
  }, [articleId, contentKey, queryClient, rememberPosition]);

  const onReadingProgress = useCallback((sample: ReadingSample) => {
    const current = sessionRef.current;
    if (!current) return;

    current.timer.markActivity();
    current.session.sample(sample);
  }, []);

  const position = article?.readingPosition;
  const initialProgress =
    rememberPosition && position && contentKey !== null && position.contentKey === contentKey
      ? position.progress
      : undefined;

  return {
    initialProgress,
    /** The renderer waits for the preference so a position is never restored against it. */
    isReady: isSettled,
    onReadingProgress: rememberPosition ? onReadingProgress : undefined,
  };
}
