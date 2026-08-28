import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";
import { FONT_STYLES } from "@/theme/fonts";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-foreground" style={FONT_STYLES.screenTitle}>
          This screen doesn't exist.
        </Text>
        <Link href="/" className="mt-3">
          <Text className="text-matcha" style={FONT_STYLES.bodyMedium}>
            Go home
          </Text>
        </Link>
      </View>
    </>
  );
}
