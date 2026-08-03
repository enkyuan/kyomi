import { Stack } from "expo-router/stack";

export default function RecentsLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen name="index" options={{ title: "Recents" }} />
    </Stack>
  );
}
