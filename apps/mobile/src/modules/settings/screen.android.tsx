import { Host } from "@expo/ui";
import {
  Box,
  Button,
  CircularProgressIndicator,
  Column,
  Shape,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import { useColorScheme } from "react-native";
import { useLogout } from "./hooks/use-logout";

const THEMES = {
  dark: {
    background: "#100d09",
    destructive: "#ffb4ab",
    destructiveContainer: "#93000a",
  },
  light: {
    background: "#f7f5f2",
    destructive: "#b3261e",
    destructiveContainer: "#ffdad6",
  },
};

const BUTTON_LABEL_STYLE = { fontSize: 18, fontWeight: "600" as const };

export function SettingsScreen() {
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const theme = THEMES[colorScheme];
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();

  return (
    <Host style={{ flex: 1 }}>
      <Column
        verticalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxSize(), background(theme.background), padding(24, 24, 24, 24)]}
      >
        <Button
          colors={{
            containerColor: theme.destructiveContainer,
            contentColor: theme.destructive,
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
                color={theme.destructive}
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
          <Text color={theme.destructive} style={{ fontSize: 14 }}>
            {errorMessage}
          </Text>
        ) : null}
      </Column>
    </Host>
  );
}
