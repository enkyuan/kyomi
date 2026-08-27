import { requireNativeView } from "expo";
import { Host } from "@expo/ui/swift-ui";
import { StyleSheet } from "react-native";
import type { KyomiNativeTabBarProps } from "./KyomiNativeTabBar.types";

const NativeView = requireNativeView<KyomiNativeTabBarProps>(
  "KyomiNativeTabBar",
  "KyomiTabBarView",
);

export default function KyomiNativeTabBarView(props: KyomiNativeTabBarProps) {
  const { pointerEvents, style, ...nativeProps } = props;

  return (
    <Host pointerEvents={pointerEvents} style={style}>
      <NativeView {...nativeProps} style={styles.fill} />
    </Host>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
