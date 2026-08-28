import { Stack } from "expo-router/stack";
import { useEffect, useRef } from "react";
import { prefetchInitialExploreArticles } from "@modules/inbox/lib/articles";
import { useTheme } from "@ui/liquid-glass/hooks/use-theme";
import { ProgressiveBlur } from "@ui/liquid-glass/progressive-blur";

export default function AppLayout() {
  const hasPrefetchedRef = useRef(false);
  const { scheme } = useTheme();

  useEffect(() => {
    if (hasPrefetchedRef.current) return;

    hasPrefetchedRef.current = true;
    prefetchInitialExploreArticles();
  }, []);

  const blurHeader = {
    title: "",
    headerShown: true,
    headerBackVisible: false,
    headerTransparent: true,
    headerShadowVisible: false,
    headerBlurEffect: "none" as const,
    headerBackground: () => <ProgressiveBlur direction="top" tint={scheme} style={{ flex: 1 }} />,
  } as const;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />

      <Stack.Screen name="settings" options={{ ...blurHeader, presentation: "modal" }} />
    </Stack>
  );
}
