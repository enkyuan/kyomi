import { Text, useColorScheme, View } from "react-native";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { EMPTY_STATES } from "@modules/inbox/components/empty-states";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

/** Follows the Import OPML empty state: a glyph in the dashed circle, one line of text below. */
export function RecentHistoryEmptyState() {
  const theme = getMobileSurfaceTheme(useColorScheme());

  return (
    <View
      className="flex-1 items-center justify-center gap-5 pb-24"
      style={{ paddingHorizontal: 32 }}
    >
      <EmptyStateIcon icon={EMPTY_STATES.recents.icon} size={176} />
      {/* React Native has no `text-wrap: balance`, so the two lines are broken by hand. */}
      <Text
        style={[
          FONT_STYLES.bodyMediumMedium,
          { color: theme.mutedForeground, textAlign: "center" },
        ]}
      >
        {EMPTY_STATES.recents.description}
      </Text>
    </View>
  );
}
