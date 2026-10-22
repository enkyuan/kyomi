import { InboxFilledNativeIcon, InboxNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type InboxIconProps = Omit<BlodeIconProps, "icon"> & {
  readonly focused?: boolean;
};

export function InboxIcon({ focused = false, ...props }: InboxIconProps) {
  return <BlodeIcon icon={focused ? InboxFilledNativeIcon : InboxNativeIcon} {...props} />;
}
