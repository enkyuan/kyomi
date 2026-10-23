import { EllipsisNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type MoreIconProps = Omit<BlodeIconProps, "icon">;

export function MoreIcon(props: MoreIconProps) {
  return <BlodeIcon icon={EllipsisNativeIcon} {...props} />;
}
