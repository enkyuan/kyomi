import { Text, useColorScheme, View } from "react-native";
import { SettingsDetailToolbar } from "@modules/settings/components/detail-toolbar";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export default function ReaderRoute() {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <>
      <View
        className="flex-1 items-center justify-center gap-2 px-8"
        style={{ backgroundColor: theme.background }}
      >
        <Text style={[FONT_STYLES.sectionTitle, { color: theme.foreground, textAlign: "center" }]}>
          Reader
        </Text>
        <Text
          style={[FONT_STYLES.bodyLarge, { color: theme.mutedForeground, textAlign: "center" }]}
        >
          Customize typography, layout, and reading behavior.
        </Text>
      </View>
      <SettingsDetailToolbar title="Reader" />
    </>
  );
}
