import {
  ArrowShareRightNativeIcon,
  BookmarkFilledNativeIcon,
  BookmarkNativeIcon,
  ExternalLinkFilledNativeIcon,
  ExternalLinkNativeIcon,
  PageTextFilledNativeIcon,
  PageTextNativeIcon,
  TitleCaseFilledNativeIcon,
  TitleCaseNativeIcon,
} from "@kyomi/ui/icons/blode-native";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { toTabBarIcon } from "@ui/tab-bar/lib/icon";
import type { TabBarReaderTool } from "../../../../modules/tab-bar";
import type { ReaderArticle } from "./article";

export type ReaderMode = ReaderArticle["reader"]["activeMode"];

/** The tools of the reader bar, in the order they sit on it. `textSize` is handled natively. */
export const READER_TOOL_KEYS = ["save", "share", "mode", "textSize", "original"] as const;
export type ReaderToolKey = (typeof READER_TOOL_KEYS)[number];

export function isReaderToolKey(key: string): key is ReaderToolKey {
  return (READER_TOOL_KEYS as readonly string[]).includes(key);
}

/** Whether the article has an extracted (reader view) body to switch to. */
export function hasExtractedContent(article: ReaderArticle): boolean {
  return article.reader.extracted.available && article.reader.extracted.content !== null;
}

/**
 * The article with the body of `mode` selected. The server picks a mode from the preferences; the
 * reader view tool overrides it for the open article without another request. Falls back to the
 * server's choice when the other body is not there.
 */
export function withReaderMode(article: ReaderArticle, mode: ReaderMode): ReaderArticle {
  if (mode === article.reader.activeMode) return article;
  const content =
    mode === "extracted" ? article.reader.extracted.content : article.reader.original.content;
  if (!content) return article;
  return { ...article, reader: { ...article.reader, activeMode: mode, selected: content } };
}

/**
 * The tools for an article, or all of them disabled while it loads, so the bar morphs into the
 * reader as the screen opens instead of when its content arrives.
 */
export function buildReaderTools(article: ReaderArticle | undefined): readonly TabBarReaderTool[] {
  const loaded = article !== undefined;
  return [
    {
      disabled: !loaded,
      key: "save",
      label: article?.isSaved ? "Remove from saved" : "Save article",
      selected: article?.isSaved ?? false,
      // A saved article takes the palette's blue (mizu), apart from the matcha of the other tools.
      selectedTint: kyomiNativeBrand.mizu.color,
      icon: toTabBarIcon(BookmarkNativeIcon),
      selectedIcon: toTabBarIcon(BookmarkFilledNativeIcon),
    },
    {
      disabled: !loaded,
      key: "share",
      icon: toTabBarIcon(ArrowShareRightNativeIcon),
      label: "Share article",
    },
    {
      disabled: !article || !hasExtractedContent(article),
      key: "mode",
      label: "Reader view",
      selected: article?.reader.activeMode === "extracted",
      icon: toTabBarIcon(PageTextNativeIcon),
      selectedIcon: toTabBarIcon(PageTextFilledNativeIcon),
    },
    {
      disabled: !loaded,
      key: "textSize",
      icon: toTabBarIcon(TitleCaseNativeIcon),
      label: "Text size",
      selectedIcon: toTabBarIcon(TitleCaseFilledNativeIcon),
    },
    {
      disabled: !loaded,
      key: "original",
      icon: toTabBarIcon(ExternalLinkNativeIcon),
      label: "Open original",
      selectedIcon: toTabBarIcon(ExternalLinkFilledNativeIcon),
    },
  ];
}
