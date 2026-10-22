import { Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { FileArrowLeftInNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon } from "@/components/icons/blode";
import { SettingsDetailToolbar } from "@modules/settings/components/detail-toolbar";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export default function ImportOpmlRoute() {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const { width } = useWindowDimensions();

  return (
    <>
      <View
        className="flex-1 items-center justify-center gap-5 pb-24"
        style={{ backgroundColor: theme.background, paddingHorizontal: width * (32 / 390) }}
      >
        <BlodeIcon color={theme.mutedForeground} icon={FileArrowLeftInNativeIcon} size={64} />
        <View className="w-full items-center gap-2">
          <Text
            className="text-center"
            style={[FONT_STYLES.screenTitle, { color: theme.foreground }]}
          >
            Import OPML
          </Text>
          <Text
            className="text-center"
            style={[FONT_STYLES.bodySmall, { color: theme.mutedForeground }]}
          >
            Bring your feeds over from another reader by importing an OPML file.
          </Text>
        </View>
      </View>
      <SettingsDetailToolbar title="Import OPML" />
    </>
  );
}
