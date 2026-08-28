import { Host } from "@expo/ui";
import {
  Box,
  Button,
  CircularProgressIndicator,
  Column,
  Shape,
  Text,
} from "@expo/ui/jetpack-compose";
import { align, fillMaxWidth, height, padding, size } from "@expo/ui/jetpack-compose/modifiers";
import { useColorScheme } from "react-native";
import { useLogout } from "./hooks/use-logout";
import { SettingsScreenLayout } from "./components/screen-layout";
import { FONT_STYLES } from "@/theme/fonts";

const DESTRUCTIVE_THEMES = {
  dark: {
    destructive: "#ffb4ab",
    destructiveContainer: "#93000a",
  },
  light: {
    destructive: "#b3261e",
    destructiveContainer: "#ffdad6",
  },
} as const;

const BUTTON_LABEL_STYLE = FONT_STYLES.button;

export function SettingsScreen() {
  const colorScheme = useColorScheme();
  const destructiveTheme = DESTRUCTIVE_THEMES[colorScheme === "dark" ? "dark" : "light"];
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();

  return (
    <SettingsScreenLayout>
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Column
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), padding(24, 24, 24, 24)]}
        >
          <Button
            colors={{
              containerColor: destructiveTheme.destructiveContainer,
              contentColor: destructiveTheme.destructive,
            }}
            contentPadding={{ bottom: 14, top: 14 }}
            enabled={!isLoggingOut}
            onClick={confirmLogout}
            shape={Shape.Pill({})}
            modifiers={[fillMaxWidth()]}
          >
            <Box contentAlignment="center" modifiers={[fillMaxWidth(), height(22)]}>
              {isLoggingOut ? (
                <CircularProgressIndicator
                  color={destructiveTheme.destructive}
                  strokeWidth={2}
                  modifiers={[size(20, 20)]}
                />
              ) : (
                <Text modifiers={[align("center")]} style={BUTTON_LABEL_STYLE}>
                  Log out
                </Text>
              )}
            </Box>
          </Button>
          {errorMessage ? (
            <Text color={destructiveTheme.destructive} style={FONT_STYLES.bodySmall}>
              {errorMessage}
            </Text>
          ) : null}
        </Column>
      </Host>
    </SettingsScreenLayout>
  );
}
