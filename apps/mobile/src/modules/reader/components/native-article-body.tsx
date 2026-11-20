import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useCallback, useMemo, useRef, useState } from "react";
import { Platform, Share, Text, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  NativeDocumentBody,
  createReaderNativeTheme,
  type NativeDocumentBodyHandle,
  type NativeReadingSample,
  type ReaderFootnote,
  type ReaderNativeHost,
} from "@kyomi/reader/native";
import type { ReaderDocument } from "@kyomi/reader/document";
import { normalizeSafeHttpUrl } from "@kyomi/reader/core";
import { openExternalLink } from "@/lib/external-link";
import { FONT_FAMILIES } from "@/theme/fonts";
import { mobileReaderLayout } from "../lib/layout";
import { readerCanvas } from "../lib/theme";
import { writeReaderPosition } from "../lib/position";
import HtmlIsland from "./html-island.dom";
import { FootnoteSheet } from "./footnote-sheet";
import { ImageViewer, type ImageViewerState } from "./image-viewer";
import { createReaderImageRenderer } from "./reader-image";

type NativeArticleBodyProps = {
  readonly articleId: string;
  readonly bottomInset: number;
  readonly colorScheme: "dark" | "light";
  readonly document: ReaderDocument;
  readonly faviconUrls: readonly string[];
  readonly feedTitle: string;
  /** Body text size in points. */
  readonly fontSizePx: number;
  /** Restore here (0..1) instead of the locally saved row, so a position follows the reader across devices. */
  readonly initialProgress?: number;
  readonly onReadingProgress?: (sample: NativeReadingSample) => void;
  readonly onReady?: () => void;
  readonly title: string;
  readonly topInset: number;
};

function shareUrl(raw: string) {
  const url = normalizeSafeHttpUrl(raw);
  if (!url) return;

  void Share.share(Platform.OS === "ios" ? { url } : { message: url });
}

export function NativeArticleBody({
  articleId,
  bottomInset,
  colorScheme,
  document,
  faviconUrls,
  feedTitle,
  fontSizePx,
  initialProgress,
  onReadingProgress,
  onReady,
  title,
  topInset,
}: NativeArticleBodyProps) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const listRef = useRef<NativeDocumentBodyHandle>(null);
  const [viewer, setViewer] = useState<ImageViewerState | null>(null);
  const [footnote, setFootnote] = useState<ReaderFootnote | null>(null);
  const inset = mobileReaderLayout.contentInsetPx;

  const theme = useMemo(
    () =>
      createReaderNativeTheme({
        availableWidth: width - inset * 2,
        colors: { background: readerCanvas[colorScheme] },
        blockGap: mobileReaderLayout.body.blockGapPx,
        fontSize: fontSizePx,
        fonts: {
          body: FONT_FAMILIES.newsreader.regular,
          heading: FONT_FAMILIES.newsreader.semibold,
          italic: FONT_FAMILIES.newsreader.italic,
          strongItalic: FONT_FAMILIES.newsreader.boldItalic,
          mono: FONT_FAMILIES.jetbrainsMono.regular,
          sans: FONT_FAMILIES.inter.medium,
          strong: FONT_FAMILIES.newsreader.bold,
        },
        inset,
        lineHeight: mobileReaderLayout.body.lineHeight,
        reduceMotion,
        scheme: colorScheme,
      }),
    [colorScheme, fontSizePx, inset, reduceMotion, width],
  );

  const host = useMemo<ReaderNativeHost>(
    () => ({
      openFootnote: setFootnote,
      openImage: (image, caption) => setViewer({ caption, image }),
      copyText: async (text) => {
        await Clipboard.setStringAsync(text);
      },
      openUrl: openExternalLink,
      renderImage: createReaderImageRenderer({
        background: theme.colors.codeBackground,
        reduceMotion,
      }),
      renderIsland: (island) => (
        <HtmlIsland
          aspectRatio={island.kind === "embed" ? island.aspectRatio : undefined}
          colorScheme={colorScheme}
          dom={{ matchContents: true, scrollEnabled: false }}
          fontSizePx={fontSizePx}
          frameUrl={island.kind === "embed" ? island.frameUrl : undefined}
          html={island.kind === "embed" ? undefined : island.html}
          kind={island.kind}
          openUrl={openExternalLink}
          title={island.title}
        />
      ),
      shareUrl,
    }),
    [colorScheme, fontSizePx, reduceMotion, theme.colors.codeBackground],
  );

  const sheetContext = useMemo(
    () => ({
      footnotes: Object.fromEntries(document.footnotes.map((item) => [item.id, item])),
      host: { ...host, openFootnote: undefined },
      theme,
    }),
    [document.footnotes, host, theme],
  );

  const closeFootnote = useCallback(() => setFootnote(null), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const onScrollIndexChange = useCallback(
    (index: number) => writeReaderPosition(articleId, index),
    [articleId],
  );

  const faviconUrl = faviconUrls[0];
  const header = (
    <View
      accessible={false}
      style={{
        alignSelf: "center",
        marginBottom: mobileReaderLayout.headerBottomMarginPx,
        paddingTop: topInset + inset,
        width: theme.columnWidth,
      }}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 8,
          marginBottom: mobileReaderLayout.source.marginBottomPx,
        }}
      >
        {faviconUrl ? (
          <Image
            accessibilityElementsHidden
            contentFit="contain"
            source={{ uri: faviconUrl }}
            style={{ borderRadius: 3, height: 20, width: 20 }}
          />
        ) : null}
        <Text
          maxFontSizeMultiplier={theme.maxFontSizeMultiplier}
          style={{
            color: theme.colors.muted,
            fontFamily: FONT_FAMILIES.inter.semibold,
            fontSize: mobileReaderLayout.source.fontSizePx,
            letterSpacing: 0.14,
          }}
        >
          {feedTitle}
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.6}
        selectable
        style={{
          color: theme.colors.foreground,
          fontFamily: FONT_FAMILIES.inter.semibold,
          fontSize: mobileReaderLayout.title.minFontSizePx + 4,
          letterSpacing: -0.012 * (mobileReaderLayout.title.minFontSizePx + 4),
          lineHeight: Math.round(
            (mobileReaderLayout.title.minFontSizePx + 4) * mobileReaderLayout.title.lineHeight,
          ),
        }}
      >
        {title}
      </Text>
    </View>
  );

  return (
    <View style={{ backgroundColor: readerCanvas[colorScheme], flex: 1 }}>
      <NativeDocumentBody
        // A new article or recompiled document remounts the body, so block-local state (open
        // details, gallery page) never carries over by position.
        key={`${articleId}:${document.compiler.version}`}
        ref={listRef}
        bottomInset={bottomInset}
        document={document}
        header={header}
        host={host}
        initialProgress={initialProgress}
        inset={inset}
        onFirstContentLayout={onReady}
        onReadingProgress={onReadingProgress}
        onScrollIndexChange={onScrollIndexChange}
        theme={theme}
      />
      <FootnoteSheet context={sheetContext} footnote={footnote} onClose={closeFootnote} />
      <ImageViewer onClose={closeViewer} state={viewer} />
    </View>
  );
}
