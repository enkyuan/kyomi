import type { ViewProps } from "react-native";

export type KyomiNativeHeaderViewProps = ViewProps & {
  collapseProgress: number;
  title: string;
  topInset: number;
};
