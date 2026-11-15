import { useNavigation } from "expo-router";
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
 * The reader's tools on the tab bar, for as long as the reader is open: save, share, reader view,
 * text size and open original. Returns the article with the chosen reader view applied and the text
 * size to render it at, so the body follows the bar. With no article yet the bar still takes the
 * reader's shape, its tools disabled.
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

  // The bar belongs to the reader only while it is on screen. A popped screen stays mounted until
  // its pop animation ends, so releasing on unmount made the tools linger through the transition and
  // the bar morph back only after it. Navigation events say when the pop *begins*, and listening to
  // them changes nothing in React state: a focus hook would re-render the whole reader (its list and
  // body) at the very moment the transition starts, which is when a frame is most expensive.
  const navigation = useNavigation();
  const released = useRef(false);
  const barRef = useRef(bar);
  useEffect(() => {
    barRef.current = bar;
    if (!released.current) setReaderBar(bar);
  }, [bar]);
  useEffect(() => {
    const release = () => {
      released.current = true;
      setReaderBar(null);
    };
    const unsubscribers = [
      // The earliest signal: a back press, or a swipe back let go of, before the stack updates.
      navigation.addListener("beforeRemove", release),
      navigation.addListener("blur", release),
      navigation.addListener("focus", () => {
        released.current = false;
        setReaderBar(barRef.current);
      }),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      setReaderBar(null);
    };
  }, [navigation]);

  return { article, fontSizePx };
}
