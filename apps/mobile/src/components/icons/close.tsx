import { XNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type CloseIconProps = Omit<BlodeIconProps, "icon">;

export function CloseIcon(props: CloseIconProps) {
  return <BlodeIcon icon={XNativeIcon} {...props} />;
}
