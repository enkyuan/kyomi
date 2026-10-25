import { Stack } from "expo-router/stack";
import { useEffect, useRef } from "react";
import { prefetchInitialExploreArticles } from "@modules/articles/lib/requests";
import { useBufferedProgressRetry } from "@modules/reader/hooks/use-buffered-progress-retry";

export default function AppLayout() {
  const hasPrefetchedRef = useRef(false);

  useBufferedProgressRetry();

  useEffect(() => {
    if (hasPrefetchedRef.current) return;

    hasPrefetchedRef.current = true;
    prefetchInitialExploreArticles();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />

      {/* The folder's feeds sit under the native header, which carries its name and the back button. */}
      <Stack.Screen
        name="folders/[folder]"
        options={{
          headerBackButtonDisplayMode: "minimal",
          headerShadowVisible: false,
          headerShown: true,
        }}
      />

      {/* The settings stack owns its header (Stack.Toolbar needs the nested one), so this stays off. */}
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
    </Stack>
  );
}
