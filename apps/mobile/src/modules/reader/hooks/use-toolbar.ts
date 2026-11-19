import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createArticleActions } from "@modules/inbox/hooks/use-actions";
import { useArticleStateMutation } from "@modules/inbox/hooks/use-state";
import { setReaderBar, type ReaderBar } from "@ui/tab-bar/lib/reader-bar";
import type { ReaderArticle } from "../lib/article";
import {
  buildReaderTools,
  hasExtractedContent,
  isReaderToolKey,
  withReaderMode,
  type ReaderMode,
} from "../lib/toolbar";
import { READER_FONT_SIZE_RANGE, useReaderFontSize } from "./use-reader-preferences";

/**
 * The reader's tools on the tab bar while it is open, plus the article with the chosen reader view and
 * the text size to render it at. Without an article the tools show disabled.
 */
export function useReaderToolbar(baseArticle: ReaderArticle | undefined) {
  const updateItem = useArticleStateMutation();
  const { fontSizePx, onFontSize } = useReaderFontSize();
  const [modeChoice, setModeChoice] = useState<{ articleId: string; mode: ReaderMode } | null>(
    null,
  );

  const article = useMemo(() => {
    if (!baseArticle) return undefined;
    return modeChoice?.articleId === baseArticle.id
      ? withReaderMode(baseArticle, modeChoice.mode)
      : baseArticle;
  }, [baseArticle, modeChoice]);

  // The press handler below is stable, so it reads the latest article and mutation from here.
  const latest = useRef({ article, baseArticle, updateItem });
  useEffect(() => {
    latest.current = { article, baseArticle, updateItem };
  });

  const onTool = useCallback((key: string) => {
    const { article: current, updateItem: mutation } = latest.current;
    if (!current || !isReaderToolKey(key)) return;
    const actions = createArticleActions(current, mutation);
    switch (key) {
      case "save":
        return actions.toggleSaved();
      case "share":
        // The native bar opens the system share sheet itself when it has the link; this is the
        // fallback for a press it could not handle.
        return actions.shareArticle();
      case "original":
        return actions.openSource();
      case "mode":
        if (!hasExtractedContent(current)) return;
        return setModeChoice({
          articleId: current.id,
          mode: current.reader.activeMode === "extracted" ? "original" : "extracted",
        });
      case "textSize":
        // Opens its slider natively.
        return;
    }
  }, []);

  const tools = useMemo(() => buildReaderTools(article), [article]);
  const shareUrl = article?.link;
  const bar = useMemo<ReaderBar>(
    () => ({
      onFontSize,
      onTool,
      reader: {
        fontSize: fontSizePx,
        fontSizeLabel: "Text size",
        maxFontSize: READER_FONT_SIZE_RANGE.max,
        minFontSize: READER_FONT_SIZE_RANGE.min,
        shareUrl,
        tools,
      },
    }),
    [fontSizePx, onFontSize, onTool, shareUrl, tools],
  );

  useEffect(() => {
    setReaderBar(bar);
  }, [bar]);
  // Held until the screen is gone, so the native bar can follow the whole pop.
  useEffect(() => () => setReaderBar(null), []);

  return { article, fontSizePx };
}
