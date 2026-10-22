import { ChevronsUpDownNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type SwitcherIconProps = Omit<BlodeIconProps, "icon">;

export function SwitcherIcon(props: SwitcherIconProps) {
  return <BlodeIcon icon={ChevronsUpDownNativeIcon} {...props} />;
}
