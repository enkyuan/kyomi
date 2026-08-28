import type { ViewProps } from "react-native";

export type HeaderViewProps = ViewProps & {
  collapseProgress: number;
  title: string;
  topInset: number;
};
