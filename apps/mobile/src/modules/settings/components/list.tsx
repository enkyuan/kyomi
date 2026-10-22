import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { BlodeIcon } from "@/components/icons/blode";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { SETTINGS_GROUPS } from "../lib/items";
import { AppearanceSection } from "./appearance";
import { SettingsSection } from "./section";

/** Icon slot of a settings row; action rows without an icon reserve it so labels align. */
export const ROW_ICON_SIZE = 20;

type SettingsListProps = {
  /** Rendered below the cards, for example an error message. */
  readonly footer?: ReactNode;
  /** A row appended to the last group's card, after a divider, such as Log out. */
  readonly lastGroupAction?: ReactNode;
};

export function List({ footer, lastGroupAction }: SettingsListProps) {
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
                <Pressable
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  className="active:opacity-70"
                  onPress={() => router.push(item.route as never)}
                >
                  <View className="min-h-13 flex-row items-center gap-3 px-5 py-3">
                    <BlodeIcon
                      color={theme.foreground}
                      icon={item.icon}
                      size={ROW_ICON_SIZE}
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
                </Pressable>
              </View>
            ))}
            {index === SETTINGS_GROUPS.length - 1 && lastGroupAction ? (
              <View>
                <View className="ml-13 h-px bg-border/70" />
                {lastGroupAction}
              </View>
            ) : null}
          </View>
        );

        if (index === 0) {
          return (
            <SettingsSection
              description="Manage your account and billing"
              header="Account"
              key="account-section"
            >
              {groupCard}
            </SettingsSection>
          );
        }

        if (index === 1) {
          return (
            <SettingsSection
              description="Customize your app experience"
              header="Preferences"
              key="preferences-section"
            >
              {groupCard}
            </SettingsSection>
          );
        }

        // Support and session actions sit in their own card, without a section header.
        return groupCard;
      })}
      {footer}
    </ScrollView>
  );
}
