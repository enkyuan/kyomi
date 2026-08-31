import type { PropsWithChildren } from "react";
import { SymbolView } from "expo-symbols";
import { ScrollView, Text, useColorScheme, View } from "react-native";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { SETTINGS_GROUPS } from "../lib/items";

type SettingsListProps = PropsWithChildren;

export function List({ children }: SettingsListProps) {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <ScrollView
      contentContainerClassName="gap-3 px-4 pb-6 pt-4"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background, flex: 1 }}
    >
      {SETTINGS_GROUPS.map((group) => (
        <View
          className="overflow-hidden rounded-3xl"
          key={group[0].id}
          style={{ backgroundColor: theme.card }}
        >
          {group.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <View className="h-px bg-border/70" /> : null}
              <View className="min-h-13 flex-row items-center gap-3 px-5 py-3">
                <SymbolView
                  accessibilityElementsHidden
                  name={item.symbol}
                  size={20}
                  tintColor={theme.foreground}
                  weight="regular"
                />
                <Text className="text-foreground" style={FONT_STYLES.body}>
                  {item.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
      {children}
    </ScrollView>
  );
}
