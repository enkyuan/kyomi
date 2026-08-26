import { RecentsIconGeometry } from "@kyomi/ui/icons/recents";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type RecentsIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
  focused?: boolean;
};

export function RecentsIcon({
  size = 20,
  fill = "currentColor",
  focused = false,
  ...props
}: RecentsIconProps) {
  const path = focused ? RecentsIconGeometry.fill : RecentsIconGeometry.line;
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox={RecentsIconGeometry.viewBox}
      width={size}
      {...props}
    >
      <Path d={path.d} fill={fill} />
    </Svg>
  );
}
