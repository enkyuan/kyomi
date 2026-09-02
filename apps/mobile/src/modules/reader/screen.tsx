import { Stack } from "expo-router";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getReaderTabBarOcclusionHeight } from "@/components/ui/tab-bar/lib/styles";
import { Skeleton } from "@ui/skeleton";
import { fetchMobileApiJson, resolveMobileApiUrl } from "@/lib/api";
import { buildFaviconUrlCandidates } from "@kyomi/worker/favicon/browser";
import {
  exploreArticlesQueryKey,
  subscribedArticlesQueryKey,
} from "@modules/inbox/hooks/use-articles";
import type { CursorListResponseDto } from "@kyomi/reader/schemas/article";
import { saveRecentArticle } from "@modules/recents/lib/store";
import ArticleBody from "./components/article-body.dom";
import { useArticle } from "./hooks/use-article";
import { getReaderCanvasColor, getReaderColorScheme } from "./lib/theme";
import { FONT_STYLES } from "@/theme/fonts";
import { mobileReaderLayout, mobileReaderSkeletonLayout } from "./lib/layout";

export type ReaderScreenProps = {
  readonly articleId: string;
};

const READER_TITLE_SKELETON_WIDTHS = ["100%", "88%", "64%"] as const;
const READER_SKELETON_PARAGRAPHS = [
  {
    id: "paragraph-1",
    lines: [
      { id: "line-1", width: "100%" },
      { id: "line-2", width: "94%" },
      { id: "line-3", width: "88%" },
      { id: "line-4", width: "100%" },
      { id: "line-5", width: "78%" },
    ],
  },
  {
    id: "paragraph-2",
    lines: [
      { id: "line-1", width: "96%" },
      { id: "line-2", width: "100%" },
      { id: "line-3", width: "90%" },
      { id: "line-4", width: "82%" },
    ],
  },
] as const;
const articleQueryKeys = [exploreArticlesQueryKey, subscribedArticlesQueryKey] as const;

export function ReaderScreen({ articleId }: ReaderScreenProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const readerColorScheme = getReaderColorScheme(colorScheme);
  const readerCanvasColor = getReaderCanvasColor(colorScheme);
  const tabBarOcclusionHeight = getReaderTabBarOcclusionHeight(insets);
  const [readyArticleId, setReadyArticleId] = useState<string | null>(null);
  // Avoid sending duplicate view events while an article stays open.
  const viewedArticleIdRef = useRef<string | null>(null);
  const handleArticleReady = useCallback(() => {
    setReadyArticleId(articleId);
  }, [articleId]);
  const { data: article, error, isLoading, refetch } = useArticle(articleId);
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
        for (const queryKey of articleQueryKeys) {
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
        for (const queryKey of articleQueryKeys) {
          void queryClient.invalidateQueries({ queryKey });
        }
      })
      .catch(() => undefined);
  }, [article, queryClient]);

  if (isLoading) {
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

  const isDomReady = readyArticleId === article?.id;

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
        <ArticleBody
          key={article.id}
          colorScheme={readerColorScheme}
          bottomInset={tabBarOcclusionHeight}
          dom={{
            scrollEnabled: true,
            style: { backgroundColor: readerCanvasColor, flex: 1, opacity: isDomReady ? 1 : 0 },
          }}
          faviconUrls={faviconUrls}
          feedTitle={article.feedTitle}
          fontSizePx={mobileReaderLayout.body.fontSizePx}
          onReady={handleArticleReady}
          reader={article.reader.selected}
          title={article.title}
        />
        {!isDomReady ? (
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
            radius={4}
            style={{ height: mobileReaderLayout.source.fontSizePx, width: 96 }}
            surfaceColor={surfaceColor}
          />
          <View
            style={{
              gap: mobileReaderSkeletonLayout.titleLineSpacingPx,
              marginTop: mobileReaderLayout.source.marginBottomPx,
            }}
          >
            {READER_TITLE_SKELETON_WIDTHS.slice(0, mobileReaderLayout.title.skeletonLines).map(
              (width) => (
                <Skeleton
                  key={`title-${width}`}
                  radius={4}
                  style={{
                    height: mobileReaderSkeletonLayout.titleLineHeightPx,
                    width,
                  }}
                  surfaceColor={surfaceColor}
                />
              ),
            )}
          </View>
        </View>
        <View style={{ gap: mobileReaderSkeletonLayout.paragraphGapPx }}>
          {READER_SKELETON_PARAGRAPHS.map((paragraph) => (
            <View key={paragraph.id} style={{ gap: mobileReaderSkeletonLayout.bodyLineSpacingPx }}>
              {paragraph.lines.map((line) => (
                <Skeleton
                  key={`${paragraph.id}-${line.id}`}
                  radius={4}
                  style={{ height: mobileReaderSkeletonLayout.bodyLineHeightPx, width: line.width }}
                  surfaceColor={surfaceColor}
                />
              ))}
            </View>
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
