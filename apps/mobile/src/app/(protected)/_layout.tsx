import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import { Pressable } from "react-native";
import { prefetchInitialExploreArticles } from "@modules/inbox/lib/articles";

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

      <Stack.Screen
        name="settings"
        options={{
          headerBackVisible: false,
          headerShown: true,
          headerShadowVisible: false,
          headerTitle: "Settings",
          headerTitleAlign: "center",
          presentation: "modal",

          headerRight: ({ tintColor }) => (
            <Pressable
              accessibilityLabel="Close settings"
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.dismiss()}
              style={({ pressed }) => ({
                opacity: pressed ? 0.55 : 1,
                padding: 4,
              })}
            >
              <SymbolView name="xmark" size={22} tintColor={tintColor} weight="regular" />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
