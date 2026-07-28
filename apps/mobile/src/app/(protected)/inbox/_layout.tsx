import { Stack } from "expo-router/stack";

export default function InboxLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Inbox" }} />
      <Stack.Screen name="[article]" options={{ headerLargeTitle: false, title: "" }} />
    </Stack>
  );
}
