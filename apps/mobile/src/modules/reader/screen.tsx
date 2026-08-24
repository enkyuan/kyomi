import { Stack, useNavigation, type NativeStackNavigationProp } from "expo-router";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReaderTabBar, type ReaderTabBarConfig } from "@/components/ui/tab-bar/modes/reader";
import { getReaderTabBarOcclusionHeight } from "@/components/ui/tab-bar/lib/styles";
import { Skeleton } from "@ui/skeleton";
import { fetchMobileApiJson, resolveMobileApiUrl } from "@/lib/api";
import { buildFaviconUrlCandidates } from "@kyomi/worker/favicon/browser";
import { allArticlesQueryKey } from "@modules/inbox/hooks/use-articles";
import type { CursorListResponseDto } from "@kyomi/reader/schemas/article";
import { saveRecentArticle } from "@modules/recents/lib/store";
import ArticleBody from "./components/article-body.dom";
import { useReaderActions } from "./hooks/use-reader-actions";
import { useReaderArticle } from "./hooks/use-reader-article";
import { getReaderCanvasColor, getReaderColorScheme } from "./lib/theme";
import { mobileReaderLayout, mobileReaderSkeletonLayout } from "./lib/layout";

export type ReaderScreenProps = {
  readonly articleId: string;
};

type ReaderStackNavigation = NativeStackNavigationProp<Record<string, object | undefined>>;

const READER_SKELETON_PARAGRAPHS = [
  ["100%", "94%", "88%", "100%", "78%"],
  ["96%", "100%", "90%", "82%"],
] as const;

export function ReaderScreen({ articleId }: ReaderScreenProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ReaderStackNavigation>();
  const queryClient = useQueryClient();
  const readerColorScheme = getReaderColorScheme(colorScheme);
  const readerCanvasColor = getReaderCanvasColor(colorScheme);
  const tabBarOcclusionHeight = getReaderTabBarOcclusionHeight(insets);
  const { setConfig, setIsDismissingReader } = useReaderTabBar();
  const [isDomReady, setIsDomReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const handleArticleReady = useCallback(() => {
    setIsDomReady(true);
  }, []);
  const { data: article, error, isLoading, refetch } = useReaderArticle(articleId);
  const actions = useReaderActions(article);
  const actionRef = useRef(actions);
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

  const tabBarConfig = useMemo<ReaderTabBarConfig | null>(() => {
    if (!article) {
      return null;
    }

    return {
      isSaved: article.isSaved,
      isUpdating: actions.isUpdating,
      onOpenSource: () => actionRef.current.openSource(),
      onSearchQueryChange: setSearchQuery,
      onShare: () => actionRef.current.shareArticle(),
      onToggleSaved: () => actionRef.current.toggleSaved(),
      searchQuery,
    };
  }, [actions.isUpdating, article, searchQuery]);

  useEffect(() => {
    actionRef.current = actions;
  }, [actions]);

  useEffect(() => {
    setConfig(tabBarConfig);
  }, [setConfig, tabBarConfig]);

  useEffect(() => {
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    setIsDismissingReader(false);
    const unsubscribeTransitionStart = navigation.addListener("transitionStart", (event) => {
      setIsDismissingReader(event.data.closing);
    });
    const unsubscribeTransitionEnd = navigation.addListener("transitionEnd", (event) => {
      if (!event.data.closing) {
        setIsDismissingReader(false);
      }
    });
    const unsubscribeGestureCancel = navigation.addListener("gestureCancel", () => {
      setIsDismissingReader(false);
    });

    return () => {
      unsubscribeTransitionStart();
      unsubscribeTransitionEnd();
      unsubscribeGestureCancel();
    };
  }, [navigation, setIsDismissingReader]);

  useEffect(() => {
    setIsDomReady(false);
  }, [articleId]);

  useEffect(() => {
    if (!article) {
      return;
    }

    saveRecentArticle(article);

    const lastViewedAt = new Date().toISOString();
    void fetchMobileApiJson<{ message: string }>(
      `/api/v1/articles/${encodeURIComponent(article.id)}/view`,
      { method: "POST" },
    )
      .then(() => {
        queryClient.setQueryData<InfiniteData<CursorListResponseDto>>(
          allArticlesQueryKey,
          (current) => {
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
          },
        );
        void queryClient.invalidateQueries({ queryKey: allArticlesQueryKey });
      })
      .catch(() => undefined);
  }, [article?.id, queryClient]);

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

  if (!article) {
    return (
      <ReaderCanvas color={readerCanvasColor} colorScheme={readerColorScheme}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-lg font-semibold text-foreground">
            Couldn’t load article
          </Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-5 min-h-12 items-center justify-center rounded-full bg-secondary px-5 active:opacity-70"
            onPress={() => void refetch()}
          >
            <Text className="font-semibold text-foreground">Try again</Text>
          </Pressable>
        </View>
      </ReaderCanvas>
    );
  }

  return (
    <ReaderCanvas color={readerCanvasColor} colorScheme={readerColorScheme}>
      <View style={{ flex: 1 }}>
        <ArticleBody
          colorScheme={readerColorScheme}
          bottomInset={tabBarOcclusionHeight}
          dom={{
            scrollEnabled: true,
            style: { backgroundColor: readerCanvasColor, flex: 1, opacity: isDomReady ? 1 : 0 },
          }}
          faviconUrls={faviconUrls}
          feedTitle={article.feedTitle}
          fontSizePx={17}
          onReady={handleArticleReady}
          reader={article.reader.selected}
          searchQuery={searchQuery}
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
            {Array.from({ length: mobileReaderLayout.title.skeletonLines }, (_, index) => (
              <Skeleton
                key={index}
                radius={4}
                style={{
                  height: mobileReaderSkeletonLayout.titleLineHeightPx,
                  width: index === 0 ? "100%" : index === 1 ? "88%" : "64%",
                }}
                surfaceColor={surfaceColor}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: mobileReaderSkeletonLayout.paragraphGapPx }}>
          {READER_SKELETON_PARAGRAPHS.map((paragraph, paragraphIndex) => (
            <View
              key={paragraphIndex}
              style={{ gap: mobileReaderSkeletonLayout.bodyLineSpacingPx }}
            >
              {paragraph.map((width, lineIndex) => (
                <Skeleton
                  key={lineIndex}
                  radius={4}
                  style={{ height: mobileReaderSkeletonLayout.bodyLineHeightPx, width }}
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
