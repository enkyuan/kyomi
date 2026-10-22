import { FilterAscFilledNativeIcon, FilterAscNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type FilterIconProps = Omit<BlodeIconProps, "icon"> & {
  readonly focused?: boolean;
};

export function FilterIcon({ focused = false, ...props }: FilterIconProps) {
  return <BlodeIcon icon={focused ? FilterAscFilledNativeIcon : FilterAscNativeIcon} {...props} />;
}
