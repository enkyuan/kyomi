import { GoogleIconGeometry } from "@kyomi/ui/icons/google";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type GoogleIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
};

export function GoogleIcon({ size = 20, ...props }: GoogleIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox={GoogleIconGeometry.viewBox}
      width={size}
      {...props}
    >
      {GoogleIconGeometry.paths.map((path) => (
        <Path d={path.d} fill={path.fill} key={path.d} />
      ))}
    </Svg>
  );
}
