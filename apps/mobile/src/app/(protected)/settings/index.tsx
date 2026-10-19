import { router, Stack } from "expo-router";
import { Text, View } from "react-native";
import { FONT_STYLES } from "@/theme/fonts";
import { useTheme } from "@ui/liquid-glass/hooks/use-theme";
import { SettingsScreen } from "@modules/settings/screen";

const TOOLBAR_TITLE_WIDTH = 200;
const TOOLBAR_TITLE_HEIGHT = 36;

export default function SettingsRoute() {
  const { colors } = useTheme();

  return (
    <>
      <SettingsScreen />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <View
            style={{
              height: TOOLBAR_TITLE_HEIGHT,
              justifyContent: "center",
              width: TOOLBAR_TITLE_WIDTH,
            }}
          >
            <Text
              style={[FONT_STYLES.toolbarTitle, { color: colors.foreground, letterSpacing: -0.3 }]}
            >
              Settings
            </Text>
          </View>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Close settings"
          icon="xmark"
          onPress={() => router.dismiss()}
          tintColor={colors.foreground}
        />
      </Stack.Toolbar>
    </>
  );
}
