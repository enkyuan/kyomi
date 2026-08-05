import { Stack } from "expo-router/stack";

export default function InboxLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[article]" options={{ headerShown: false }} />
    </Stack>
  );
}
