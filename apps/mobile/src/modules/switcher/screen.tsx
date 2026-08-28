import { Text, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export function SwitcherScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <SafeAreaView
      className="flex-1 p-4"
      edges={["top"]}
      style={{ backgroundColor: theme.background }}
    >
      <Text className="text-foreground" style={FONT_STYLES.sectionTitle}>
        Switcher
      </Text>
    </SafeAreaView>
  );
}
