import type { ReactNode } from "react";
import { FlatList, Pressable, Text, useColorScheme, View } from "react-native";
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

type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

type GroupCardProps = {
  readonly group: SettingsGroup;
  readonly isLast: boolean;
  readonly lastGroupAction?: ReactNode;
};

function GroupCard({ group, isLast, lastGroupAction }: GroupCardProps) {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <View className="overflow-hidden rounded-3xl" style={{ backgroundColor: theme.card }}>
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
      {isLast && lastGroupAction ? (
        <View>
          <View className="ml-13 h-px bg-border/70" />
          {lastGroupAction}
        </View>
      ) : null}
    </View>
  );
}

export function List({ footer, lastGroupAction }: SettingsListProps) {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <FlatList
      contentContainerClassName="gap-3 px-4 pb-6 pt-4"
      contentInsetAdjustmentBehavior="automatic"
      data={SETTINGS_GROUPS}
      keyExtractor={(group) => group[0].id}
      ListFooterComponent={<>{footer}</>}
      ListHeaderComponent={<AppearanceSection />}
      renderItem={({ item: group, index }) => {
        const groupCard = (
          <GroupCard
            group={group}
            isLast={index === SETTINGS_GROUPS.length - 1}
            lastGroupAction={lastGroupAction}
          />
        );

        if (index === 0) {
          return (
            <SettingsSection description="Manage your account and billing" header="Account">
              {groupCard}
            </SettingsSection>
          );
        }

        if (index === 1) {
          return (
            <SettingsSection description="Customize your app experience" header="Preferences">
              {groupCard}
            </SettingsSection>
          );
        }

        // Support and session actions sit in their own card, without a section header.
        return groupCard;
      }}
      style={{ backgroundColor: theme.background, flex: 1 }}
    />
  );
}
