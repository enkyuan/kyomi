import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Header } from "@ui/header";
import { useLogout } from "./hooks/use-logout";

const DESTRUCTIVE_TINT = "#fb414a";
const DESTRUCTIVE_FOREGROUND = "#ffffff";
const BUTTON_LABEL_STYLE = {
  color: DESTRUCTIVE_FOREGROUND,
  fontSize: 18,
  fontWeight: "600" as const,
};

export function SettingsScreen() {
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();

  return (
    <View className="flex-1 bg-background">
      <Header title="Settings" />
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="never">
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
            <Text selectable style={{ color: DESTRUCTIVE_TINT }}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
