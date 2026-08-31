import { Button, Host } from "@expo/ui";
import { CircularProgressIndicator, Column, Row, RNHostView, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, height, size } from "@expo/ui/jetpack-compose/modifiers";
import { useColorScheme } from "react-native";
import { List } from "./components/list";
import { SettingsScreenLayout } from "./components/screen-layout";
import { useLogout } from "./hooks/use-logout";
import { MingcuteIcon } from "@/components/icons/mingcute";
import { WaveHandFillNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import { mobileColors } from "@/theme/colors";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export function SettingsScreen() {
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <SettingsScreenLayout>
      <List>
        <Host style={{ height: errorMessage ? 80 : 50, width: "100%" }}>
          <Column verticalArrangement={{ spacedBy: 8 }}>
            <Button
              disabled={isLoggingOut}
              onPress={confirmLogout}
              style={{ backgroundColor: theme.card, borderRadius: 999, height: 50, width: "100%" }}
              variant="filled"
            >
              <Row
                horizontalArrangement={{ spacedBy: 12 }}
                verticalAlignment="center"
                modifiers={[fillMaxWidth(), height(22)]}
              >
                <RNHostView matchContents>
                  <MingcuteIcon fill={theme.foreground} icon={WaveHandFillNativeIcon} size={20} />
                </RNHostView>
                {isLoggingOut ? (
                  <CircularProgressIndicator
                    color={theme.foreground}
                    modifiers={[size(20, 20)]}
                    strokeWidth={2}
                  />
                ) : (
                  <Text color={theme.foreground} style={FONT_STYLES.body}>
                    Log out
                  </Text>
                )}
              </Row>
            </Button>
            {errorMessage ? (
              <Text color={mobileColors.systemError} style={FONT_STYLES.bodySmall}>
                {errorMessage}
              </Text>
            ) : null}
          </Column>
        </Host>
      </List>
    </SettingsScreenLayout>
  );
}
