import { PlusIconGeometry } from "@kyomi/ui/icons/plus";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type PlusIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
};

export function PlusIcon({ size = 20, fill = "currentColor", ...props }: PlusIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox={PlusIconGeometry.viewBox}
      width={size}
      {...props}
    >
      {PlusIconGeometry.paths.map((path) => (
        <Path d={path.d} fill={fill} key={path.d} />
      ))}
    </Svg>
  );
}
