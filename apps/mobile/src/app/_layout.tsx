import "../uniwind.css";

import { Stack } from "expo-router/stack";
import { ThemeProvider, DarkTheme, DefaultTheme } from "expo-router/react-navigation";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persister, queryClient } from "@lib/query/client";
import { useSessionGate } from "@lib/session";
import { FONT_FAMILIES } from "@/theme/fonts";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isPending } = useSessionGate();
  const [fontsLoaded] = useFonts({
    [FONT_FAMILIES.inter.regular]: Inter_400Regular,
    [FONT_FAMILIES.inter.medium]: Inter_500Medium,
    [FONT_FAMILIES.inter.semibold]: Inter_600SemiBold,
    [FONT_FAMILIES.inter.bold]: Inter_700Bold,
    [FONT_FAMILIES.dmSans.regular]: DMSans_400Regular,
    [FONT_FAMILIES.dmSans.medium]: DMSans_500Medium,
    [FONT_FAMILIES.dmSans.semibold]: DMSans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded && !isPending) void SplashScreen.hideAsync();
  }, [fontsLoaded, isPending]);

  if (!fontsLoaded || isPending) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={isAuthenticated}>
              <Stack.Screen name="(protected)" />
            </Stack.Protected>
            <Stack.Protected guard={!isAuthenticated}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
