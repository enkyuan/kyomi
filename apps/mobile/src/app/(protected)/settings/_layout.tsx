import { Stack } from "expo-router/stack";

export const unstable_settings = {
  anchor: "index",
};

const detailScreenOptions = { headerShown: true, title: "" } as const;

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerTitle: () => null, title: "Settings" }} />
      <Stack.Screen name="recents" options={{ headerShown: true, title: "Recents" }} />
      <Stack.Screen name="import-opml" options={detailScreenOptions} />
      <Stack.Screen name="billing" options={detailScreenOptions} />
      <Stack.Screen name="personalization" options={detailScreenOptions} />
      <Stack.Screen name="reader" options={detailScreenOptions} />
      <Stack.Screen name="advanced" options={detailScreenOptions} />
      <Stack.Screen name="feedback" options={detailScreenOptions} />
    </Stack>
  );
}
