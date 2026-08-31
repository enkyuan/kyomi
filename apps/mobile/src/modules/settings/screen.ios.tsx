import { Button, Host } from "@expo/ui";
import { HStack, ProgressView, RNHostView, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  controlSize,
  frame,
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "react-native";
import { List } from "./components/list";
import { SettingsScreenLayout } from "./components/screen-layout";
import { useLogout } from "./hooks/use-logout";
import { MingcuteIcon } from "@/components/icons/mingcute";
import { WaveHandFillNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import { mobileColors } from "@/theme/colors";
import { FONT_FAMILIES, FONT_SIZES, SWIFT_FONT_WEIGHTS } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

const FULL_WIDTH = frame({ maxWidth: Infinity });
const BUTTON_FONT = font({
  family: FONT_FAMILIES.inter.regular,
  size: FONT_SIZES.body,
  weight: SWIFT_FONT_WEIGHTS.regular,
});
const ERROR_FONT = font({ family: FONT_FAMILIES.inter.regular, size: FONT_SIZES.bodySmall });

export function SettingsScreen() {
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <SettingsScreenLayout>
      <List>
        <Host style={{ height: errorMessage ? 80 : 50, width: "100%" }}>
          <VStack spacing={8} modifiers={[FULL_WIDTH]}>
            <Button
              disabled={isLoggingOut}
              onPress={confirmLogout}
              style={{ backgroundColor: theme.card }}
              variant="filled"
              modifiers={[
                FULL_WIDTH,
                controlSize("large"),
                buttonBorderShape("capsule"),
                accessibilityLabel(isLoggingOut ? "Logging out" : "Log out"),
              ]}
            >
              <HStack alignment="center" spacing={12}>
                <RNHostView matchContents>
                  <MingcuteIcon fill={theme.foreground} icon={WaveHandFillNativeIcon} size={20} />
                </RNHostView>
                {isLoggingOut ? (
                  <ProgressView
                    modifiers={[controlSize("regular"), frame({ height: 20, width: 20 })]}
                  />
                ) : (
                  <Text modifiers={[BUTTON_FONT, foregroundStyle(theme.foreground)]}>Log out</Text>
                )}
              </HStack>
            </Button>
            {errorMessage ? (
              <Text modifiers={[ERROR_FONT, foregroundStyle(mobileColors.systemError)]}>
                {errorMessage}
              </Text>
            ) : null}
          </VStack>
        </Host>
      </List>
    </SettingsScreenLayout>
  );
}
