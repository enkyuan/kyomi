import type { ReactElement, ReactNode } from "react";
import type { SharedValue } from "react-native-reanimated";

export type TopTabsTabProps = {
  name: string;
  children: ReactNode;
};

export type TopTabsProps = {
  initialTabName: string;
  children: ReactElement<TopTabsTabProps> | ReactElement<TopTabsTabProps>[];
  sidePadding?: number;
  gap?: number;
  tabClassName?: string;
  labelClassName?: string;
  indicatorClassName?: string;
};

export type TopTabsBarProps = {
  focusedTabName: string;
  indexDecimal: SharedValue<number>;
  onTabPress: (name: string) => void;
  tabNames: string[];
  sidePadding?: number;
  gap?: number;
  tabClassName?: string;
  labelClassName?: string;
  indicatorClassName?: string;
};
