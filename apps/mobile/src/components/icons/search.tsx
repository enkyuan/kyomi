import { SearchNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type SearchIconProps = Omit<BlodeIconProps, "icon">;

export function SearchIcon(props: SearchIconProps) {
  return <BlodeIcon icon={SearchNativeIcon} {...props} />;
}
