import { Text, View } from "react-native";

export function ResetScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text className="text-2xl font-semibold text-foreground">Reset password</Text>
    </View>
  );
}
