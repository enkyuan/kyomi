import { Stack } from "expo-router/stack";
import { useTheme } from "@ui/liquid-glass/hooks/use-theme";
import { ProgressiveBlur } from "@ui/liquid-glass/progressive-blur";

export const unstable_settings = {
  anchor: "index",
};

export default function SettingsLayout() {
  const { scheme } = useTheme();

  // One header for the whole modal: transparent over a progressive blur, with an empty centre so
  // only the toolbar's title and close button show (otherwise it falls back to the route name).
  const blurHeader = {
    headerBackground: () => <ProgressiveBlur direction="top" style={{ flex: 1 }} tint={scheme} />,
    headerBlurEffect: "none" as const,
    headerShadowVisible: false,
    headerShown: true,
    headerTitle: "",
    headerTransparent: true,
  } as const;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{ ...blurHeader, headerBackVisible: false, title: "Settings" }}
      />
      <Stack.Screen
        name="recents"
        options={{ ...blurHeader, headerTitle: "Recents", title: "Recents" }}
      />
      <Stack.Screen name="import-opml" options={blurHeader} />
      <Stack.Screen name="billing" options={blurHeader} />
      <Stack.Screen name="personalization" options={blurHeader} />
      <Stack.Screen name="reader" options={blurHeader} />
      <Stack.Screen name="advanced" options={blurHeader} />
      <Stack.Screen name="feedback" options={blurHeader} />
    </Stack>
  );
}
