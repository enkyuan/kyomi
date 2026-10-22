import { ActivityIndicator, Pressable, Text, useColorScheme, View } from "react-native";
import { List } from "./components/list";
import { SettingsScreenLayout } from "./components/screen-layout";
import { useLogout } from "./hooks/use-logout";
import { mobileColors } from "@/theme/colors";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export function SettingsScreen() {
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <SettingsScreenLayout>
      <List
        footer={
          <View className="gap-2">
            <Pressable
              accessibilityLabel={isLoggingOut ? "Logging out" : "Log out"}
              accessibilityRole="button"
              accessibilityState={{ disabled: isLoggingOut }}
              disabled={isLoggingOut}
              onPress={confirmLogout}
              style={({ pressed }) => ({
                alignItems: "center",
                alignSelf: "stretch",
                backgroundColor: theme.card,
                borderRadius: 999,
                height: 50,
                justifyContent: "center",
                opacity: pressed || isLoggingOut ? 0.72 : 1,
              })}
            >
              <View className="w-full flex-row items-center justify-center gap-3 px-5">
                {isLoggingOut ? (
                  <ActivityIndicator color={theme.foreground} size={20} />
                ) : (
                  <Text
                    className="text-foreground"
                    style={[FONT_STYLES.body, { transform: [{ translateY: -1 }] }]}
                  >
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
        }
      />
    </SettingsScreenLayout>
  );
}
