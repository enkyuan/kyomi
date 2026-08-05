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
import { View, useColorScheme } from "react-native";
import { Header } from "@ui/header";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { useLogout } from "./hooks/use-logout";

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

const BUTTON_LABEL_STYLE = { fontSize: 18, fontWeight: "600" as const };

export function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = getMobileSurfaceTheme(colorScheme);
  const destructiveTheme = DESTRUCTIVE_THEMES[colorScheme === "dark" ? "dark" : "light"];
  const { confirmLogout, errorMessage, isLoggingOut } = useLogout();

  return (
    <View style={{ backgroundColor: theme.background, flex: 1 }}>
      <Header title="Settings" />
      <Host style={{ flex: 1 }}>
        <Column
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxSize(), background(theme.background), padding(24, 24, 24, 24)]}
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
            <Text color={destructiveTheme.destructive} style={{ fontSize: 14 }}>
              {errorMessage}
            </Text>
          ) : null}
        </Column>
      </Host>
    </View>
  );
}
