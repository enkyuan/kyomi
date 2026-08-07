import { CloseIcon, ListSearchIcon } from "@/components/icons";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

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
    <View className="size-[19px]">
      <Animated.View
        entering={entering}
        exiting={exiting}
        key={isSearchExpanded ? "close" : "search"}
        className="absolute inset-0 items-center justify-center"
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
