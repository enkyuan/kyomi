import { Stack } from "expo-router/stack";
import { Platform } from "react-native";

export default function InboxLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true }}>
      <Stack.Screen
        name="index"
        options={
          Platform.OS === "ios" ? { headerShown: false } : { headerShown: true, title: "Home" }
        }
      />
      <Stack.Screen name="[article]" options={{ headerShown: false }} />
    </Stack>
  );
}
