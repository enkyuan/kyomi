import { router, Stack } from "expo-router";
import { Text, View } from "react-native";
import { FONT_STYLES } from "@/theme/fonts";
import { useTheme } from "@ui/liquid-glass/hooks/use-theme";

const TOOLBAR_TITLE_WIDTH = 200;
const TOOLBAR_TITLE_HEIGHT = 36;

type SettingsDetailToolbarProps = {
  /**
   * When set, renders a custom left-aligned title view instead of relying on
   * the native Stack.Screen `title` (which is centered by default on iOS).
   * Omit this to let the native centered title show through — e.g. for
   * Recents, which wants a genuinely centered header.
   */
  readonly title?: string;
};

/**
 * Shared toolbar for screens pushed inside the settings modal's nested
 * stack. Anchors a back chevron on the left — popping within the modal —
 * instead of the root screen's dismiss (xmark) action.
 */
export function SettingsDetailToolbar({ title }: SettingsDetailToolbarProps) {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel="Back to settings"
          icon="chevron.left"
          onPress={() => router.back()}
          tintColor={colors.foreground}
        />
      </Stack.Toolbar>
      {title ? (
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
                style={[
                  FONT_STYLES.toolbarTitle,
                  { color: colors.foreground, letterSpacing: -0.3 },
                ]}
              >
                {title}
              </Text>
            </View>
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
