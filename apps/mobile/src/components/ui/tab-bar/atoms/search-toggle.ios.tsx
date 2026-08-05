import { CloseIcon, ListSearchIcon } from "@/components/icons";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { styles } from "../lib/styles";

const ACTION_ICON_SIZE = 19;

export function ReaderSearchToggleIcon({
  inactiveColor,
  isSearchExpanded,
  shouldReduceMotion,
}: {
  readonly inactiveColor: string;
  readonly isSearchExpanded: boolean;
  readonly shouldReduceMotion: boolean;
}) {
  const entering = shouldReduceMotion ? undefined : FadeIn.duration(120);
  const exiting = shouldReduceMotion ? undefined : FadeOut.duration(90);

  return (
    <View style={styles.liquidIconSwap}>
      <Animated.View
        entering={entering}
        exiting={exiting}
        key={isSearchExpanded ? "close" : "search"}
        style={styles.liquidIconSwapLayer}
      >
        {isSearchExpanded ? (
          <CloseIcon fill={inactiveColor} size={ACTION_ICON_SIZE} />
        ) : (
          <ListSearchIcon fill={inactiveColor} size={ACTION_ICON_SIZE} />
        )}
      </Animated.View>
    </View>
  );
}
