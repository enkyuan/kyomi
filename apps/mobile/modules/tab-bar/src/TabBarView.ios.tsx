import { requireNativeView } from "expo";
import { Host } from "@expo/ui/swift-ui";
import { StyleSheet } from "react-native";
import type { TabBarProps } from "./TabBar.types";

const NativeView = requireNativeView<TabBarProps>("TabBar", "TabBarView");

export default function TabBarView(props: TabBarProps) {
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
