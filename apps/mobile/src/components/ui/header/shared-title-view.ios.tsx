import { Host, Text } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, useColorScheme, View } from "react-native";
import Animated, { type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT_FAMILIES, FONT_SIZES, FONT_STYLES, SWIFT_FONT_WEIGHTS } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { COMPACT_NAV_HEIGHT } from "./collapsing";
import { useSharedHeaderTitleState } from "./shared-title";
import { useTitleScrollStyles } from "./title-scroll";

/** Width the actions take at the header's trailing edge, which the large title stays clear of. */
const ACTIONS_RESERVE = 130;
/** The native cross-fade between two titles. */
const TITLE_SWAP = Animation.easeInOut({ duration: 0.3 });

/**
 * The inbox tabs' header title, drawn once above both screens as SwiftUI text so that swapping
 * My Feeds and Explore is SwiftUI's own content transition, in the place and style the header's
 * title always had. The screens' headers keep the blur and actions.
 */
export function SharedHeaderTitle() {
  const { scrollY, title, version } = useSharedHeaderTitleState();
  return scrollY ? <TitleView scrollY={scrollY} title={title} version={version} /> : null;
}

type TitleViewProps = {
  scrollY: SharedValue<number>;
  title: string | null;
  version: number;
};

function TitleView({ scrollY, title, version }: TitleViewProps) {
  const insets = useSafeAreaInsets();
  const { foreground } = getMobileSurfaceTheme(useColorScheme());
  const { compactTitleStyle, largeTitleStyle } = useTitleScrollStyles(scrollY);

  const text = title ?? "";
  const swap = [contentTransition("opacity"), animation(TITLE_SWAP, version)];

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { height: insets.top + COMPACT_NAV_HEIGHT, paddingTop: insets.top }]}
    >
      <Animated.View
        accessibilityLabel={text}
        accessibilityRole="header"
        accessible={text.length > 0}
        style={[styles.largeTitle, largeTitleStyle]}
      >
        <Host style={{ height: FONT_STYLES.largeTitle.lineHeight, width: "100%" }}>
          <Text
            modifiers={[
              font({
                family: FONT_FAMILIES.inter.bold,
                size: FONT_SIZES.largeTitle,
                weight: SWIFT_FONT_WEIGHTS.bold,
              }),
              kerning(-0.45),
              foregroundStyle(foreground),
              lineLimit(1),
              frame({ maxWidth: Infinity, alignment: "leading" }),
              ...swap,
            ]}
          >
            {text}
          </Text>
        </Host>
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.compactTitle, compactTitleStyle]}
      >
        <Host style={{ height: FONT_STYLES.compactTitle.lineHeight, width: "100%" }}>
          <Text
            modifiers={[
              font({
                family: FONT_FAMILIES.inter.semibold,
                size: FONT_SIZES.compactTitle,
                weight: SWIFT_FONT_WEIGHTS.semibold,
              }),
              kerning(-0.25),
              foregroundStyle(foreground),
              lineLimit(1),
              frame({ maxWidth: Infinity, alignment: "center" }),
              ...swap,
            ]}
          >
            {text}
          </Text>
        </Host>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactTitle: {
    alignItems: "center",
    bottom: 0,
    height: COMPACT_NAV_HEIGHT,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  largeTitle: {
    bottom: 0,
    height: COMPACT_NAV_HEIGHT,
    justifyContent: "center",
    left: 20,
    position: "absolute",
    right: ACTIONS_RESERVE,
  },
  // Above the screens' headers (zIndex 10) so the title sits over their blur, as it did within them.
  root: {
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 11,
  },
});
