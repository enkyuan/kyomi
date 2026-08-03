import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View } from "react-native";
import { FeedTabActions, hasSeparateFeedTabAction } from "./feed-actions";
import { getFloatingBarPosition, styles } from "../lib/styles";
import type { TabBarSurface } from "../lib/types";

type TabBarContentProps = BottomTabBarProps & {
  Surface: TabBarSurface;
};

/** Shared tab content so iOS can swap only its backdrop for native glass. */
export function TabBarContent({
  state,
  descriptors,
  insets,
  navigation,
  Surface,
}: TabBarContentProps) {
  return (
    <View style={[styles.row, getFloatingBarPosition(insets)]}>
      <View style={styles.wrapper}>
        <Surface style={styles.primarySurface}>
          <View accessibilityRole="tablist" style={styles.bar}>
            <FeedTabActions
              descriptors={descriptors}
              navigation={navigation}
              placement="primary"
              state={state}
            />
          </View>
        </Surface>
      </View>
      {hasSeparateFeedTabAction({ descriptors, state }) ? (
        <View style={styles.separateWrapper}>
          <Surface style={styles.separateSurface}>
            <View accessibilityRole="tablist" style={styles.separateBar}>
              <FeedTabActions
                descriptors={descriptors}
                navigation={navigation}
                placement="separate"
                state={state}
              />
            </View>
          </Surface>
        </View>
      ) : null}
    </View>
  );
}
