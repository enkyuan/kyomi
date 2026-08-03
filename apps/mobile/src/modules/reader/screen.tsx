import { Stack, useNavigation, type NativeStackNavigationProp } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReaderTabBar, type ReaderTabBarConfig } from "@/components/ui/tab-bar/reader-mode";
import { getReaderTabBarOcclusionHeight } from "@/components/ui/tab-bar/lib/styles";
import { Skeleton } from "@ui/skeleton";
import { fetchMobileApiJson } from "@/lib/api-client";
import ArticleBody from "./components/article-body.dom";
import { useReaderActions } from "./hooks/use-reader-actions";
import { useReaderArticle } from "./hooks/use-reader-article";
import { getReaderCanvasColor, getReaderColorScheme } from "./lib/theme";

export type ReaderScreenProps = {
  readonly articleId: string;
};

type ReaderStackNavigation = NativeStackNavigationProp<Record<string, object | undefined>>;

export function ReaderScreen({ articleId }: ReaderScreenProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ReaderStackNavigation>();
  const readerColorScheme = getReaderColorScheme(colorScheme);
  const readerCanvasColor = getReaderCanvasColor(colorScheme);
  const tabBarOcclusionHeight = getReaderTabBarOcclusionHeight(insets);
  const { setConfig, setIsDismissingReader } = useReaderTabBar();
  const [isDomReady, setIsDomReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: article, error, isLoading, refetch } = useReaderArticle(articleId);
  const actions = useReaderActions(article);
  const actionRef = useRef(actions);
  actionRef.current = actions;

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
    if (!article || article.isRead) {
      return;
    }
    void fetchMobileApiJson<{ message: string }>(
      `/api/v1/articles/${encodeURIComponent(article.id)}/view`,
      { method: "POST" },
    ).catch(() => undefined);
  }, [article?.id, article?.isRead]);

  if (isLoading) {
    return (
      <ReaderCanvas color={readerCanvasColor} colorScheme={readerColorScheme}>
        <ReaderSkeleton bottomInset={tabBarOcclusionHeight} />
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

  const handleArticleReady = useCallback(() => {
    setIsDomReady(true);
  }, []);

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
          feedTitle={article.feedTitle}
          fontSizePx={17}
          imageUrl={article.imageUrl}
          onReady={handleArticleReady}
          reader={article.reader.selected}
          searchQuery={searchQuery}
          summary={article.summary}
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
            <ReaderSkeleton bottomInset={tabBarOcclusionHeight} />
          </View>
        ) : null}
      </View>
    </ReaderCanvas>
  );
}

function ReaderSkeleton({ bottomInset }: { readonly bottomInset: number }) {
  return (
    <View className="flex-1 px-5 pt-5" style={{ paddingBottom: bottomInset }}>
      <View className="gap-3">
        <Skeleton className="h-3.5 w-32" radius={4} />
        <View className="gap-2">
          <Skeleton className="h-8 w-full" radius={6} />
          <Skeleton className="h-8 w-[85%]" radius={6} />
        </View>
        <View className="mt-1 gap-2">
          <Skeleton className="h-4 w-full" radius={4} />
          <Skeleton className="h-4 w-[92%]" radius={4} />
        </View>
      </View>
      <View className="mt-8 gap-3">
        <Skeleton className="h-4 w-full" radius={4} />
        <Skeleton className="h-4 w-full" radius={4} />
        <Skeleton className="h-4 w-[88%]" radius={4} />
        <Skeleton className="h-4 w-full" radius={4} />
        <Skeleton className="h-4 w-[70%]" radius={4} />
      </View>
      <View className="mt-6 gap-3">
        <Skeleton className="h-4 w-full" radius={4} />
        <Skeleton className="h-4 w-[95%]" radius={4} />
        <Skeleton className="h-4 w-[80%]" radius={4} />
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
