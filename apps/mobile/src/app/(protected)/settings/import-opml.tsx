import { Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { FileArrowLeftInNativeIcon } from "@kyomi/ui/icons/blode-native";
import { EmptyStateIcon } from "@/components/icons/empty-state";
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
        <EmptyStateIcon icon={FileArrowLeftInNativeIcon} size={176} />
        {/* React Native has no `text-wrap: balance`, so the two lines are broken by hand. */}
        <Text
          className="text-center"
          style={[FONT_STYLES.bodySmall, { color: theme.mutedForeground }]}
        >
          {"Bring your feeds over from another\nreader by importing an OPML file."}
        </Text>
      </View>
      <SettingsDetailToolbar title="Import OPML" />
    </>
  );
}
