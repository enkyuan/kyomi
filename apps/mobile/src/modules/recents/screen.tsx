import { useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export function RecentsScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <SafeAreaView
      className="flex-1 p-4"
      edges={["top"]}
      style={{ backgroundColor: theme.background }}
    />
  );
}
