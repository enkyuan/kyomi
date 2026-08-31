import type { ReactNode } from "react";
import { Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

const EMPTY_HORIZONTAL_INSET_RATIO = 22 / 390;

type EmptyStateProps = {
  asset: ReactNode;
  description: string;
  header: string;
  height: number;
  topContentInset: number;
};

/** Shared empty-state layout for inbox views with different content and artwork. */
export function EmptyState({
  asset,
  description,
  header,
  height,
  topContentInset,
}: EmptyStateProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = getMobileSurfaceTheme(useColorScheme());
  const horizontalInset = width * EMPTY_HORIZONTAL_INSET_RATIO;
  const contentWidth = Math.max(0, width - horizontalInset * 2);
  const availableHeight = Math.max(0, height - topContentInset - getTabBarOcclusionHeight(insets));

  return (
    <View
      className="items-center justify-center gap-5"
      style={{ height: availableHeight, paddingHorizontal: horizontalInset }}
    >
      {asset}
      <View className="items-center gap-2" style={{ width: contentWidth }}>
        <Text
          numberOfLines={1}
          style={{
            ...FONT_STYLES.sectionTitle,
            color: theme.foreground,
            textAlign: "center",
          }}
        >
          {header}
        </Text>
        <Text
          style={{
            ...FONT_STYLES.bodyLarge,
            color: theme.mutedForeground,
            textAlign: "center",
          }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}
