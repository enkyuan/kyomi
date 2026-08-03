import { ArrowLeftLineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import Svg, { Path, type SvgProps } from "react-native-svg";

export type BackIconProps = Omit<SvgProps, "width" | "height" | "viewBox"> & {
  readonly size?: number;
};

export function BackIcon({ size = 20, fill = "currentColor", ...props }: BackIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox={ArrowLeftLineNativeIcon.viewBox}
      width={size}
      {...props}
    >
      {ArrowLeftLineNativeIcon.paths.map((path) => (
        <Path d={path.d} fill={fill} fillRule={path.fillRule} key={path.d} />
      ))}
    </Svg>
  );
}
