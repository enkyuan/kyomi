import { Stack } from "expo-router/stack";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: "Settings" }} />
    </Stack>
  );
}
