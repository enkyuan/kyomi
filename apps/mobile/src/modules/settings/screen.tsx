import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLogout } from "./hooks/use-logout";
import { SettingsScreenLayout } from "./components/screen-layout";
import { FONT_STYLES } from "@/theme/fonts";

const DESTRUCTIVE_TINT = "#fb414a";
const DESTRUCTIVE_FOREGROUND = "#ffffff";
const BUTTON_LABEL_STYLE = {
  color: DESTRUCTIVE_FOREGROUND,
  ...FONT_STYLES.button,
};

export function SettingsScreen() {
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();

  return (
    <SettingsScreenLayout>
      <View className="gap-3 p-4">
        <Pressable
          accessibilityLabel={isLoggingOut ? "Logging out" : "Log out"}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoggingOut }}
          disabled={isLoggingOut}
          onPress={confirmLogout}
          style={({ pressed }) => ({
            alignItems: "center",
            alignSelf: "stretch",
            backgroundColor: DESTRUCTIVE_TINT,
            borderRadius: 999,
            opacity: pressed || isLoggingOut ? 0.72 : 1,
            paddingHorizontal: 20,
            paddingVertical: 14,
            width: "100%",
          })}
        >
          <View style={{ height: 22, justifyContent: "center", width: "100%" }}>
            {isLoggingOut ? (
              <ActivityIndicator color={DESTRUCTIVE_FOREGROUND} size={20} />
            ) : (
              <Text style={{ ...BUTTON_LABEL_STYLE, textAlign: "center" }}>Log out</Text>
            )}
          </View>
        </Pressable>
        {errorMessage ? (
          <Text selectable style={{ ...FONT_STYLES.error, color: DESTRUCTIVE_TINT }}>
            {errorMessage}
          </Text>
        ) : null}
      </View>
    </SettingsScreenLayout>
  );
}
