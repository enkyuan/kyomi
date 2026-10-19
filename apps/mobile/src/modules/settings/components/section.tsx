import type { PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { FONT_STYLES } from "@/theme/fonts";

type SettingsSectionProps = PropsWithChildren<{
  description?: string;
  header: string;
}>;

export function SettingsSection({ children, description, header }: SettingsSectionProps) {
  return (
    <View className="gap-3">
      <View className="gap-1 px-5">
        <Text className="text-foreground" style={FONT_STYLES.compactTitle}>
          {header}
        </Text>
        {description ? (
          <Text className="text-muted-foreground" style={FONT_STYLES.bodyMediumMedium}>
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
