import { CloseIconGeometry } from "@kyomi/ui/icons/close";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type CloseIconProps = Omit<SvgProps, "width" | "height"> & {
  size?: number;
};

export function CloseIcon({ size = 20, fill = "currentColor", ...props }: CloseIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      height={size}
      viewBox={CloseIconGeometry.viewBox}
      width={size}
      {...props}
    >
      {CloseIconGeometry.paths.map((path) => (
        <Path d={path.d} fill={fill} key={path.d} />
      ))}
    </Svg>
  );
}
