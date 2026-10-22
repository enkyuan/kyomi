import { BookmarkFilledNativeIcon, BookmarkNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type BookmarkIconProps = Omit<BlodeIconProps, "icon"> & {
  readonly focused?: boolean;
};

export function BookmarkIcon({ focused = false, ...props }: BookmarkIconProps) {
  return <BlodeIcon icon={focused ? BookmarkFilledNativeIcon : BookmarkNativeIcon} {...props} />;
}
