import { Stack } from "expo-router";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getReaderTabBarOcclusionHeight } from "@/components/ui/tab-bar/lib/styles";
import { Skeleton } from "@ui/skeleton";
import { fetchMobileApiJson, resolveMobileApiUrl } from "@/lib/api";
import { buildFaviconUrlCandidates } from "@kyomi/ingest/favicon/browser";
import { articleListQueryKeys } from "@modules/articles/queries/keys";
import type { CursorListResponseDto } from "@kyomi/reader/schemas/article";
import { saveRecentArticle } from "@modules/recents/lib/store";
import {
  NATIVE_READER_ENABLED,
  selectReaderBody,
  toHtmlReaderContent,
} from "@/lib/reader-document";
import ArticleBody from "./components/article-body.dom";
import { NativeArticleBody } from "./components/native-article-body";
import { READER_FIXTURE_ENABLED, createLongArticleBody } from "./lib/fixture";
import { startReaderTrace, type ReaderTrace } from "./lib/metrics";
import { useArticle } from "./hooks/use-article";
import { useReadingProgress } from "./hooks/use-reading-progress";
import { useReaderToolbar } from "./hooks/use-toolbar";
import { getReaderCanvasColor, getReaderColorScheme } from "./lib/theme";
import { FONT_STYLES } from "@/theme/fonts";
import { mobileReaderLayout, mobileReaderSkeletonLayout } from "./lib/layout";

export type ReaderScreenProps = {
  readonly articleId: string;
};

const READER_TITLE_SKELETON_WIDTHS = ["100%", "88%", "64%"] as const;
/** One bar width per line, a paragraph at a time. */
const READER_SKELETON_PARAGRAPHS = [
  ["100%", "94%", "88%", "100%", "78%"],
  ["96%", "100%", "90%", "82%"],
] as const;

