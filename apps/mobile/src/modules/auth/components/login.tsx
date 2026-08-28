import { Text, View } from "react-native";
import { FONT_STYLES } from "@/theme/fonts";

export function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text className="text-foreground" style={FONT_STYLES.screenTitle}>
        Log in
      </Text>
    </View>
  );
}
