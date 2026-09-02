import type { ReactNode } from "react";
import { ScrollView, Text, useColorScheme, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { MingcuteIcon } from "@/components/icons/mingcute";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { SETTINGS_GROUPS } from "../lib/items";
import { AppearanceSection } from "./appearance";
import { SettingsSection } from "./section";

type SettingsListProps = {
  readonly footer?: ReactNode;
};

export function List({ footer }: SettingsListProps) {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <ScrollView
      contentContainerClassName="gap-3 px-4 pb-6 pt-4"
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background, flex: 1 }}
    >
      <AppearanceSection />
      {SETTINGS_GROUPS.map((group, index) => {
        const groupCard = (
          <View
            className="overflow-hidden rounded-3xl"
            key={group[0].id}
            style={{ backgroundColor: theme.card }}
          >
            {group.map((item, itemIndex) => (
              <View key={item.id}>
                {itemIndex > 0 ? <View className="ml-13 h-px bg-border/70" /> : null}
                <View className="min-h-13 flex-row items-center gap-3 px-5 py-3">
                  <MingcuteIcon
                    fill={theme.foreground}
                    icon={item.icon}
                    size={20}
                    style={{ transform: [{ translateY: -1 }] }}
                  />
                  <Text className="flex-1 text-foreground" style={FONT_STYLES.body}>
                    {item.label}
                  </Text>
                  <SymbolView
                    accessibilityElementsHidden
                    name={{
                      android: "chevron_right",
                      ios: "chevron.forward",
                      web: "chevron_right",
                    }}
                    size={16}
                    tintColor={theme.mutedForeground}
                    weight="regular"
                  />
                </View>
              </View>
            ))}
          </View>
        );

        return index === 0 ? (
          <SettingsSection
            description="Manage your account and billing"
            header="Account"
            key="account-section"
          >
            {groupCard}
          </SettingsSection>
        ) : (
          <SettingsSection
            description="Customize your app experience"
            header="Preferences"
            key="preferences-section"
          >
            {groupCard}
          </SettingsSection>
        );
      })}
      {footer}
    </ScrollView>
  );
}
