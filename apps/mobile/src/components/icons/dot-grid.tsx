import { DotGrid1x3HorizontalFilledNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type DotGridIconProps = Omit<BlodeIconProps, "icon">;

export function DotGridIcon(props: DotGridIconProps) {
  return <BlodeIcon icon={DotGrid1x3HorizontalFilledNativeIcon} {...props} />;
}
