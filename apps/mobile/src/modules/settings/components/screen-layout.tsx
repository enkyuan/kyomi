import { type PropsWithChildren } from "react";
import { ScrollView, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

/** Scroll content for the Settings stack modal; the stack owns its centered title. */
export function SettingsScreenLayout({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <ScrollView
      contentInset={{ bottom: insets.bottom + 24 }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background, flex: 1 }}
    >
      {children}
    </ScrollView>
  );
}
