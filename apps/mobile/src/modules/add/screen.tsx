import { Text, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export function AddScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <SafeAreaView
      className="flex-1 p-4"
      edges={["top"]}
      style={{ backgroundColor: theme.background }}
    >
      <Text className="text-xl font-semibold text-foreground">Add</Text>
    </SafeAreaView>
  );
}
