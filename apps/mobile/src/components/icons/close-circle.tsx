import { CloseCircleLineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type CloseCircleIconProps = Omit<SvgProps, "width" | "height" | "viewBox"> & {
  readonly size?: number;
};

export function CloseCircleIcon({
  size = 20,
  fill = "currentColor",
  ...props
}: CloseCircleIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={CloseCircleLineNativeIcon.viewBox}
      width={size}
      {...props}
    >
      {CloseCircleLineNativeIcon.paths.map((path) => (
        <Path d={path.d} fill={fill} fillRule={path.fillRule} key={path.d} />
      ))}
    </Svg>
  );
}
