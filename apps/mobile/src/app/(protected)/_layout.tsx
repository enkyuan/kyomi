import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import { useEffect, useRef } from "react";
import { Pressable, type ColorValue } from "react-native";
import { CloseIcon } from "@/components/icons/close";
import { prefetchInitialAllArticles } from "@modules/inbox/lib/articles";

function SettingsCloseButton({ tintColor }: { tintColor?: ColorValue }) {
  return (
    <Pressable
      accessibilityLabel="Close settings"
      accessibilityRole="button"
      hitSlop={12}
      onPress={() => router.dismiss()}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, padding: 4 })}
    >
      <CloseIcon fill={tintColor ?? "#f2f2f7"} size={22} />
    </Pressable>
  );
}

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
          headerBackVisible: false,
          headerRight: ({ tintColor }) => <SettingsCloseButton tintColor={tintColor} />,
          headerShown: true,
          headerTitle: "Settings",
          headerTitleAlign: "center",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
