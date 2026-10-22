import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { List, ROW_ICON_SIZE } from "./components/list";
import { SettingsScreenLayout } from "./components/screen-layout";
import { useLogout } from "./hooks/use-logout";
import { mobileColors } from "@/theme/colors";
import { FONT_STYLES } from "@/theme/fonts";

export function SettingsScreen() {
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();

  return (
    <SettingsScreenLayout>
      <List
        footer={
          errorMessage ? (
            <Text selectable style={{ ...FONT_STYLES.error, color: mobileColors.systemError }}>
              {errorMessage}
            </Text>
          ) : null
        }
        lastGroupAction={
          <Pressable
            accessibilityLabel={isLoggingOut ? "Logging out" : "Log out"}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoggingOut }}
            className="active:opacity-70"
            disabled={isLoggingOut}
            onPress={confirmLogout}
            style={{ opacity: isLoggingOut ? 0.72 : 1 }}
          >
            <View className="min-h-13 flex-row items-center gap-3 px-5 py-3">
              {/* No icon, but its slot, so the label lines up with the rows above. */}
              <View style={{ height: ROW_ICON_SIZE, width: ROW_ICON_SIZE }} />
              {isLoggingOut ? (
                <ActivityIndicator color={mobileColors.destructive} size={20} />
              ) : (
                <Text style={[FONT_STYLES.body, { color: mobileColors.destructive }]}>Log out</Text>
              )}
            </View>
          </Pressable>
        }
      />
    </SettingsScreenLayout>
  );
}
