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
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_600SemiBold,
  Newsreader_600SemiBold_Italic,
  Newsreader_700Bold,
  Newsreader_700Bold_Italic,
} from "@expo-google-fonts/newsreader";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { persister, queryClient } from "@lib/query/client";
import { useSessionGate } from "@modules/auth/hooks/use-session-gate";
import { FONT_FAMILIES } from "@/theme/fonts";
import { restoreThemeMode } from "@/theme/mode";

SplashScreen.preventAutoHideAsync();
restoreThemeMode();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isPending } = useSessionGate();
  const [fontsLoaded] = useFonts({
    [FONT_FAMILIES.inter.regular]: Inter_400Regular,
    [FONT_FAMILIES.inter.medium]: Inter_500Medium,
    [FONT_FAMILIES.inter.semibold]: Inter_600SemiBold,
    [FONT_FAMILIES.inter.bold]: Inter_700Bold,
    [FONT_FAMILIES.newsreader.regular]: Newsreader_400Regular,
    [FONT_FAMILIES.newsreader.italic]: Newsreader_400Regular_Italic,
    [FONT_FAMILIES.newsreader.semibold]: Newsreader_600SemiBold,
    [FONT_FAMILIES.newsreader.semiboldItalic]: Newsreader_600SemiBold_Italic,
    [FONT_FAMILIES.newsreader.bold]: Newsreader_700Bold,
    [FONT_FAMILIES.newsreader.boldItalic]: Newsreader_700Bold_Italic,
    [FONT_FAMILIES.jetbrainsMono.regular]: JetBrainsMono_400Regular,
    [FONT_FAMILIES.jetbrainsMono.medium]: JetBrainsMono_500Medium,
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
