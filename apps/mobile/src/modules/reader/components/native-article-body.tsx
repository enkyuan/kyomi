import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Image } from "expo-image";
import { useCallback, useMemo, useRef, useState } from "react";
import { Platform, Share, Text, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  NativeDocumentBody,
  createReaderNativeTheme,
  type NativeDocumentBodyHandle,
  type ReaderFootnote,
  type ReaderNativeHost,
} from "@kyomi/reader/native";
import type { ReaderDocument } from "@kyomi/reader/document";
import { FONT_FAMILIES } from "@/theme/fonts";
import { mobileReaderLayout } from "../lib/layout";
import { readerCanvas } from "../lib/theme";
import { readReaderPosition, writeReaderPosition } from "../lib/position";
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
  readonly onReady?: () => void;
  readonly title: string;
  readonly topInset: number;
};

function openExternal(url: string) {
  if (url.startsWith("mailto:")) {
    void Linking.openURL(url);
    return;
  }
  void WebBrowser.openBrowserAsync(url);
}

function shareUrl(url: string) {
  void Share.share(Platform.OS === "ios" ? { url } : { message: url });
}

export function NativeArticleBody({
  articleId,
  bottomInset,
  colorScheme,
  document,
  faviconUrls,
  feedTitle,
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
  const initialIndex = useMemo(() => readReaderPosition(articleId), [articleId]);

  const theme = useMemo(
    () =>
      createReaderNativeTheme({
        availableWidth: width - inset * 2,
        colors: { background: readerCanvas[colorScheme] },
        fontSize: mobileReaderLayout.body.fontSizePx,
        fonts: {
          body: FONT_FAMILIES.dmSans.regular,
          heading: FONT_FAMILIES.inter.bold,
          mono: Platform.select({ android: "monospace", default: "Menlo" }),
          strong: FONT_FAMILIES.dmSans.semibold,
        },
        inset,
        lineHeight: mobileReaderLayout.body.lineHeight,
        reduceMotion,
        scheme: colorScheme,
      }),
    [colorScheme, inset, reduceMotion, width],
  );

  const host = useMemo<ReaderNativeHost>(
    () => ({
      openFootnote: setFootnote,
      openImage: (image, caption) => setViewer({ caption, image }),
      openUrl: openExternal,
      renderImage: createReaderImageRenderer({
        background: theme.colors.codeBackground,
        reduceMotion,
      }),
      renderIsland: (island) => (
        <HtmlIsland
          aspectRatio={island.kind === "embed" ? island.aspectRatio : undefined}
          colorScheme={colorScheme}
          dom={{ matchContents: true, scrollEnabled: false }}
          fontSizePx={mobileReaderLayout.body.fontSizePx}
          frameUrl={island.kind === "embed" ? island.frameUrl : undefined}
          html={island.kind === "embed" ? undefined : island.html}
          kind={island.kind}
          title={island.title}
        />
      ),
      shareUrl,
    }),
    [colorScheme, reduceMotion, theme.colors.codeBackground],
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
          fontFamily: FONT_FAMILIES.inter.bold,
          fontSize: mobileReaderLayout.title.minFontSizePx + 4,
          letterSpacing: -0.035 * (mobileReaderLayout.title.minFontSizePx + 4),
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
        initialIndex={initialIndex}
        inset={inset}
        onFirstContentLayout={onReady}
        onScrollIndexChange={onScrollIndexChange}
        theme={theme}
      />
      <FootnoteSheet context={sheetContext} footnote={footnote} onClose={closeFootnote} />
      <ImageViewer onClose={closeViewer} state={viewer} />
    </View>
  );
}
