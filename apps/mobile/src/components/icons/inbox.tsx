import { InboxIconGeometry } from "@kyomi/ui/icons/inbox";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type InboxIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
  focused?: boolean;
};

export function InboxIcon({
  size = 20,
  fill = "currentColor",
  focused = false,
  ...props
}: InboxIconProps) {
  const path = focused ? InboxIconGeometry.fill : InboxIconGeometry.line;
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox={InboxIconGeometry.viewBox}
      width={size}
      {...props}
    >
      <Path d={path.d} fill={fill} />
    </Svg>
  );
}
