import { type PropsWithChildren } from "react";
import { View, useColorScheme } from "react-native";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

/** Background boundary; the native settings list owns scrolling. */
export function SettingsScreenLayout({ children }: PropsWithChildren) {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      {children}
    </View>
  );
}
