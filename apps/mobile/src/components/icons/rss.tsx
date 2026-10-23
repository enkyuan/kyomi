import { RssNativeIcon } from "@kyomi/ui/icons/blode-native";
import { BlodeIcon, type BlodeIconProps } from "./blode";

export type RssIconProps = Omit<BlodeIconProps, "icon">;

export function RssIcon(props: RssIconProps) {
  return <BlodeIcon icon={RssNativeIcon} {...props} />;
}
