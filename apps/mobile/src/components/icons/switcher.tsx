import { SwitcherIconGeometry } from "@kyomi/ui/icons/switcher";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type SwitcherIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
};

export function SwitcherIcon({ size = 20, fill = "currentColor", ...props }: SwitcherIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox={SwitcherIconGeometry.viewBox}
      width={size}
      {...props}
    >
      <Path d={SwitcherIconGeometry.d} fill={fill} />
    </Svg>
  );
}