export function ReaderScreen({ articleId }: ReaderScreenProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const readerColorScheme = getReaderColorScheme(colorScheme);
  const readerCanvasColor = getReaderCanvasColor(colorScheme);
  const tabBarOcclusionHeight = getReaderTabBarOcclusionHeight(insets);
  // Readiness is per article *and* reader view, since either remounts the body (and its restore).
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const currentKeyRef = useRef<string | null>(null);
  // Avoid sending duplicate view events while an article stays open.
  const viewedArticleIdRef = useRef<string | null>(null);
  const traceRef = useRef<{ articleId: string; trace: ReaderTrace } | null>(null);
  const handleArticleReady = useCallback(() => {
    setReadyKey(currentKeyRef.current);
    if (traceRef.current?.articleId === articleId) traceRef.current.trace.ready();
  }, [articleId]);
  const { data: fetchedArticle, error, isLoading, refetch } = useArticle(articleId);
  const baseArticle = useMemo(
    () =>
      fetchedArticle && READER_FIXTURE_ENABLED
        ? {
            ...fetchedArticle,
            reader: {
              ...fetchedArticle.reader,
              selected: createLongArticleBody(NATIVE_READER_ENABLED),
            },
          }
        : fetchedArticle,
    [fetchedArticle],
  );
  // The bar's tools act on the article, and its slider sets the size the body is drawn at.
  const { article, fontSizePx } = useReaderToolbar(baseArticle);
  currentKeyRef.current = article ? `${article.id}:${article.reader.activeMode}` : null;
  const body = useMemo(
    () => (article ? selectReaderBody(article.reader.selected, NATIVE_READER_ENABLED) : null),
    [article],
  );
  const renderer = body?.kind === "document" ? "native" : "dom";

  useEffect(() => {
    if (!article || !body) return;
    traceRef.current = {
      articleId: article.id,
      trace: startReaderTrace({
        articleId: article.id,
        blocks: body.kind === "document" ? body.document.blocks.length : undefined,
        renderer,
      }),
    };
  }, [article?.id, body, renderer]);
  const readingProgress = useReadingProgress(article);
  const faviconUrls = useMemo(
    () =>
      article
        ? buildFaviconUrlCandidates(
            article.feedFaviconUrl,
            article.feedSiteUrl,
            article.feedUrl ?? article.link,
          ).map((url) => (url.startsWith("/api/") ? resolveMobileApiUrl(url) : url))
        : [],
    [article?.feedFaviconUrl, article?.feedSiteUrl, article?.feedUrl, article?.link],
  );

  useEffect(() => {
    if (!article || viewedArticleIdRef.current === article.id) {
      return;
    }

    viewedArticleIdRef.current = article.id;
    saveRecentArticle(article);

    const lastViewedAt = new Date().toISOString();
    void fetchMobileApiJson<{ message: string }>(
      `/api/v1/articles/${encodeURIComponent(article.id)}/view`,
      { method: "POST" },
    )
      .then(() => {
        for (const queryKey of articleListQueryKeys) {
          queryClient.setQueryData<InfiniteData<CursorListResponseDto>>(queryKey, (current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.id === article.id ? { ...item, lastViewedAt } : item,
                ),
              })),
            };
          });
        }
        for (const queryKey of articleListQueryKeys) {
          void queryClient.invalidateQueries({ queryKey });
        }
      })
      .catch(() => undefined);
  }, [article, queryClient]);

  // The body waits for the "Remember reading position" preference so a position is never restored
  // against it.
  if (isLoading || (article && !readingProgress.isReady)) {
    return (
      <ReaderCanvas color={readerCanvasColor} colorScheme={readerColorScheme}>
        <ReaderSkeleton
          bottomInset={tabBarOcclusionHeight}
          surfaceColor={readerCanvasColor}
          topInset={insets.top}
        />
      </ReaderCanvas>
    );
  }

  const isReady = readyKey !== null && readyKey === currentKeyRef.current;
  const isNative = body?.kind === "document";

  if (!article) {
    return (
      <ReaderCanvas color={readerCanvasColor} colorScheme={readerColorScheme}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-foreground" style={FONT_STYLES.screenTitle}>
            Couldn’t load article
          </Text>
          <Text className="mt-2 text-center text-muted-foreground" style={FONT_STYLES.bodySmall}>
            {error instanceof Error ? error.message : "Please try again."}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-5 min-h-12 items-center justify-center rounded-full bg-secondary px-5 active:opacity-70"
            onPress={() => void refetch()}
          >
            <Text className="text-foreground" style={FONT_STYLES.button}>
              Try again
            </Text>
          </Pressable>
        </View>
      </ReaderCanvas>
    );
  }

  return (
    <ReaderCanvas color={readerCanvasColor} colorScheme={readerColorScheme}>
      <View style={{ flex: 1 }}>
        {isNative ? (
          <NativeArticleBody
            key={`${article.id}:${article.reader.activeMode}`}
            articleId={article.id}
            bottomInset={tabBarOcclusionHeight}
            colorScheme={readerColorScheme}
            document={body.document}
            faviconUrls={faviconUrls}
            feedTitle={article.feedTitle}
            fontSizePx={fontSizePx}
            initialProgress={readingProgress.initialProgress}
            onReadingProgress={readingProgress.onReadingProgress}
            onReady={handleArticleReady}
            title={article.title}
            topInset={insets.top}
          />
        ) : (
          <ArticleBody
            key={`${article.id}:${article.reader.activeMode}`}
            colorScheme={readerColorScheme}
            bottomInset={tabBarOcclusionHeight}
            dom={{
              scrollEnabled: true,
              style: { backgroundColor: readerCanvasColor, flex: 1, opacity: isReady ? 1 : 0 },
            }}
            faviconUrls={faviconUrls}
            feedTitle={article.feedTitle}
            fontSizePx={fontSizePx}
            initialProgress={readingProgress.initialProgress}
            onReadingProgress={readingProgress.onReadingProgress}
            onReady={handleArticleReady}
            reader={toHtmlReaderContent(article.reader.selected)}
            title={article.title}
          />
        )}
        {!isReady ? (
          <View
            pointerEvents="none"
            style={{
              backgroundColor: readerCanvasColor,
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          >
            <ReaderSkeleton
              bottomInset={tabBarOcclusionHeight}
              surfaceColor={readerCanvasColor}
              topInset={insets.top}
            />
          </View>
        ) : null}
      </View>
    </ReaderCanvas>
  );
}

function ReaderSkeleton({
  bottomInset,
  surfaceColor,
  topInset,
}: {
  readonly bottomInset: number;
  readonly surfaceColor: `#${string}`;
  readonly topInset: number;
}) {
  return (
    <View
      className="flex-1"
      style={{
        paddingBottom: bottomInset,
        paddingHorizontal: mobileReaderLayout.contentInsetPx,
        paddingTop: topInset + mobileReaderLayout.contentInsetPx,
      }}
    >
      <View style={{ gap: mobileReaderLayout.headerBottomMarginPx }}>
        <View>
          <Skeleton
            height={mobileReaderLayout.source.fontSizePx}
            radius={4}
            surfaceColor={surfaceColor}
            width={96}
          />
          <View style={{ marginTop: mobileReaderLayout.source.marginBottomPx }}>
            <Skeleton.Lines
              gap={mobileReaderSkeletonLayout.titleLineSpacingPx}
              lineHeight={mobileReaderSkeletonLayout.titleLineHeightPx}
              surfaceColor={surfaceColor}
              widths={READER_TITLE_SKELETON_WIDTHS.slice(0, mobileReaderLayout.title.skeletonLines)}
            />
          </View>
        </View>
        <View style={{ gap: mobileReaderSkeletonLayout.paragraphGapPx }}>
          {READER_SKELETON_PARAGRAPHS.map((widths) => (
            <Skeleton.Lines
              gap={mobileReaderSkeletonLayout.bodyLineSpacingPx}
              key={widths.join("-")}
              lineHeight={mobileReaderSkeletonLayout.bodyLineHeightPx}
              surfaceColor={surfaceColor}
              widths={widths}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function ReaderCanvas({
  children,
  color,
  colorScheme,
}: {
  readonly children: ReactNode;
  readonly color: string;
  readonly colorScheme: "dark" | "light";
}) {
  return (
    <>
      <Stack.Screen
        options={{
          contentStyle: { backgroundColor: color },
          statusBarStyle: colorScheme === "dark" ? "light" : "dark",
        }}
      />
      <View style={{ backgroundColor: color, flex: 1 }}>{children}</View>
    </>
  );
}
