import { Text, useWindowDimensions, View } from "react-native";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { FONT_STYLES } from "@/theme/fonts";

export function RecentHistoryEmptyState() {
  const { width } = useWindowDimensions();
  const emptyHorizontalInset = width * (32 / 390);

  return (
    <View
      className="flex-1 items-center justify-center gap-5 pb-24"
      style={{ paddingHorizontal: emptyHorizontalInset }}
    >
      <EmptyStateIcon size={176} />
      <View className="w-full items-center gap-2">
        <Text
          className="text-center text-foreground"
          numberOfLines={2}
          style={FONT_STYLES.screenTitle}
        >
          No recently viewed articles
        </Text>
        <Text
          className="text-center text-muted-foreground"
          lineBreakStrategyIOS="standard"
          numberOfLines={2}
          style={FONT_STYLES.bodySmall}
        >
          Older saved posts and clips will surface here after they've been waiting a while.
        </Text>
      </View>
    </View>
  );
}
