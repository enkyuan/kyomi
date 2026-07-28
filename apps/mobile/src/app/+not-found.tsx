import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-lg font-semibold text-foreground">This screen doesn't exist.</Text>
        <Link href="/" className="mt-3">
          <Text className="text-matcha">Go home</Text>
        </Link>
      </View>
    </>
  );
}
