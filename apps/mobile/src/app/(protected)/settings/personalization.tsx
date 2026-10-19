import { Text, useColorScheme, View } from "react-native";
import { SettingsDetailToolbar } from "@modules/settings/components/detail-toolbar";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export default function PersonalizationRoute() {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <>
      <View
        className="flex-1 items-center justify-center gap-2 px-8"
        style={{ backgroundColor: theme.background }}
      >
        <Text style={[FONT_STYLES.sectionTitle, { color: theme.foreground, textAlign: "center" }]}>
          Personalization
        </Text>
        <Text
          style={[FONT_STYLES.bodyLarge, { color: theme.mutedForeground, textAlign: "center" }]}
        >
          Tailor recommendations and reading preferences to your taste.
        </Text>
      </View>
      <SettingsDetailToolbar title="Personalization" />
    </>
  );
}
