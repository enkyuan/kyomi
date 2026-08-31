import { ActivityIndicator, Pressable, Text, useColorScheme, View } from "react-native";
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
        <View className="gap-2">
          <Pressable
            accessibilityLabel={isLoggingOut ? "Logging out" : "Log out"}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoggingOut }}
            disabled={isLoggingOut}
            onPress={confirmLogout}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: theme.card,
              borderRadius: 999,
              height: 50,
              justifyContent: "center",
              opacity: pressed || isLoggingOut ? 0.72 : 1,
            })}
          >
            <View className="flex-row items-center gap-3">
              <MingcuteIcon fill={theme.foreground} icon={WaveHandFillNativeIcon} size={20} />
              {isLoggingOut ? (
                <ActivityIndicator color={theme.foreground} size={20} />
              ) : (
                <Text className="text-foreground" style={FONT_STYLES.body}>
                  Log out
                </Text>
              )}
            </View>
          </Pressable>
          {errorMessage ? (
            <Text selectable style={{ ...FONT_STYLES.error, color: mobileColors.systemError }}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
      </List>
    </SettingsScreenLayout>
  );
}
