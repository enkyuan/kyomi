import { ArrowShareRightNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type ShareIconProps = Omit<BlodeIconProps, "icon">;

export function ShareIcon(props: ShareIconProps) {
  return <BlodeIcon icon={ArrowShareRightNativeIcon} {...props} />;
}
