import { Host } from "@expo/ui";
import { Button, ProgressView, ScrollView, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  frame,
  font,
  foregroundStyle,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Platform, View, useColorScheme } from "react-native";
import { Header } from "@ui/header";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { useLogout } from "./hooks/use-logout";

const DESTRUCTIVE_TINT = "#fb414a";
const DESTRUCTIVE_FOREGROUND = "#ffffff";
const LOG_OUT_BUTTON_STYLE =
  Number.parseInt(String(Platform.Version), 10) >= 26 ? "glassProminent" : "borderedProminent";
const FULL_WIDTH = frame({ maxWidth: Infinity });
const BUTTON_LABEL_FONT = font({ weight: "semibold", size: 18 });

export function SettingsScreen() {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();

  return (
    <View style={{ backgroundColor: theme.background, flex: 1 }}>
      <Header title="Settings" />
      <Host style={{ flex: 1 }}>
        <ScrollView
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            background(theme.background),
          ]}
          showsIndicators={false}
        >
          <VStack
            spacing={12}
            modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 24, vertical: 16 })]}
          >
            <Button
              modifiers={[
                buttonStyle(LOG_OUT_BUTTON_STYLE),
                buttonBorderShape("capsule"),
                tint(DESTRUCTIVE_TINT),
                disabled(isLoggingOut),
                controlSize("extraLarge"),
                accessibilityLabel(isLoggingOut ? "Logging out" : "Log out"),
                FULL_WIDTH,
              ]}
              onPress={confirmLogout}
              role="destructive"
            >
              <ZStack modifiers={[FULL_WIDTH, frame({ height: 22 })]}>
                {isLoggingOut ? (
                  <ProgressView
                    modifiers={[
                      tint(DESTRUCTIVE_FOREGROUND),
                      controlSize("regular"),
                      frame({ width: 20, height: 20 }),
                    ]}
                  />
                ) : (
                  <Text modifiers={[BUTTON_LABEL_FONT, foregroundStyle(DESTRUCTIVE_FOREGROUND)]}>
                    Log out
                  </Text>
                )}
              </ZStack>
            </Button>
            {errorMessage ? (
              <Text modifiers={[foregroundStyle("#ff453a")]}>{errorMessage}</Text>
            ) : null}
          </VStack>
        </ScrollView>
      </Host>
    </View>
  );
}
