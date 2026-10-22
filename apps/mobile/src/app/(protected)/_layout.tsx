import { Stack } from "expo-router/stack";
import { useEffect, useRef } from "react";
import { prefetchInitialExploreArticles } from "@modules/articles/lib/requests";

export default function AppLayout() {
  const hasPrefetchedRef = useRef(false);

  useEffect(() => {
    if (hasPrefetchedRef.current) return;

    hasPrefetchedRef.current = true;
    prefetchInitialExploreArticles();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />

      {/* The settings stack owns its header (Stack.Toolbar needs the nested one), so this stays off. */}
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
    </Stack>
  );
}
