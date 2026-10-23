import { HistoryFilledNativeIcon, HistoryNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type RecentsIconProps = Omit<BlodeIconProps, "icon"> & {
  readonly focused?: boolean;
};

export function RecentsIcon({ focused = false, ...props }: RecentsIconProps) {
  return <BlodeIcon icon={focused ? HistoryFilledNativeIcon : HistoryNativeIcon} {...props} />;
}
