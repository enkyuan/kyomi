import { Stack } from "expo-router/stack";
import { useEffect, useRef } from "react";
import { prefetchInitialAllArticles } from "@modules/inbox/lib/articles";

export default function AppLayout() {
  const hasPrefetchedRef = useRef(false);

  useEffect(() => {
    if (hasPrefetchedRef.current) {
      return;
    }

    hasPrefetchedRef.current = true;
    prefetchInitialAllArticles();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
          headerTitle: "Settings",
          headerTitleAlign: "center",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
