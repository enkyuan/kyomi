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
import { useSessionGate } from "@lib/session";
import { AppQueryClientProvider } from "@lib/query-client";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isPending } = useSessionGate();
  const [fontsLoaded] = useFonts({
    "Inter Variable": Inter_400Regular,
    "Inter Variable Medium": Inter_500Medium,
    "Inter Variable SemiBold": Inter_600SemiBold,
    "Inter Variable Bold": Inter_700Bold,
    "DM Sans": DMSans_400Regular,
    "DM Sans Medium": DMSans_500Medium,
    "DM Sans SemiBold": DMSans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded && !isPending) void SplashScreen.hideAsync();
  }, [fontsLoaded, isPending]);

  if (!fontsLoaded || isPending) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppQueryClientProvider>
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
      </AppQueryClientProvider>
    </GestureHandlerRootView>
  );
}
